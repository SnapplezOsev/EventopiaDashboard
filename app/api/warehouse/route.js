import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchRentman, extractId } from '@/lib/rentman';
import { 
  getWarehouseData, 
  setSubprojectPacked, 
  setSubprojectReturned, 
  setRepairTested, 
  addLostEquipment,
  resolveLostEquipment,
  deleteLostEquipment,
  addWarehouseNote, 
  toggleWarehouseNote, 
  deleteWarehouseNote 
} from '@/lib/localWarehouse';

// In-memory cache for fast warehouse responsiveness
if (!globalThis._warehouseCacheState) {
  globalThis._warehouseCacheState = { data: null, lastFetch: 0 };
}
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>?/gm, '').trim();
}

function formatHexColor(col, fallback = '#14B4EC') {
  if (!col) return fallback;
  return col.startsWith('#') ? col : `#${col}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const nowMs = Date.now();

    const localData = getWarehouseData();

    if (!forceRefresh && globalThis._warehouseCacheState.data && (nowMs - globalThis._warehouseCacheState.lastFetch < CACHE_TTL_MS)) {
      return NextResponse.json({
        ...globalThis._warehouseCacheState.data,
        quickNotes: localData.notes || []
      });
    }

    const safeFetch = async (path, retries = 1) => {
      try {
        const res = await fetchRentman(path);
        return res?.data || [];
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 500));
          return safeFetch(path, retries - 1);
        }
        console.warn(`Warehouse fetch warning for ${path}:`, err.message);
        return [];
      }
    };

    const [
      allSubprojects,
      allProjects,
      allStatuses,
      allProjectStatuses,
      allRepairs,
      eqChunk1,
      eqChunk2,
      eqChunk3,
      eqChunk4,
      allContacts,
      allVehicles,
      allProjVehicles,
      allCrew,
      allTasks,
      allTaskStatuses,
      allTaskAssignments,
      allStockMovements
    ] = await Promise.all([
      safeFetch('/subprojects?limit=350&sort=-id'),
      safeFetch('/projects?limit=350&sort=-id'),
      safeFetch('/statuses?limit=100'),
      safeFetch('/projectstatuses?limit=100'),
      safeFetch('/repairs?limit=300&sort=-id'),
      safeFetch('/equipment?limit=1000&offset=0'),
      safeFetch('/equipment?limit=1000&offset=1000'),
      safeFetch('/equipment?limit=1000&offset=2000'),
      safeFetch('/equipment?limit=1000&offset=3000'),
      safeFetch('/contacts?limit=500'),
      safeFetch('/vehicles?limit=200'),
      safeFetch('/projectvehicles?limit=500&sort=-id'),
      safeFetch('/crew?limit=500'),
      safeFetch('/tasks?limit=200&sort=-id'),
      safeFetch('/taskstatuses?limit=100'),
      safeFetch('/taskassignments?limit=500&sort=-id'),
      safeFetch('/stockmovements?limit=1000&sort=-date')
    ]);

    const allEquipment = [...eqChunk1, ...eqChunk2, ...eqChunk3, ...eqChunk4];

    // Build Maps
    const projectMap = {};
    for (const p of allProjects) projectMap[p.id] = p;

    const statusMap = {};
    for (const s of allStatuses) statusMap[s.id] = s.displayname || s.name;
    for (const s of allProjectStatuses) statusMap[s.id] = s.displayname || s.name;

    const contactMap = {};
    for (const c of allContacts) {
      contactMap[c.id] = c.displayname || c.name || `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Okänd';
    }

    const equipMap = {};
    for (const eq of allEquipment) {
      equipMap[eq.id] = {
        id: eq.id,
        name: eq.name || eq.displayname || 'Utrustning',
        code: eq.code || '',
        locationInWarehouse: eq.location_in_warehouse || ''
      };
    }

    const vehicleMap = {};
    for (const v of allVehicles) {
      vehicleMap[v.id] = v.name || v.displayname;
    }

    const crewMap = {};
    for (const c of allCrew) {
      crewMap[c.id] = `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.displayname || c.name || 'Okänd';
    }

    const taskStatusMap = {};
    for (const ts of allTaskStatuses) {
      const sName = (ts.name || ts.displayname || '').toLowerCase();
      const isCompleted = sName.includes('complete') || sName.includes('klar') || 
                          sName.includes('avslut') || sName.includes('done') || sName.includes('färdig');
      taskStatusMap[ts.id] = { 
        name: ts.name || ts.displayname || 'Att göra', 
        isCompleted 
      };
    }

    const subprojectVehicles = {};
    for (const pv of allProjVehicles) {
      const spId = extractId(pv.subproject) || extractId(pv.function);
      const vId = extractId(pv.vehicle);
      if (spId && vId && vehicleMap[vId]) {
        if (!subprojectVehicles[spId]) subprojectVehicles[spId] = [];
        if (!subprojectVehicles[spId].includes(vehicleMap[vId])) {
          subprojectVehicles[spId].push(vehicleMap[vId]);
        }
      }
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const endOfWeek = new Date(todayStart);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const isToday = (d) => d >= todayStart && d < tomorrowStart;
    const isTomorrow = (d) => d >= tomorrowStart && d < dayAfterTomorrow;
    const isThisWeek = (d) => d >= todayStart && d <= endOfWeek;
    const isPast = (d) => d < todayStart;

    // --- 1. PRESERVED SUBPROJECT PACK & RETURN LOGIC ---
    const toPack = [];
    const returns = [];

    for (const sp of allSubprojects) {
      const projectId = extractId(sp.project);
      const project = projectMap[projectId] || {};

      let rawStatus = statusMap[extractId(sp.status)] || statusMap[extractId(project.status)] || 'Koncept';
      const statusLower = rawStatus.toLowerCase();

      if (statusLower.includes('annull') || statusLower.includes('cancel') || statusLower.includes('avbokad')) {
        continue;
      }

      const equipFromStr = sp.equipment_period_from || sp.planperiod_start || sp.usageperiod_start;
      const equipToStr = sp.equipment_period_to || sp.planperiod_end || sp.usageperiod_end;
      if (!equipFromStr && !equipToStr) continue;

      const equipFromDate = equipFromStr ? new Date(equipFromStr) : null;
      const equipToDate = equipToStr ? new Date(equipToStr) : null;

      const customerId = extractId(sp.customer) || extractId(project.customer);
      const customerName = customerId ? (contactMap[customerId] || 'Okänd Kund') : 'Okänd Kund';

      const locationId = extractId(sp.location) || extractId(project.location);
      const locationName = locationId ? (contactMap[locationId] || 'Lager / Plats') : (sp.location_name || project.location_name || 'Lager / Plats');

      const projectName = sp.name || project.name || 'Projekt';
      const projectColor = formatHexColor(sp.color || project.color, '#14B4EC');
      const vehicles = subprojectVehicles[sp.id] || [];

      const isPackedLocally = Boolean(localData.packedSubprojects[String(sp.id)]?.packed);
      const isReturnedLocally = Boolean(localData.returnedSubprojects[String(sp.id)]?.returned);

      const isPackedStatus = statusLower.includes('pack') || isPackedLocally;
      const isOnLocationStatus = statusLower.includes('plats');
      const isUncheckedStatus = statusLower.includes('ej check') || statusLower.includes('1004') || statusLower.includes('åter på lager');
      const isConfirmed = statusLower.includes('bekräft');
      const isProposal = statusLower.includes('förslag');
      const isReturnedStatus = statusLower.includes('return') || isReturnedLocally;

      if (!isReturnedStatus && equipFromDate) {
        const notPastDeparture = !isPast(equipFromDate) || isToday(equipFromDate);
        const wasRecentlyDeparted = isPast(equipFromDate) && (!equipToDate || !isPast(equipToDate));

        if ((isConfirmed || isPackedStatus || (isProposal && (isToday(equipFromDate) || isTomorrow(equipFromDate)))) && (notPastDeparture || (wasRecentlyDeparted && !isOnLocationStatus))) {
          let timing = 'later';
          if (isPast(equipFromDate) && !isPackedStatus) {
            timing = 'overdue_pack';
          } else if (isToday(equipFromDate)) {
            timing = 'today';
          } else if (isTomorrow(equipFromDate)) {
            timing = 'tomorrow';
          } else if (isThisWeek(equipFromDate)) {
            timing = 'this_week';
          }

          toPack.push({
            id: sp.id,
            projectId: project.id || null,
            name: projectName,
            customerName,
            locationName,
            color: projectColor,
            status: isPackedLocally ? 'Packade (Lager)' : rawStatus,
            isPacked: isPackedStatus,
            equipFrom: equipFromStr,
            equipTo: equipToStr,
            timing,
            vehicles
          });
        }
      }

      if (!isReturnedStatus && (isOnLocationStatus || isUncheckedStatus || (isPackedStatus && equipToDate && (isPast(equipToDate) || isToday(equipToDate) || isThisWeek(equipToDate))))) {
        let returnTiming = 'later';
        if (isUncheckedStatus) {
          returnTiming = 'unchecked';
        } else if (equipToDate && isPast(equipToDate)) {
          returnTiming = 'overdue';
        } else if (equipToDate && isToday(equipToDate)) {
          returnTiming = 'today';
        } else if (equipToDate && isTomorrow(equipToDate)) {
          returnTiming = 'tomorrow';
        } else if (equipToDate && isThisWeek(equipToDate)) {
          returnTiming = 'this_week';
        }

        returns.push({
          id: sp.id,
          projectId: project.id || null,
          name: projectName,
          customerName,
          locationName,
          color: projectColor,
          status: isUncheckedStatus ? 'Åter på lager / Ej checkade' : rawStatus,
          isUnchecked: isUncheckedStatus,
          isOverdue: returnTiming === 'overdue',
          equipFrom: equipFromStr,
          equipTo: equipToStr,
          timing: returnTiming,
          vehicles
        });
      }
    }

    // --- 2. REPAIRS & DEFECTS ---
    const testingAndRepairs = [];
    const rentmanUnrepairable = [];

    for (const r of allRepairs) {
      const eqId = extractId(r.equipment);
      const eqObj = eqId ? (equipMap[eqId] || { name: 'Okänd utrustning' }) : { name: 'Okänd utrustning' };

      const reporterId = extractId(r.reporter) || extractId(r.creator);
      const reporterName = reporterId ? (crewMap[reporterId] || 'Tekniker') : 'Tekniker';

      const subprojectId = extractId(r.subproject);
      const subproject = subprojectId ? (allSubprojects.find(sp => sp.id === subprojectId) || null) : null;
      const projectName = subproject?.name || (subproject?.project ? projectMap[extractId(subproject.project)]?.name : '') || '';

      const remarkClean = cleanHtml(r.remark);

      if (r.repair_status === 'unrepairable' || r.repair_status === 'unrepairable_of') {
        rentmanUnrepairable.push({
          id: `rentman-unrep-${r.id}`,
          repairId: r.id,
          number: r.number || r.id,
          name: eqObj.name,
          model: eqObj.name,
          equipmentCode: eqObj.code,
          category: 'Skrotad i Rentman',
          quantity: r.amount || 1,
          details: remarkClean || 'Skrotad / Går ej att reparera',
          project: projectName || 'Lager',
          reportedBy: reporterName,
          reportedAt: r.repairperiod_start || r.created,
          status: 'scrapped',
          source: 'rentman',
          estimatedCostPerUnit: 0
        });
        continue;
      }

      const isCompletedInRentman = r.repair_status === 'completed' || r.repair_status === 'canceled';
      const isTestedLocally = Boolean(localData.testedRepairs[String(r.id)]?.tested);

      if (isCompletedInRentman && !isTestedLocally) continue;

      testingAndRepairs.push({
        id: r.id,
        number: r.number || r.id,
        equipmentId: eqId,
        equipmentName: eqObj.name,
        equipmentCode: eqObj.code,
        equipmentLocation: eqObj.locationInWarehouse,
        remark: remarkClean || 'Ingen felbeskrivning angiven',
        status: isTestedLocally ? 'tested_done' : (r.repair_status || 'in-progress'),
        isTested: isTestedLocally,
        reporterName,
        projectName,
        reportedAt: r.repairperiod_start || r.created,
        testedMeta: localData.testedRepairs[String(r.id)] || null
      });
    }

    testingAndRepairs.sort((a, b) => {
      if (a.isTested && !b.isTested) return 1;
      if (!a.isTested && b.isTested) return -1;
      return new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0);
    });

    // --- 3. FÖRLORAD UTRUSTNING & SVINN DIREKT FRÅN RENTMAN STOCK MOVEMENTS ---
    const rentmanStockLost = [];
    for (const sm of (allStockMovements || [])) {
      if (sm.type !== 'equipment_lost' && sm.type !== 'equipment_found') continue;

      const eqId = extractId(sm.equipment);
      const eqObj = eqId ? (equipMap[eqId] || { name: 'Okänd utrustning', code: '' }) : { name: 'Okänd utrustning', code: '' };
      const crewId = extractId(sm.creator);
      const reporterName = crewId ? (crewMap[crewId] || 'Tekniker') : 'Tekniker';
      const qty = Math.abs(sm.amount || 1);

      let cleanProject = 'Lager';
      const desc = sm.description || '';
      if (desc.toLowerCase().includes('project')) {
        cleanProject = desc.replace(/^.*project\s+/i, '').replace(/\s*\(\d+\).*$/, '').trim();
      } else if (desc.toLowerCase().includes('projekt')) {
        cleanProject = desc.replace(/^.*projekt\s+/i, '').replace(/\s*\(\d+\).*$/, '').trim();
      }

      rentmanStockLost.push({
        id: `sm-${sm.id}`,
        name: eqObj.name,
        model: eqObj.name,
        equipmentCode: eqObj.code,
        category: 'Lager & Gig (Rentman)',
        quantity: qty,
        details: sm.details || sm.description || 'Registrerat som förlorat gods i Rentman',
        project: cleanProject,
        reportedBy: reporterName,
        reportedAt: sm.date || sm.created,
        status: sm.type === 'equipment_found' ? 'found' : 'missing',
        source: 'rentman_stockmovement',
        estimatedCostPerUnit: 0
      });
    }

    const localLost = (localData.lostEquipment || []).map(item => ({
      ...item,
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      model: (item.model || item.name || 'Övrigt').trim(),
      source: 'manual'
    }));

    const allLostEquipment = [...localLost, ...rentmanUnrepairable, ...rentmanStockLost];

    // Sort incident list: missing first, then newest
    allLostEquipment.sort((a, b) => {
      if (a.status === 'missing' && b.status !== 'missing') return -1;
      if (a.status !== 'missing' && b.status === 'missing') return 1;
      return new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0);
    });

    // Grouping by model/equipment type
    const modelGroupsMap = {};
    for (const item of allLostEquipment) {
      const modelKey = (item.model || item.name || 'Övrigt').trim().toLowerCase();
      if (!modelGroupsMap[modelKey]) {
        modelGroupsMap[modelKey] = {
          modelKey,
          modelName: (item.model || item.name || 'Övrigt').trim(),
          category: item.category || 'Övrigt',
          totalQuantity: 0,
          missingQuantity: 0,
          scrappedQuantity: 0,
          foundQuantity: 0,
          totalEstimatedCost: 0,
          reports: []
        };
      }

      const group = modelGroupsMap[modelKey];
      const qty = item.quantity || 1;
      const unitCost = item.estimatedCostPerUnit || 0;

      if (item.status === 'missing') {
        group.missingQuantity += qty;
        group.totalEstimatedCost += unitCost * qty;
      } else if (item.status === 'scrapped') {
        group.scrappedQuantity += qty;
        group.totalEstimatedCost += unitCost * qty;
      } else if (item.status === 'found') {
        group.foundQuantity += qty;
      }

      group.reports.push(item);
    }

    // Calculate net active quantity per model
    for (const group of Object.values(modelGroupsMap)) {
      const netMissing = Math.max(0, group.missingQuantity - group.foundQuantity);
      group.totalQuantity = netMissing + group.scrappedQuantity;
    }

    const lostGroupedByModel = Object.values(modelGroupsMap).filter(g => g.totalQuantity > 0).sort((a, b) => {
      if (b.totalQuantity !== a.totalQuantity) return b.totalQuantity - a.totalQuantity;
      return b.totalEstimatedCost - a.totalEstimatedCost;
    });

    // --- 4. WAREHOUSE & WORKSHOP TASKS ---
    const tasks = [];
    const warehouseKeywords = /lager|pack|packa|utrust|utrustning|test|testa|kabel|podie|stolp|skärm|ljus|ljud|case|rep|repar|hämta|lämna|bil|transport|subhyr|bygga|inköp|service|fixa|städ/i;

    for (const t of allTasks) {
      const sId = extractId(t.status);
      const statusInfo = taskStatusMap[sId] || { name: 'Att göra', isCompleted: false };
      const isCompleted = Boolean(statusInfo.isCompleted || t.completed === true);

      if (isCompleted) {
        const completedDate = t.completed_date || t.modified;
        if (completedDate && isPast(new Date(completedDate))) {
          continue;
        }
      }

      const pId = extractId(t.project);
      const proj = projectMap[pId];

      const assigned = allTaskAssignments
        .filter(ta => extractId(ta.task) === t.id)
        .map(ta => {
          const crewId = extractId(ta.crew);
          return { crewId, name: crewMap[crewId] || 'Okänd' };
        });

      const taskName = t.name || 'Uppgift';
      const isWarehouseRelevant = warehouseKeywords.test(taskName) || warehouseKeywords.test(t.details || '');

      tasks.push({
        id: t.id,
        name: taskName,
        details: cleanHtml(t.details),
        color: t.color || '3b82f6',
        status: statusInfo.name,
        isCompleted,
        priority: t.priority || 'medium',
        deadline: t.deadline,
        projectName: proj ? proj.name : (t.project_name || ''),
        assignedCrew: assigned,
        isWarehouseRelevant
      });
    }

    tasks.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isWarehouseRelevant !== b.isWarehouseRelevant) return a.isWarehouseRelevant ? -1 : 1;
      return new Date(a.deadline || '2099-01-01') - new Date(b.deadline || '2099-01-01');
    });

    // --- KPIS & STATS ---
    const activeRepairsCount = testingAndRepairs.filter(r => !r.isTested).length;
    
    let totalLostQuantity = 0;
    let totalMissingQuantity = 0;
    let totalScrappedQuantity = 0;
    let totalEstimatedLossValue = 0;

    for (const group of lostGroupedByModel) {
      totalLostQuantity += (group.missingQuantity + group.scrappedQuantity);
      totalMissingQuantity += group.missingQuantity;
      totalScrappedQuantity += group.scrappedQuantity;
      totalEstimatedLossValue += group.totalEstimatedCost;
    }

    const openTasksCount = tasks.filter(t => !t.isCompleted).length;
    const toPackTodayCount = toPack.filter(p => (p.timing === 'today' || p.timing === 'overdue_pack') && !p.isPacked).length;
    const toPackTotalCount = toPack.filter(p => !p.isPacked).length;
    const returnsTodayCount = returns.filter(r => r.timing === 'today').length;
    const uncheckedCount = returns.filter(r => r.isUnchecked).length;

    const result = {
      updatedAt: new Date().toISOString(),
      testingAndRepairs,
      lostEquipment: allLostEquipment,
      lostGroupedByModel,
      tasks,
      toPack,
      returns,
      quickNotes: localData.notes || [],
      stats: {
        activeRepairsCount,
        totalLostQuantity,
        totalMissingQuantity,
        totalScrappedQuantity,
        distinctLostModels: lostGroupedByModel.filter(g => (g.missingQuantity + g.scrappedQuantity) > 0).length,
        totalEstimatedLossValue,
        openTasksCount,
        toPackTodayCount,
        toPackTotalCount,
        returnsTodayCount,
        uncheckedCount
      }
    };

    globalThis._warehouseCacheState.data = result;
    globalThis._warehouseCacheState.lastFetch = nowMs;

    return NextResponse.json(result);

  } catch (error) {
    console.error('Warehouse API Error:', error);
    if (globalThis._warehouseCacheState.data) {
      return NextResponse.json({ ...globalThis._warehouseCacheState.data, error: error.message, fromCache: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Invalidate cache on mutations
    globalThis._warehouseCacheState.data = null;

    // 1. REPAIR / TESTING
    if (action === 'toggle_repair_tested') {
      const { repairId, isTested, testedBy, note } = body;
      const res = setRepairTested(repairId, isTested, testedBy, note);
      return NextResponse.json({ success: true, record: res });
    }

    // 2. LOST & MISSING EQUIPMENT
    if (action === 'report_lost_equipment') {
      const { name, model, quantity, category, details, project, reportedBy, estimatedCostPerUnit } = body;
      const res = addLostEquipment({ name, model, quantity, category, details, project, reportedBy, estimatedCostPerUnit });
      return NextResponse.json({ success: Boolean(res), record: res });
    }

    if (action === 'resolve_lost_equipment') {
      const { id, status } = body;
      const res = resolveLostEquipment(id, status);
      return NextResponse.json({ success: Boolean(res), record: res });
    }

    if (action === 'delete_lost_equipment') {
      const { id } = body;
      const ok = deleteLostEquipment(id);
      return NextResponse.json({ success: ok });
    }

    // 3. PRESERVED SUBPROJECT ACTIONS
    if (action === 'toggle_pack') {
      const { subprojectId, isPacked, packedBy } = body;
      const res = setSubprojectPacked(subprojectId, isPacked, packedBy);
      return NextResponse.json({ success: true, record: res });
    }

    if (action === 'toggle_return') {
      const { subprojectId, isReturned, returnedBy } = body;
      const res = setSubprojectReturned(subprojectId, isReturned, returnedBy);
      return NextResponse.json({ success: true, record: res });
    }

    // 4. QUICK NOTES
    if (action === 'add_note') {
      const { text, author } = body;
      const newNote = addWarehouseNote(text, author);
      return NextResponse.json({ success: true, note: newNote });
    }

    if (action === 'toggle_note') {
      const { noteId } = body;
      const note = toggleWarehouseNote(noteId);
      return NextResponse.json({ success: true, note });
    }

    if (action === 'delete_note') {
      const { noteId } = body;
      const ok = deleteWarehouseNote(noteId);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Warehouse POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
