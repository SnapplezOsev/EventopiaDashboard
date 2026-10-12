import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchRentman, extractId } from '@/lib/rentman';

function getWeekRange(weekStr) {
  let date;
  if (weekStr) {
    const [year, week] = weekStr.split('-W');
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = d.getDay();
    const ISOweekStart = d;
    if (dayOfWeek <= 4) {
      ISOweekStart.setDate(d.getDate() - d.getDay() + 1);
    } else {
      ISOweekStart.setDate(d.getDate() + 8 - d.getDay());
    }
    date = ISOweekStart;
  } else {
    date = new Date();
    const day = date.getDay() || 7;
    if (day !== 1) {
      date.setHours(-24 * (day - 1));
    }
  }

  date.setHours(0, 0, 0, 0);
  const weekStart = new Date(date);
  
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    
    const { weekStart, weekEnd } = getWeekRange(weekParam);
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);

    const formatHexColor = (col, fallback = '#14B4EC') => {
      if (!col) return fallback;
      return col.startsWith('#') ? col : `#${col}`;
    };

    // Safe fetch with fallback so one failing endpoint doesn't break the whole dashboard
    const safeFetch = async (path) => {
      try {
        const res = await fetchRentman(path);
        return res?.data || [];
      } catch (err) {
        console.warn(`Safe fetch warning for ${path}:`, err.message);
        return [];
      }
    };

    // Parallel fetch with large limit to avoid pagination truncation
    const [
      allProjects,
      allSubprojects,
      allProjFunctions,
      allProjCrew,
      allStatuses,
      allProjectStatuses,
      allProjVehicles,
      allVehicles,
      allAppointments,
      allAppCrew,
      allCrew,
      allContacts,
      allTasks,
      allTaskStatuses,
      allTaskAssignments
    ] = await Promise.all([
      safeFetch('/projects?limit=1000&sort=-id'),
      safeFetch('/subprojects?limit=1000&sort=-id'),
      safeFetch('/projectfunctions?limit=1000&sort=-id'),
      safeFetch('/projectcrew?limit=1000&sort=-id'),
      safeFetch('/statuses?limit=100'),
      safeFetch('/projectstatuses?limit=100'),
      safeFetch('/projectvehicles?limit=1000&sort=-id'),
      safeFetch('/vehicles?limit=500'),
      safeFetch('/appointments?limit=500&sort=-id'),
      safeFetch('/appointmentcrew?limit=500&sort=-id'),
      safeFetch('/crew?limit=500'),
      safeFetch('/contacts?limit=1000'),
      safeFetch('/tasks?limit=500&sort=-id'),
      safeFetch('/taskstatuses?limit=100'),
      safeFetch('/taskassignments?limit=1000&sort=-id')
    ]);

    // Lookup maps
    const projectMap = {};
    for (const p of allProjects) projectMap[p.id] = p;

    const subprojectMap = {};
    for (const sp of allSubprojects) subprojectMap[sp.id] = sp;

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
    const processedSubprojects = new Set();
    const processedProjects = new Set();

    // 1. Process Project Functions (Functions belong to Subprojects, which link to Projects)
    for (const fn of allProjFunctions) {
      const subprojectId = extractId(fn.subproject);
      const subproject = subprojectMap[subprojectId];
      const projectId = extractId(fn.project) || (subproject ? extractId(subproject.project) : null);
      const project = projectMap[projectId] || {};

      // Functions MUST have an explicit schedule time (planperiod or usageperiod or start)
      // Unscheduled functions without dates should not inherit multi-week subproject spans
      const planStart = fn.planperiod_start || fn.usageperiod_start || fn.start;
      const planEnd = fn.planperiod_end || fn.usageperiod_end || fn.end || planStart;

      if (!planStart) continue;
      if (!isInWeek(planStart, planEnd)) continue;

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

      // Assigned crew
      const assignedCrew = allProjCrew
        .filter(c => extractId(c.projectfunction) === fn.id)
        .map(c => {
          const cId = extractId(c.crewmember);
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

      // Vehicles
      const vehicleNames = allProjVehicles
        .filter(pv => extractId(pv.function) === fn.id)
        .map(pv => vehicleMap[extractId(pv.vehicle)])
        .filter(Boolean);

      functions.push({
        id: fn.id,
        name: fn.name || 'Funktion',
        type: fn.type || 'crew_function',
        projectId: project.id || projectId || `proj-${fn.id}`,
        projectName: project.name || subproject?.name || 'Projekt',
        projectColor: formatHexColor(project.color || subproject?.color, '#14B4EC'),
        customerName,
        locationName,
        statusName,
        vehicleNames,
        amount: fn.amount || 1,
        subprojectId: subprojectId || projectId,
        planperiod_start: planStart,
        planperiod_end: planEnd || planStart,
        assignedCrew
      });
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
          return c ? { crewId, name: c.name } : { crewId };
        });

      let sName = statusInfo.name;
      if (sName === 'To do') sName = 'Att göra';
      if (sName === 'In progress') sName = 'Pågår';

      tasks.push({
        id: t.id,
        name: t.name,
        details: t.details || '',
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

    return NextResponse.json({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      functions,
      crew: crewResult,
      tasks
    });

  } catch (error) {
    console.error('Schedule API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
