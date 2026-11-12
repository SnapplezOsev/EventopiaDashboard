/**
 * Shorten occurrences of "Leverans" to "Lev" (case-preserving).
 * E.g. "Leverans / retur" -> "Lev / retur"
 *      "Leverans" -> "Lev"
 *      "leverans" -> "lev"
 */
export function shortenLeverans(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\bLeverans\b/g, 'Lev')
    .replace(/\bleverans\b/g, 'lev')
    .replace(/\bLEVERANS\b/g, 'LEV');
}

export function getStatusBadgeStyle(status) {
  if (!status) return 'bg-white/10 text-white/70 border-white/20';
  const s = status.toLowerCase();

  if (s.includes('pack')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  }
  if (s.includes('plats') || s.includes('location')) {
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  }
  if (s.includes('pågående') || s.includes('in progress') || s.includes('progress')) {
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  }
  if (s.includes('genomför') || s.includes('execution done') || s.includes('utförande')) {
    return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
  }
  if (s.includes('rundad') || s.includes('avslut') || s.includes('complete')) {
    return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
  if (s.includes('bekräft') || s.includes('confirm')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (s.includes('förslag') || s.includes('pend')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  if (s.includes('förfråg') || s.includes('inquir')) {
    return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  }
  if (s.includes('retur') || s.includes('return')) {
    return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
  }
  if (s.includes('lager') || s.includes('ej check')) {
    return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  }
  if (s.includes('koncept') || s.includes('concept') || s.includes('utkast') || s.includes('draft')) {
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
  if (s.includes('annull') || s.includes('cancel')) {
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  }

  return 'bg-white/10 text-white/70 border-white/20';
}

/**
 * Format event time badge for cards and modals.
 * - Scheduled: "10:00 – 18:00"
 * - Unscheduled with duration & interval: "⏱️ 3h (10:00–18:00)" or "⏱️ 3h (15/10–17/10)"
 * - Unscheduled with duration only: "⏱️ 3h (Obestämd)"
 * - Unscheduled with interval only: "⚠️ Ej tidsatt (10:00–18:00)"
 */
export function formatEventTimeBadge(func) {
  if (!func) return '--:--';

  if (func.isAllDay) {
    return 'Hela dagen';
  }

  if (!func.isUnscheduled) {
    const formatTime = (iso) => {
      if (!iso) return '--:--';
      const d = new Date(iso);
      return isNaN(d) ? '--:--' : d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    };
    return `${formatTime(func.planperiod_start)} – ${formatTime(func.planperiod_end)}`;
  }

  const durStr = func.durationHours ? `${func.durationHours}h` : null;

  if (func.intervalStart && func.intervalEnd) {
    const start = new Date(func.intervalStart);
    const end = new Date(func.intervalEnd);
    const isSameDay = !isNaN(start) && !isNaN(end) && start.toDateString() === end.toDateString();

    let intervalStr = '';
    if (isSameDay) {
      const sTime = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      const eTime = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      intervalStr = `${sTime}–${eTime}`;
    } else if (!isNaN(start) && !isNaN(end)) {
      const sDate = `${start.getDate()}/${start.getMonth() + 1}`;
      const eDate = `${end.getDate()}/${end.getMonth() + 1}`;
      intervalStr = `${sDate}–${eDate}`;
    }

    if (durStr && intervalStr) {
      return `⏱️ ${durStr} (${intervalStr})`;
    } else if (durStr) {
      return `⏱️ ${durStr}`;
    } else if (intervalStr) {
      return `⚠️ Ej tidsatt (${intervalStr})`;
    }
  }

  if (durStr) {
    return `⏱️ ${durStr} (Obestämd)`;
  }
  return '⚠️ Obestämd tid';
}

/**
 * Format full date range in Swedish (e.g. "15 okt 10:00 – 17 okt 23:00")
 */
export function formatFullDateRange(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  if (isNaN(start)) return '';

  const sDate = start.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  const sTime = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  if (isNaN(end) || start.toDateString() === end.toDateString()) {
    const eTime = !isNaN(end) ? end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : sTime;
    return `${sDate} ${sTime} – ${eTime}`;
  }

  const eDate = end.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  const eTime = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  return `${sDate} ${sTime} – ${eDate} ${eTime}`;
}

/**
 * Check if a project/subproject status signifies that equipment is back at warehouse / returned.
 * In Rentman:
 * - "Execution done" can only be set once all equipment is "Returned".
 * - "Rundad" / "Avslutad" means the project is completed.
 */
export function isReturnedStatus(statusName, warehouseStatus) {
  const s = `${statusName || ''} ${warehouseStatus || ''}`.toLowerCase();
  return (
    s.includes('execution done') ||
    s.includes('genomför') ||
    s.includes('rundad') ||
    s.includes('avslut') ||
    s.includes('complete') ||
    s.includes('retur') ||
    s.includes('return') ||
    s.includes('åter') ||
    s.includes('ej check') ||
    s.includes('1004') ||
    s.includes('faktur')
  );
}

/**
 * Check if a project/subproject status signifies that equipment is on location ("På plats").
 */
export function isOnLocationStatus(statusName, warehouseStatus) {
  const s = `${statusName || ''} ${warehouseStatus || ''}`.toLowerCase();
  return s.includes('plats') || s.includes('location');
}

/**
 * Check if a function represents a teardown / pickup / retrieval action (e.g. "Riv", "Hämtning").
 * Checks both functionGroupName and name, giving highest priority to explicit group names
 * (so that transport articles like "Leverans/Retur" in a "Lev"-group are treated as setup,
 * while in a "Retur"-group they are treated as teardown).
 */
export function isTeardownFunction(func) {
  if (!func) return false;
  const group = (func.functionGroupName || '').toLowerCase();
  const name = (func.name || '').toLowerCase();

  const isSetupGroup =
    group.includes('rigg') ||
    group.includes('leveran') ||
    /\blev\b/i.test(group) ||
    group.includes('etabler') ||
    group.includes('setup') ||
    group.includes('load in') ||
    group.includes('utkör');

  const isTeardownGroup =
    group.includes('riv') ||
    group.includes('hämt') ||
    group.includes('retur') ||
    group.includes('avetabler') ||
    group.includes('nedrigg') ||
    group.includes('nerigg') ||
    group.includes('derig') ||
    group.includes('strike') ||
    group.includes('load out');

  // If function group explicitly indicates phase, the group takes highest priority
  if (isTeardownGroup && !isSetupGroup) return true;
  if (isSetupGroup && !isTeardownGroup) return false;

  // Transport article like "Leverans/Retur 10-16" without explicit teardown group is a delivery/setup
  if (name.includes('leveran') && name.includes('retur')) {
    return false;
  }

  return (
    name.includes('riv') ||
    name.includes('hämt') ||
    name.includes('retur') ||
    name.includes('åter') ||
    name.includes('avetabler') ||
    name.includes('nedrigg') ||
    name.includes('nerigg') ||
    name.includes('packa ner') ||
    name.includes('nerpack') ||
    name.includes('lasta ur') ||
    name.includes('avlast') ||
    name.includes('hemkör') ||
    name.includes('inkör') ||
    name.includes('derig') ||
    name.includes('de-rig') ||
    name.includes('teardown') ||
    name.includes('tear down') ||
    name.includes('tear-down') ||
    name.includes('strike') ||
    name.includes('load out') ||
    name.includes('load-out') ||
    name.includes('loadout') ||
    name.includes('pickup') ||
    name.includes('pick up') ||
    name.includes('pick-up')
  );
}

/**
 * Check if a function represents a setup / delivery action (e.g. "Rigg", "Leverans").
 */
export function isSetupFunction(func) {
  if (!func) return false;
  const group = (func.functionGroupName || '').toLowerCase();
  const name = (func.name || '').toLowerCase();

  const isSetupGroup =
    group.includes('rigg') ||
    group.includes('leveran') ||
    /\blev\b/i.test(group) ||
    group.includes('etabler') ||
    group.includes('setup') ||
    group.includes('load in') ||
    group.includes('utkör');

  const isTeardownGroup =
    group.includes('riv') ||
    group.includes('hämt') ||
    group.includes('retur') ||
    group.includes('avetabler') ||
    group.includes('nedrigg') ||
    group.includes('nerigg') ||
    group.includes('derig') ||
    group.includes('strike') ||
    group.includes('load out');

  // If function group explicitly indicates phase, the group takes highest priority
  if (isSetupGroup && !isTeardownGroup) return true;
  if (isTeardownGroup && !isSetupGroup) return false;

  // If name matches teardown keywords, teardown takes priority
  if (isTeardownFunction(func)) return false;

  return (
    name.includes('rigg') ||
    name.includes('leveran') ||
    /\blev\b/i.test(name) ||
    name.includes('etabler') ||
    name.includes('transport ut') ||
    name.includes('uttransport') ||
    name.includes('utkör') ||
    name.includes('lämna') ||
    name.includes('packa upp') ||
    name.includes('uppack') ||
    name.includes('lasta på') ||
    name.includes('lasta in') ||
    name.includes('setup') ||
    name.includes('set up') ||
    name.includes('set-up') ||
    name.includes('delivery') ||
    name.includes('load in') ||
    name.includes('load-in') ||
    name.includes('loadin')
  );
}

/**
 * Check if a function's scheduled time has already ended in real-time.
 */
export function isFunctionTimePast(func, nowMs = Date.now()) {
  if (!func) return false;
  const endTimeStr = func.planperiod_end || func.intervalEnd || func.planperiod_start;
  if (!endTimeStr) return false;
  const end = new Date(endTimeStr);
  if (isNaN(end.getTime()) || end.getFullYear() < 2000) return false;
  return end.getTime() < nowMs;
}

/**
 * Condition-based function completion:
 *
 * 1. Project-level completion:
 *    - In Rentman, "Execution done" can only be set when all equipment is "Returned".
 *    - "Rundad" / "Avslutad" means the project is wrapped up and completed.
 *    - In these cases, all functions in the project are completed early or on time.
 *
 * 2. Equipment is back at warehouse (warehouse status is "Returnerad" or "Åter på lager / Ej checkade"):
 *    - Setup / delivery and Teardown / pickup are both completed!
 *    - Regular crew / technicians during event: completed if their scheduled shift has ended.
 *
 * 3. Teardown / Pickup ("Riv", "Hämtning", "Returtransport"):
 *    - If equipment is still "På plats" or "Packad", teardown is NOT completed!
 *      The card stays bright and active even if the scheduled clock time has passed.
 *    - If project has no tracked equipment: completed if scheduled end time has passed.
 *
 * 4. Setup / Delivery ("Rigg", "Leverans", "Transport ut"):
 *    - If equipment is "På plats" (or returned): completed (gear is confirmed on site).
 *    - If equipment is still "Packade" in the warehouse: NOT completed!
 *      (Rentman sets project to "In progress" once packed, but rigg/delivery stays active until on site).
 *    - If project has no tracked equipment: completed if scheduled end time has passed.
 *
 * 5. General crew / Technicians / DJ / Shifts during the event:
 *    - Completed if their scheduled shift end time has passed.
 *
 * 6. Appointments & Google Calendar:
 *    - Completed if scheduled end time has passed.
 */
export function isFunctionCompleted(func, nowMs = Date.now()) {
  if (!func) return false;

  // Appointments, Google Calendar events, and internal shifts
  if (func.type === 'appointment' || func.type === 'google_calendar') {
    return isFunctionTimePast(func, nowMs);
  }

  const statusName = (func.statusName || '').toLowerCase();
  const warehouseStatus = (func.warehouseStatus || '').toLowerCase();

  // 1. Project-level completion:
  // "Execution done" requires equipment to be "Returned" in Rentman.
  // "Rundad" / "Avslutad" represents fully wrapped up projects.
  if (
    statusName.includes('execution done') ||
    statusName.includes('genomför') ||
    statusName.includes('rundad') ||
    statusName.includes('avslut') ||
    statusName.includes('complete') ||
    statusName.includes('faktur')
  ) {
    return true;
  }

  const isTeardown = isTeardownFunction(func);
  const isSetup = isSetupFunction(func);

  const isReturnedGear =
    warehouseStatus.includes('retur') ||
    warehouseStatus.includes('åter') ||
    warehouseStatus.includes('ej check') ||
    warehouseStatus.includes('1004') ||
    warehouseStatus.includes('returned');

  const isOnLocationGear =
    warehouseStatus.includes('plats') ||
    warehouseStatus.includes('location');

  const isPackedGear =
    warehouseStatus.includes('pack');

  // 2. Equipment is back at warehouse (Returnerad or Åter på lager / Ej checkade)
  if (isReturnedGear) {
    if (isSetup || isTeardown) {
      return true;
    }
    return isFunctionTimePast(func, nowMs);
  }

  // 3. Teardown / Pickup ("Riv", "Hämtning")
  if (isTeardown) {
    // If equipment is still on location or packed, teardown cannot be completed yet!
    if (isOnLocationGear || isPackedGear) {
      return false;
    }
    // Fallback if no equipment is tracked on this project: completed if shift ended
    return isFunctionTimePast(func, nowMs);
  }

  // 4. Setup / Delivery ("Rigg", "Leverans")
  if (isSetup) {
    // Equipment is confirmed on location
    if (isOnLocationGear) {
      return true;
    }
    // Equipment is still packed in warehouse (even if project is "In progress")
    if (isPackedGear) {
      return false;
    }
    // Fallback if no equipment is tracked on this project
    return isFunctionTimePast(func, nowMs);
  }

  // 5. Operating crew / Technicians / shifts during the event
  if (isFunctionTimePast(func, nowMs)) {
    return true;
  }

  return false;
}

/**
 * Get display info (label, icon, badge styling) for physical warehouse / equipment status.
 */
export function getWarehouseStatusInfo(warehouseStatus) {
  if (!warehouseStatus || typeof warehouseStatus !== 'string') return null;
  const s = warehouseStatus.toLowerCase();

  // Check 'ej check' / '1004' BEFORE 'retur'/'åter' so that "Åter på lager / Ej checkade" matches unchecked!
  if (s.includes('ej check') || s.includes('unchecked') || s.includes('1004')) {
    return {
      key: 'unchecked',
      label: 'Ej checkade',
      icon: '⚠️',
      badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      dotClass: 'bg-orange-400',
    };
  }
  if (s.includes('pack')) {
    return {
      key: 'packed',
      label: 'Packad',
      icon: '📦',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      dotClass: 'bg-purple-400',
    };
  }
  if (s.includes('plats') || s.includes('location')) {
    return {
      key: 'on_location',
      label: 'På plats',
      icon: '📍',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      dotClass: 'bg-indigo-400',
    };
  }
  if (s.includes('retur') || s.includes('return') || s.includes('åter')) {
    return {
      key: 'returned',
      label: 'Åter på lager',
      icon: '↩️',
      badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      dotClass: 'bg-teal-400',
    };
  }

  return null;
}


