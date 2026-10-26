// Helper functions for ISO week calculations, dates, and week navigation

export function getWeekDetails(offset = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7);
  const day = target.getDay() || 7;
  const monday = new Date(target.getFullYear(), target.getMonth(), target.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO-8601 week number
  const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  const weekStr = `${year}-W${String(weekNum).padStart(2, '0')}`;

  const formatIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  return {
    monday,
    sunday,
    weekStart: monday,
    weekEnd: sunday,
    weekNum,
    year,
    weekStr,
    weekStartStr: formatIsoDate(monday),
    weekEndStr: formatIsoDate(sunday)
  };
}

export function parseWeekString(weekStr) {
  if (!weekStr) return getWeekDetails(0);
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0], 10);
  const weekNum = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(weekNum)) return getWeekDetails(0);

  // 4th of January is always in week 1
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1));
  week1Monday.setHours(0, 0, 0, 0);

  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  return {
    monday,
    sunday,
    weekStart: monday,
    weekEnd: sunday,
    weekNum,
    year,
    weekStr,
    weekStartStr: formatIsoDate(monday),
    weekEndStr: formatIsoDate(sunday)
  };
}
