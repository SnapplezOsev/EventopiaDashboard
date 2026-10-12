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

    const projectsResponse = await fetchRentman('/projects');
    const projects = projectsResponse.data || [];

    const overlappingProjects = projects.filter(p => {
      if (!p.planperiod_start || !p.planperiod_end) return false;
      const pStart = new Date(p.planperiod_start);
      const pEnd = new Date(p.planperiod_end);
      return pStart <= weekEnd && pEnd >= weekStart;
    });

    const functions = [];
    const customerCache = {};

    const [allProjFunctionsRes, allProjCrewRes, allSubprojectsRes, allStatusesRes, allProjVehiclesRes, allVehiclesRes, appointmentsRes, appCrewRes] = await Promise.all([
      fetchRentman(`/projectfunctions`),
      fetchRentman(`/projectcrew`),
      fetchRentman(`/subprojects`),
      fetchRentman(`/projectstatuses`),
      fetchRentman(`/projectvehicles`),
      fetchRentman(`/vehicles`),
      fetchRentman(`/appointments`),
      fetchRentman(`/appointmentcrew`)
    ]);

    const allProjFunctions = allProjFunctionsRes?.data || [];
    const allProjCrew = allProjCrewRes?.data || [];
    const allSubprojects = allSubprojectsRes?.data || [];
    const allStatuses = allStatusesRes?.data || [];
    const allProjVehicles = allProjVehiclesRes?.data || [];
    const allVehicles = allVehiclesRes?.data || [];
    const allAppointments = appointmentsRes?.data || [];
    const allAppCrew = appCrewRes?.data || [];

    // Pre-map statuses for quick lookup
    const projectStatusMap = {};
    for (const st of allStatuses) {
      projectStatusMap[st.id] = st.name || st.displayname;
    }

    for (const project of overlappingProjects) {
      const projFunctions = allProjFunctions.filter(f => extractId(f.project) === project.id);
      const projCrew = allProjCrew.filter(c => extractId(c.project) === project.id);

      let customerName = 'Okänd Kund';
      const customerId = extractId(project.customer);
      if (customerId) {
        if (!customerCache[customerId]) {
          try {
            const customerRes = await fetchRentman(`/contacts/${customerId}`);
            customerCache[customerId] = customerRes.data?.name || 'Okänd Kund';
          } catch (e) {
            customerCache[customerId] = 'Okänd Kund';
          }
        }
        customerName = customerCache[customerId];
      }

      let locationName = 'Okänd Plats';
      const locationId = extractId(project.location);
      if (locationId) {
        if (!customerCache[locationId]) {
          try {
            const locRes = await fetchRentman(`/contacts/${locationId}`);
            customerCache[locationId] = locRes.data?.name || 'Okänd Plats';
          } catch (e) {
            customerCache[locationId] = 'Okänd Plats';
          }
        }
        locationName = customerCache[locationId];
      }

      for (const fn of projFunctions) {
        const assignedCrew = projCrew
          .filter(c => extractId(c.projectfunction) === fn.id)
          .map(c => ({
            projectCrewId: c.id,
            crewId: extractId(c.crewmember),
            name: "",
            category: ""
          }));

        const subprojectId = extractId(fn.subproject) || project.id;
        const subproject = allSubprojects.find(sp => sp.id === subprojectId);
        
        let statusName = 'Concept';
        if (subproject && extractId(subproject.status)) {
          statusName = projectStatusMap[extractId(subproject.status)] || 'Concept';
        }

        const isCanceled = statusName.toLowerCase().includes('cancel') || statusName.toLowerCase().includes('avbokad');
        if (isCanceled) continue;

        const vehicleIds = allProjVehicles
          .filter(pv => extractId(pv.function) === fn.id)
          .map(pv => extractId(pv.vehicle));
        const vehicleNames = vehicleIds
          .map(vid => allVehicles.find(v => v.id === vid)?.name)
          .filter(Boolean);

        functions.push({
          id: fn.id,
          name: fn.name,
          type: fn.type || 'crew_function',
          projectId: project.id,
          projectName: project.name,
          projectColor: formatHexColor(project.color, '#14B4EC'),
          customerName,
          locationName,
          statusName,
          vehicleNames,
          amount: fn.amount || 1,
          subprojectId,
          planperiod_start: fn.planperiod_start || project.planperiod_start,
          planperiod_end: fn.planperiod_end || project.planperiod_end,
          assignedCrew
        });
      }
    }

    // Process Appointments
    const overlappingAppointments = allAppointments.filter(a => {
      if (!a.start || !a.end) return false;
      const start = new Date(a.start);
      const end = new Date(a.end);
      return start <= weekEnd && end >= weekStart;
    });

    for (const app of overlappingAppointments) {
      const assignedCrew = allAppCrew
        .filter(c => extractId(c.appointment) === app.id)
        .map(c => ({
          projectCrewId: c.id,
          crewId: extractId(c.crew),
          name: "",
          category: ""
        }));

      functions.push({
        id: `app-${app.id}`,
        realId: app.id,
        name: app.name,
        type: 'appointment',
        projectId: `app-${app.id}`,
        projectName: 'Möte',
        projectColor: formatHexColor(app.color, '#E67E22'),
        customerName: '',
        locationName: app.location || '',
        statusName: 'Confirmed',
        vehicleNames: [],
        amount: 1,
        subprojectId: `app-${app.id}`,
        planperiod_start: app.start,
        planperiod_end: app.end,
        assignedCrew,
        remark: app.remark || ''
      });
    }

    const allCrewResponse = await fetchRentman('/crew');
    const allCrew = allCrewResponse.data || [];

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
        crewResult.internal.push(crewMember);
        crewMember.category = 'internal';
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

    for (const fn of functions) {
      for (const ac of fn.assignedCrew) {
        ac.name = crewMap[ac.crewId] || 'Unknown';
        const internal = crewResult.internal.find(c => c.id === ac.crewId);
        if (internal) ac.category = 'internal';
        else {
          const fl = crewResult.freelancers.find(c => c.id === ac.crewId);
          if (fl) ac.category = 'freelancer';
          else ac.category = 'hidden';
        }
      }
    }

    const [tasksRes, taskStatusesRes, taskAssignmentsRes] = await Promise.all([
      fetchRentman('/tasks'),
      fetchRentman('/taskstatuses'),
      fetchRentman('/taskassignments')
    ]);

    const taskStatuses = taskStatusesRes?.data || [];
    const tasksData = tasksRes?.data || [];

    const completedStatusIds = taskStatuses
      .filter(s => s.name === 'Completed')
      .map(s => s.id);

    const statusMap = {};
    for (const ts of taskStatuses) {
      statusMap[ts.id] = { name: ts.name, color: ts.color || 'F0F3F6' };
    }

    const taskAssignmentsData = taskAssignmentsRes?.data || [];

    const tasks = tasksData
      .filter(t => !completedStatusIds.includes(extractId(t.status)))
      .map(t => {
        const sId = extractId(t.status);
        const pId = extractId(t.project);
        const proj = overlappingProjects.find(p => p.id === pId);
        
        const assigned = taskAssignmentsData
          .filter(ta => extractId(ta.task) === t.id)
          .map(ta => {
            const crewId = extractId(ta.crew);
            const c = [...crewResult.internal, ...crewResult.freelancers].find(x => x.id === crewId);
            return c ? { crewId, name: c.name } : { crewId };
          });

        let sName = statusMap[sId]?.name || 'Att göra';
        if (sName === 'To do') sName = 'Att göra';
        if (sName === 'In progress') sName = 'Pågår';

        return {
          id: t.id,
          name: t.name,
          details: t.details || '',
          status: sName,
          statusId: sId,
          statusColor: formatHexColor(statusMap[sId]?.color, '#F0F3F6'),
          priority: t.priority || 'no_priority',
          deadline: t.deadline,
          projectName: proj ? proj.name : (t.project_name || 'Unknown Project'),
          itemtype: t.itemtype || 'Project',
          assignedCrew: assigned
        };
      });

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
