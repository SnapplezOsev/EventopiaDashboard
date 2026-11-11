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
  if (s.includes('avslut') || s.includes('complete')) {
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
 */
export function isReturnedStatus(statusName) {
  if (!statusName) return false;
  const s = statusName.toLowerCase();
  return (
    s.includes('retur') ||
    s.includes('return') ||
    s.includes('åter') ||
    s.includes('ej check') ||
    s.includes('avslut') ||
    s.includes('complete') ||
    s.includes('genomför') ||
    s.includes('execution done') ||
    s.includes('faktur')
  );
}

/**
 * Check if a project/subproject status signifies that equipment is on location ("På plats").
 */
export function isOnLocationStatus(statusName) {
  if (!statusName) return false;
  const s = statusName.toLowerCase();
  return s.includes('plats') || s.includes('location') || s.includes('pågående') || s.includes('in progress');
}

/**
 * Check if a function represents a teardown / pickup / retrieval action (e.g. "Riv", "Hämtning").
 */
export function isTeardownFunction(func) {
  if (!func) return false;
  const text = `${func.name || ''} ${func.functionGroupName || ''}`.toLowerCase();
  
  return (
    text.includes('riv') ||
    text.includes('hämt') ||
    text.includes('retur') ||
    text.includes('åter') ||
    text.includes('avetabler') ||
    text.includes('nedrigg') ||
    text.includes('nerigg') ||
    text.includes('packa ner') ||
    text.includes('nerpack') ||
    text.includes('lasta ur') ||
    text.includes('avlast') ||
    text.includes('hemkör') ||
    text.includes('inkör') ||
    text.includes('derig') ||
    text.includes('de-rig') ||
    text.includes('teardown') ||
    text.includes('tear down') ||
    text.includes('tear-down') ||
    text.includes('strike') ||
    text.includes('load out') ||
    text.includes('load-out') ||
    text.includes('loadout') ||
    text.includes('pickup') ||
    text.includes('pick up') ||
    text.includes('pick-up')
  );
}

/**
 * Check if a function represents a setup / delivery action (e.g. "Rigg", "Leverans").
 */
export function isSetupFunction(func) {
  if (!func) return false;
  // If it also matches teardown (e.g. "Rigg & Riv"), teardown takes priority so it stays active until riv is done
  if (isTeardownFunction(func)) return false;

  const text = `${func.name || ''} ${func.functionGroupName || ''}`.toLowerCase();
  return (
    text.includes('rigg') ||
    text.includes('leveran') ||
    /\blev\b/i.test(text) ||
    text.includes('etabler') ||
    text.includes('transport ut') ||
    text.includes('uttransport') ||
    text.includes('utkör') ||
    text.includes('lämna') ||
    text.includes('packa upp') ||
    text.includes('uppack') ||
    text.includes('lasta på') ||
    text.includes('lasta in') ||
    text.includes('setup') ||
    text.includes('set up') ||
    text.includes('set-up') ||
    text.includes('delivery') ||
    text.includes('load in') ||
    text.includes('load-in') ||
    text.includes('loadin')
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
 * 1. If project is "Åter på lager" / "Retur": ALL functions (rigg, riv, hämtning) are completed,
 *    even if finished earlier than scheduled.
 * 2. If project is "På plats" (On location):
 *    - Upcoming teardown / pickup ("Riv", "Hämtning"): NOT completed! Remains bright/active.
 *    - Setup / delivery ("Rigg", "Leverans"): COMPLETED (gear is confirmed on site).
 *    - Other functions (technicians etc.): COMPLETED if their scheduled shift ended.
 * 3. General fallback: Any function whose scheduled end time has already passed is completed.
 */
export function isFunctionCompleted(func, nowMs = Date.now()) {
  if (!func) return false;

  // Meetings and calendar events are completed when their scheduled end time has passed
  if (func.type === 'appointment' || func.type === 'google_calendar') {
    return isFunctionTimePast(func, nowMs);
  }

  const statusName = func.statusName || '';
  const isReturned = isReturnedStatus(statusName);
  const isOnLocation = isOnLocationStatus(statusName);

  // 1. Returned / back at warehouse -> everything is completed early or on time
  if (isReturned) {
    return true;
  }

  const isTeardown = isTeardownFunction(func);
  const isSetup = isSetupFunction(func);

  // 2. On location ("På plats")
  if (isOnLocation) {
    if (isTeardown) {
      // Upcoming teardown / pickup is NOT completed while project is on site
      return isFunctionTimePast(func, nowMs);
    }
    if (isSetup) {
      // Setup / delivery is completed once project reached the location
      return true;
    }
    // Technicians or other functions during event: done if their shift has ended
    return isFunctionTimePast(func, nowMs);
  }

  // 3. Fallback: done if scheduled end time has passed
  if (isFunctionTimePast(func, nowMs)) {
    return true;
  }

  return false;
}


