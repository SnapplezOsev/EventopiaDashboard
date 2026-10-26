import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchRentman, extractId } from '@/lib/rentman';
import { getLocalAssignments, removeLocalAssignment } from '@/lib/localAssignments';
import { parseWeekString } from '@/lib/weekUtils';
import { getCachedSchedule, setCachedSchedule } from '@/lib/scheduleCache';

// Module-level global cache to make repeated queries and prefetching near-instantaneous (under 5ms)
if (!globalThis._scheduleCache) {
  globalThis._scheduleCache = new Map();
}
const scheduleCache = globalThis._scheduleCache;
const SCHEDULE_CACHE_TTL = 60 * 1000; // 60 seconds

// Cache for reference data (crew, vehicles, statuses, etc.) that rarely changes
if (!globalThis._refDataState) {
  globalThis._refDataState = { data: null, lastFetch: 0 };
}
const REF_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getReferenceData(safeFetch, force = false) {
  const now = Date.now();
  if (!force && globalThis._refDataState.data && (now - globalThis._refDataState.lastFetch < REF_CACHE_TTL)) {
    return globalThis._refDataState.data;
  }
  const [
    allProjects,
    allSubprojects,
    allStatuses,
    allProjectStatuses,
    allVehicles,
    allCrew,
    allContacts,
    allTaskStatuses,
    allProjFunctionGroups
  ] = await Promise.all([
    safeFetch('/projects?limit=1000&sort=-id'),
    safeFetch('/subprojects?limit=1000&sort=-id'),
    safeFetch('/statuses?limit=100'),
    safeFetch('/projectstatuses?limit=100'),
    safeFetch('/vehicles?limit=500'),
    safeFetch('/crew?limit=500'),
    safeFetch('/contacts?limit=1000'),
    safeFetch('/taskstatuses?limit=100'),
    safeFetch('/projectfunctiongroups?limit=1000&sort=-id')
  ]);

  globalThis._refDataState.data = {
    allProjects,
    allSubprojects,
    allStatuses,
    allProjectStatuses,
    allVehicles,
    allCrew,
    allContacts,
    allTaskStatuses,
    allProjFunctionGroups
  };
  globalThis._refDataState.lastFetch = now;
  return globalThis._refDataState.data;
}

if (!globalThis._inFlightSchedules) {
  globalThis._inFlightSchedules = new Map();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    const { weekStart, weekEnd, weekStartStr, weekEndStr, weekStr } = parseWeekString(weekParam);
    const cacheKey = weekStr;

    // Check fast cache first (persists across workers & reloads)
    const cached = !forceRefresh ? getCachedSchedule(weekStr) : null;
    if (cached && cached.functions && cached.functions.length > 0) {
      return NextResponse.json({ ...cached, fromCache: true });
    }

    // Deduplicate in-flight schedule fetches so duplicate calls don't blast Rentman
    if (!forceRefresh && globalThis._inFlightSchedules.has(weekStr)) {
      const inFlight = await globalThis._inFlightSchedules.get(weekStr);
      return NextResponse.json(inFlight);
    }

    const executeFetch = async () => {
      const formatHexColor = (col, fallback = '#14B4EC') => {
        if (!col) return fallback;
        return col.startsWith('#') ? col : `#${col}`;
      };

      // Safe fetch with fallback and retry so temporary network/Rentman blips don't break the dashboard
      const safeFetch = async (path, retries = 1) => {
        try {
          const res = await fetchRentman(path);
          return res?.data || [];
        } catch (err) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 400));
            return safeFetch(path, retries - 1);
          }
          console.warn(`Safe fetch warning for ${path}:`, err.message);
          return [];
        }
      };

    // Parallel fetch with large limit to avoid pagination truncation
    const [
      refData,
      planFilteredPf,
      usageFilteredPf,
      recentPf,
      allProjCrew,
      allProjVehicles,
      allAppointments,
      allAppCrew,
      allTasks,
      allTaskAssignments
    ] = await Promise.all([
      getReferenceData(safeFetch, forceRefresh),
      safeFetch(`/projectfunctions?planperiod_start[gte]=${weekStartStr}&planperiod_start[lte]=${weekEndStr}T23:59:59&limit=1000`),
      safeFetch(`/projectfunctions?usageperiod_start[gte]=${weekStartStr}&usageperiod_start[lte]=${weekEndStr}T23:59:59&limit=1000`),
      safeFetch('/projectfunctions?limit=1000&sort=-id'),
      safeFetch('/projectcrew?limit=1000&sort=-id'),
      safeFetch('/projectvehicles?limit=1000&sort=-id'),
      safeFetch('/appointments?limit=500&sort=-id'),
      safeFetch('/appointmentcrew?limit=500&sort=-id'),
      safeFetch('/tasks?limit=500&sort=-id'),
      safeFetch('/taskassignments?limit=1000&sort=-id')
    ]);

    const {
      allProjects,
      allSubprojects,
      allStatuses,
      allProjectStatuses,
      allVehicles,
      allCrew,
      allContacts,
      allTaskStatuses,
      allProjFunctionGroups
    } = refData;

    // Merge date-filtered and recent project functions so functions created earlier (lower ID) are never dropped
    const projFunctionsMap = new Map();
    for (const f of (planFilteredPf || [])) projFunctionsMap.set(f.id, f);
    for (const f of (usageFilteredPf || [])) projFunctionsMap.set(f.id, f);
    for (const f of (recentPf || [])) {
      if (!projFunctionsMap.has(f.id)) projFunctionsMap.set(f.id, f);
    }
    const allProjFunctions = Array.from(projFunctionsMap.values());

    // Lookup maps
    const projectMap = {};
    for (const p of allProjects) projectMap[p.id] = p;

    const subprojectMap = {};
    for (const sp of allSubprojects) subprojectMap[sp.id] = sp;

    // Resolve any subprojects referenced by active functions that fell outside the top 1000
    const missingSubprojectIds = new Set();
    for (const fn of allProjFunctions) {
      const spId = extractId(fn.subproject);
      if (spId && !subprojectMap[spId]) missingSubprojectIds.add(spId);
    }
    if (missingSubprojectIds.size > 0) {
      const fetchedSp = await Promise.all(
        Array.from(missingSubprojectIds).map(id => safeFetch(`/subprojects?id=${id}`))
      );
      for (const spArr of fetchedSp) {
        for (const sp of spArr) {
          subprojectMap[sp.id] = sp;
        }
      }
    }

    // Resolve any parent projects referenced that fell outside the top 1000
    const missingProjectIds = new Set();
    for (const fn of allProjFunctions) {
      const spId = extractId(fn.subproject);
      const subproject = spId ? subprojectMap[spId] : null;
      const pId = extractId(fn.project) || (subproject ? extractId(subproject.project) : null);
      if (pId && !projectMap[pId]) missingProjectIds.add(pId);
    }
    if (missingProjectIds.size > 0) {
      const fetchedP = await Promise.all(
        Array.from(missingProjectIds).map(id => safeFetch(`/projects?id=${id}`))
      );
      for (const pArr of fetchedP) {
        for (const p of pArr) {
          projectMap[p.id] = p;
        }
      }
    }

    const functionGroupMap = {};
    for (const fg of allProjFunctionGroups) {
      functionGroupMap[fg.id] = {
        id: fg.id,
        name: fg.name || fg.displayname || '',
        planperiod_start: fg.planperiod_start,
        planperiod_end: fg.planperiod_end,
        usageperiod_start: fg.usageperiod_start,
        usageperiod_end: fg.usageperiod_end,
        duration: fg.duration
      };
    }

    const projectStatusMap = {};
    for (const st of allProjectStatuses) {
      projectStatusMap[st.id] = st.displayname || st.name;
    }
    for (const st of allStatuses) {
      projectStatusMap[st.id] = st.displayname || st.name;
    }

    const contactMap = {};
    for (const c of allContacts) {
      contactMap[c.id] = c.displayname || c.name || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Okänd';
    }

    const vehicleMap = {};
    for (const v of allVehicles) {
      vehicleMap[v.id] = v.name || v.displayname;
    }

    // Process Crew
    const internalFolders = (process.env.DASHBOARD_INTERNAL_FOLDERS || "40").split(',').map(s => parseInt(s.trim()));
    const freelancerFolders = (process.env.DASHBOARD_FREELANCER_FOLDERS || "41,43").split(',').map(s => parseInt(s.trim()));
    const preferredFolder = freelancerFolders[0];

    const crewResult = { internal: [], freelancers: [] };
    const crewMap = {};

    for (const c of allCrew) {
      const folderId = extractId(c.folder);
      const crewMember = {
        id: c.id,
        name: `${c.firstname || c.first_name || ''} ${c.lastname || c.last_name || ''}`.trim() || c.displayname || c.name || 'Okänd',
        folderId
      };
      crewMap[c.id] = crewMember.name;

      if (c.active === false) continue;

      if (internalFolders.includes(folderId)) {
        crewMember.category = 'internal';
        crewResult.internal.push(crewMember);
      } else if (freelancerFolders.includes(folderId)) {
        crewMember.preferred = folderId === preferredFolder;
        crewMember.category = 'freelancer';
        crewResult.freelancers.push(crewMember);
      }
    }

    crewResult.freelancers.sort((a, b) => {
      if (a.preferred && !b.preferred) return -1;
      if (!a.preferred && b.preferred) return 1;
      return a.name.localeCompare(b.name);
    });

    // Helper to check date overlap
    const isInWeek = (startStr, endStr) => {
      if (!startStr) return false;
      const s = new Date(startStr);
      const e = endStr ? new Date(endStr) : s;
      return s <= weekEnd && e >= weekStart;
    };

    const functions = [];
    const unscheduledFunctions = [];
    const processedSubprojects = new Set();
    const processedProjects = new Set();
    const localAssignments = getLocalAssignments();

    // 1. Process Project Functions (Functions belong to Subprojects, which link to Projects)
    for (const fn of allProjFunctions) {
      const subprojectId = extractId(fn.subproject);
      const subproject = subprojectMap[subprojectId];
      const projectId = extractId(fn.project) || (subproject ? extractId(subproject.project) : null);
      const project = projectMap[projectId] || {};

      const functionGroupId = extractId(fn.group);
      const fg = functionGroupId ? functionGroupMap[functionGroupId] : null;
      const functionGroupName = fg?.name || '';

      // Direct explicit dates on function
      const directStart = fn.planperiod_start || fn.usageperiod_start || fn.start;
      const directEnd = fn.planperiod_end || fn.usageperiod_end || fn.end || directStart;

      // Specific timeframe dates from function group
      const fgStart = fg?.planperiod_start || fg?.usageperiod_start;
      const fgEnd = fg?.planperiod_end || fg?.usageperiod_end || fgStart;

      // Project planning & usage period
      const projPlanStart = subproject?.planperiod_start || project?.planperiod_start;
      const projPlanEnd = subproject?.planperiod_end || project?.planperiod_end || projPlanStart;

      // Functions schedule time check
      let isUnscheduled = false;
      let intervalStart = null;
      let intervalEnd = null;
      let planStart = null;
      let planEnd = null;

      if (directStart) {
        // Scheduled function with explicit times
        if (!isInWeek(directStart, directEnd)) continue;
        isUnscheduled = false;
        planStart = directStart;
        planEnd = directEnd;
        intervalStart = directStart;
        intervalEnd = directEnd;
      } else {
        // Function has no explicit dates directly set
        isUnscheduled = true;

        // Check if the function belongs to a distinct timeframe/function group period:
        // A distinct timeframe is defined if fgStart & fgEnd exist and:
        // 1) Either fgStart or fgEnd differs from the project's overall broad planning period, OR
        // 2) fgStart and fgEnd are on the same calendar day (a single day's window)
        const isSameDayFg = fgStart && fgEnd && new Date(fgStart).toDateString() === new Date(fgEnd).toDateString();
        const differsFromProjPlan = fgStart && fgEnd && (fgStart !== projPlanStart || fgEnd !== projPlanEnd);
        const hasSpecificTimePeriod = Boolean(fgStart && fgEnd && (differsFromProjPlan || isSameDayFg));

        if (hasSpecificTimePeriod) {
          // If this specific timeframe is outside the viewed week, skip
          if (!isInWeek(fgStart, fgEnd)) {
            continue;
          }
          intervalStart = fgStart;
          intervalEnd = fgEnd;
          planStart = fgStart;
          planEnd = fgEnd;
        } else {
          // No specific timeframe/period: lies only within generic "Planning period"
          // Skip if project's planning period is not in this week
          if (projPlanStart && !isInWeek(projPlanStart, projPlanEnd)) {
            continue;
          }
          // Do not treat as specific timeframe interval (so it's not shown in the grid overview)
          intervalStart = null;
          intervalEnd = null;
          planStart = projPlanStart || (weekStart?.toISOString ? weekStart.toISOString() : (weekStartStr || new Date().toISOString()));
          planEnd = projPlanEnd || planStart;
        }
      }

      if (subprojectId) processedSubprojects.add(subprojectId);
      if (projectId) processedProjects.add(projectId);

      // Status check
      let statusName = 'Koncept';
      const statusId = extractId(subproject?.status) || extractId(project?.status);
      if (statusId) {
        statusName = projectStatusMap[statusId] || 'Koncept';
      }
      const isCanceled = statusName.toLowerCase().includes('cancel') || 
                         statusName.toLowerCase().includes('annuller') || 
                         statusName.toLowerCase().includes('avbokad');
      if (isCanceled) continue;

      // Customer & Location
      const customerId = extractId(project.customer) || extractId(subproject?.customer);
      const customerName = customerId ? (contactMap[customerId] || 'Okänd Kund') : 'Okänd Kund';

      const locationId = extractId(project.location) || extractId(subproject?.location);
      const locationName = locationId ? (contactMap[locationId] || 'Okänd Plats') : (project.location_name || subproject?.location_name || 'Okänd Plats');

      // Assigned crew from Rentman (Rentman uses 'function' or 'projectfunction')
      const assignedCrew = allProjCrew
        .filter(c => (extractId(c.function) === fn.id || extractId(c.projectfunction) === fn.id))
        .map(c => {
          const cId = extractId(c.crewmember) || extractId(c.crew);
          const name = crewMap[cId] || 'Unknown';
          const isInternal = crewResult.internal.some(x => x.id === cId);
          const isFreelancer = crewResult.freelancers.some(x => x.id === cId);
          return {
            projectCrewId: c.id,
            crewId: cId,
            name,
            source: 'rentman',
            category: isInternal ? 'internal' : (isFreelancer ? 'freelancer' : 'hidden')
          };
        });

      // Merge local assignments created on the dashboard
      const localForFn = localAssignments.filter(la => String(la.functionId) === String(fn.id));
      for (const la of localForFn) {
        if (!assignedCrew.some(ac => ac.crewId === la.crewId)) {
          const cId = la.crewId;
          const name = crewMap[cId] || 'Unknown';
          const isInternal = crewResult.internal.some(x => x.id === cId);
          const isFreelancer = crewResult.freelancers.some(x => x.id === cId);
          assignedCrew.push({
            projectCrewId: la.id,
            crewId: cId,
            name,
            source: 'local',
            category: isInternal ? 'internal' : (isFreelancer ? 'freelancer' : 'hidden')
          });
        }
      }

      // Vehicles
      const vehicleNames = allProjVehicles
        .filter(pv => extractId(pv.function) === fn.id)
        .map(pv => vehicleMap[extractId(pv.vehicle)])
        .filter(Boolean);



      // Determine clean project name (prevent "Projekt", "Shifts project", "Shift" for internal shifts)
      let rawProjName = project.name || subproject?.name || '';
      const lowerProj = rawProjName.toLowerCase().trim();
      const isInternalShift = fn.type === 'shift' || 
                              projectId === 195 || 
                              lowerProj === 'projekt' || 
                              lowerProj === 'shifts project' || 
                              lowerProj === 'shift';

      if (isInternalShift) {
        rawProjName = '';
      }

      const fnName = fn.name || functionGroupName || 'Funktion';

      const durationHours = fn.duration ? Math.round((fn.duration / 3600) * 10) / 10 : null;
      let spanHours = null;
      if (intervalStart && intervalEnd) {
        const sTime = new Date(intervalStart).getTime();
        const eTime = new Date(intervalEnd).getTime();
        if (!isNaN(sTime) && !isNaN(eTime)) {
          spanHours = Math.round(((eTime - sTime) / 3600000) * 10) / 10;
        }
      }
      const hasIntervalDuration = Boolean(durationHours && intervalStart && intervalEnd);

      const functionObj = {
        id: fn.id,
        name: fnName,
        type: fn.type || 'crew_function',
        isUnscheduled,
        durationHours,
        intervalStart,
        intervalEnd,
        spanHours,
        hasIntervalDuration,
        functionGroupId: functionGroupId || null,
        functionGroupName: functionGroupName || null,
        projectId: rawProjName ? (project.id || projectId || null) : null,
        projectName: rawProjName,
        projectColor: rawProjName ? formatHexColor(project.color || subproject?.color, '#14B4EC') : null,
        customerName: rawProjName ? customerName : '',
        locationName: rawProjName ? locationName : '',
        statusName,
        vehicleNames,
        amount: fn.amount || 1,
        subprojectId: subprojectId || projectId,
        planperiod_start: planStart,
        planperiod_end: planEnd || planStart,
        assignedCrew
      };

      functions.push(functionObj);
      if (isUnscheduled) {
        unscheduledFunctions.push(functionObj);
      }
    }

    // 3. Process Appointments
    for (const app of allAppointments) {
      const appStart = app.start || app.planperiod_start;
      const appEnd = app.end || app.planperiod_end || appStart;

      if (!isInWeek(appStart, appEnd)) continue;

      const assignedCrew = allAppCrew
        .filter(c => extractId(c.appointment) === app.id)
        .map(c => {
          const cId = extractId(c.crew);
          const name = crewMap[cId] || 'Unknown';
          const isInternal = crewResult.internal.some(x => x.id === cId);
          const isFreelancer = crewResult.freelancers.some(x => x.id === cId);
          return {
            projectCrewId: c.id,
            crewId: cId,
            name,
            category: isInternal ? 'internal' : (isFreelancer ? 'freelancer' : 'hidden')
          };
        });

      functions.push({
        id: `app-${app.id}`,
        realId: app.id,
        name: app.name || 'Möte',
        type: 'appointment',
        projectId: `app-${app.id}`,
        projectName: 'Möte / Bokning',
        projectColor: formatHexColor(app.color, '#E67E22'),
        customerName: '',
        locationName: app.location || '',
        statusName: 'Bekräftad',
        vehicleNames: [],
        amount: 1,
        subprojectId: `app-${app.id}`,
        planperiod_start: appStart,
        planperiod_end: appEnd,
        assignedCrew,
        remark: app.remark || ''
      });
    }

    // 4. Process Tasks (Filtered into Active & Completed this week)
    const taskStatusMap = {};
    for (const ts of allTaskStatuses) {
      const sName = (ts.name || ts.displayname || '').toLowerCase();
      const isCompleted = sName.includes('complete') || sName.includes('klar') || 
                          sName.includes('avslut') || sName.includes('done') || sName.includes('färdig');
      taskStatusMap[ts.id] = { 
        name: ts.name || ts.displayname || 'Att göra', 
        color: ts.color || 'F0F3F6',
        isCompleted
      };
    }

    // One week ago boundary for recent completed tasks
    const oneWeekAgo = new Date(weekStart);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const tasks = [];

    for (const t of allTasks) {
      const sId = extractId(t.status);
      const statusInfo = taskStatusMap[sId] || { name: 'Att göra', color: 'F0F3F6', isCompleted: false };
      
      const isCompleted = Boolean(statusInfo.isCompleted || t.completed === true || t.is_completed === true);

      // If task is completed, ONLY show if it was completed within current week or last 7 days
      if (isCompleted) {
        const completedDateStr = t.completed_date || t.finish_date || t.modified || t.deadline;
        if (completedDateStr) {
          const compDate = new Date(completedDateStr);
          // If completed before the last week window, skip it so it doesn't clutter
          if (compDate < oneWeekAgo) continue;
        }
      }

      const pId = extractId(t.project);
      const proj = projectMap[pId];

      const assigned = allTaskAssignments
        .filter(ta => extractId(ta.task) === t.id)
        .map(ta => {
          const crewId = extractId(ta.crew);
          const c = [...crewResult.internal, ...crewResult.freelancers].find(x => x.id === crewId);
          return c 
            ? { assignmentId: ta.id, crewId, name: c.name } 
            : { assignmentId: ta.id, crewId, name: crewMap[crewId] || 'Okänd' };
        });

      let sName = statusInfo.name;
      if (sName === 'To do') sName = 'Att göra';
      if (sName === 'In progress') sName = 'Pågår';

      tasks.push({
        id: t.id,
        name: t.name,
        details: t.details || '',
        color: t.color || '3b82f6',
        status: sName,
        statusId: sId,
        statusColor: formatHexColor(statusInfo.color, '#F0F3F6'),
        isCompleted,
        completedAt: t.completed_date || t.modified || null,
        priority: t.priority || 'no_priority',
        deadline: t.deadline,
        projectName: proj ? proj.name : (t.project_name || ''),
        itemtype: t.itemtype || 'Project',
        assignedCrew: assigned
      });
    }

    // Auto-clean any local assignments that have now been added in Rentman
    for (const la of localAssignments) {
      const isNowInRentman = allProjCrew.some(
        c => (extractId(c.function) === Number(la.functionId) || extractId(c.projectfunction) === Number(la.functionId)) &&
             (extractId(c.crewmember) === Number(la.crewId) || extractId(c.crew) === Number(la.crewId))
      );
      if (isNowInRentman) {
        removeLocalAssignment(la.id);
      }
    }

    const remainingLocal = getLocalAssignments();
    const pendingRentmanSync = remainingLocal.map(la => {
      const matchingFn = functions.find(f => String(f.id) === String(la.functionId));
      return {
        id: la.id,
        functionId: la.functionId,
        functionName: matchingFn?.name || la.functionName || 'Funktion',
        projectName: matchingFn?.projectName || la.projectName || '',
        projectColor: matchingFn?.projectColor || la.projectColor || '#14B4EC',
        planperiod_start: matchingFn?.planperiod_start || la.planperiod_start || null,
        planperiod_end: matchingFn?.planperiod_end || la.planperiod_end || null,
        crewId: la.crewId,
        crewName: la.crewName || crewMap[la.crewId] || 'Okänd',
        crewCategory: la.crewCategory || 'internal',
        createdAt: la.createdAt
      };
    });

    // Fallback to cached schedule if fetch returned 0 functions (e.g. transient Rentman lock/blip)
    if (functions.length === 0) {
      const diskFallback = getCachedSchedule(weekStr, 24 * 60 * 60 * 1000);
      if (diskFallback && diskFallback.functions && diskFallback.functions.length > 0) {
        console.warn(`Rentman returned 0 functions — falling back to disk cache (${diskFallback.functions.length} functions).`);
        return { ...diskFallback, fromCache: true, isStale: true };
      }
    }

    const result = {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      functions,
      crew: crewResult,
      tasks,
      unscheduledFunctions,
      pendingRentmanSync
    };

    if (functions.length > 0) {
      scheduleCache.set(cacheKey, { data: result, timestamp: Date.now() });
      setCachedSchedule(weekStr, result);
    }

    return result;
  };

  const fetchPromise = executeFetch();
  if (!forceRefresh) {
    globalThis._inFlightSchedules.set(weekStr, fetchPromise);
  }

  try {
    const data = await fetchPromise;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Schedule API Error:', error);
    const diskFallback = getCachedSchedule(weekStr, 24 * 60 * 60 * 1000);
    if (diskFallback && diskFallback.functions && diskFallback.functions.length > 0) {
      console.warn(`Serving disk cache fallback due to error for ${weekStr}`);
      return NextResponse.json({ ...diskFallback, fromCache: true, isStale: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    globalThis._inFlightSchedules.delete(weekStr);
  }
}
