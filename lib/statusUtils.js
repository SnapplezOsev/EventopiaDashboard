export function getStatusBadgeStyle(status) {
  if (!status) return 'bg-white/10 text-white/70 border-white/20';
  const s = status.toLowerCase();

  if (s.includes('pack')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  }
  if (s.includes('plats') || s.includes('location')) {
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
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
  if (s.includes('koncept') || s.includes('concept')) {
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

