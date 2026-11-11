import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { formatEventTimeBadge, formatFullDateRange, shortenLeverans } from './statusUtils.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEY_FILE = path.join(DATA_DIR, 'google-service-account.json');
const CONFIG_FILE = path.join(DATA_DIR, 'calendar-config.json');
const STATUS_FILE = path.join(DATA_DIR, 'calendar-status.json');

/**
 * Get Google Calendar configuration (Calendar ID and Service Account)
 */
export function getCalendarConfig() {
  let calendarId = process.env.GOOGLE_CALENDAR_ID || '';
  let serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  let hasKey = Boolean(process.env.GOOGLE_PRIVATE_KEY);

  // Check data/calendar-config.json
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.calendarId) calendarId = cfg.calendarId;
    } catch (e) {}
  }

  // Check data/google-service-account.json
  if (fs.existsSync(KEY_FILE)) {
    try {
      const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      if (keyData.client_email) serviceAccountEmail = keyData.client_email;
      if (keyData.private_key) hasKey = true;
    } catch (e) {}
  }

  return {
    calendarId,
    serviceAccountEmail,
    isConfigured: Boolean(calendarId && serviceAccountEmail && hasKey),
  };
}

/**
 * Save Google Calendar config (e.g. Calendar ID)
 */
export function saveCalendarConfig(newConfig) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    let current = {};
    if (fs.existsSync(CONFIG_FILE)) {
      try { current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
    }
    const merged = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (err) {
    console.error('Error saving calendar config:', err.message);
    throw err;
  }
}

/**
 * Get Google Auth JWT Client
 */
function getGoogleAuthClient() {
  // 1. Try JSON file first
  if (fs.existsSync(KEY_FILE)) {
    try {
      const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      if (keyData.client_email && keyData.private_key) {
        return new google.auth.JWT({
          email: keyData.client_email,
          key: keyData.private_key,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
      }
    } catch (e) {
      console.warn('Could not parse google-service-account.json:', e.message);
    }
  }

  // 2. Try environment variables
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (email && privateKey) {
    return new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  return null;
}

/**
 * Convert Eventopia item ID to valid Google Calendar Event ID
 * Google event IDs must be lowercase base32hex [a-v0-9] and between 5 and 1024 chars
 */
export function toGoogleEventId(rawId) {
  const str = String(rawId).toLowerCase();
  if (str.startsWith('app-')) {
    const num = str.replace(/\D/g, '') || '0';
    return `app${num.padStart(4, '0')}`;
  }
  const cleanNum = str.replace(/\D/g, '');
  if (cleanNum) {
    return `fn${cleanNum.padStart(4, '0')}`;
  }
  // Fallback hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `evt${Math.abs(hash).toString(32).padStart(5, '0')}`;
}

/**
 * Generate a deterministic valid Google Calendar event ID for a function group session.
 * Base32hex format: only lowercase [a-v0-9], 5-1024 characters.
 */
export function toGoogleGroupEventId(groupId, dateStr, timeStr = '') {
  const cleanGroup = String(groupId || '0').replace(/\D/g, '');
  const cleanDate = String(dateStr || '').replace(/\D/g, '');
  const cleanTime = String(timeStr || '').replace(/\D/g, '');
  const base = `grp${cleanGroup}d${cleanDate}${cleanTime ? `t${cleanTime}` : ''}`;
  if (base.length >= 5 && base.length <= 1024 && /^[a-v0-9]+$/.test(base)) {
    return base;
  }
  // Fallback hash for alphanumeric identifiers
  let hash = 0;
  const str = `group_${groupId}_${dateStr}_${timeStr}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `grp${Math.abs(hash).toString(32).padStart(6, '0')}`;
}

/**
 * Group schedule functions for calendar sync.
 * If 2 or more functions belong to the same project & function group and share the SAME times,
 * they are merged into a single calendar item with details in the description.
 * If functions in a group have different times, they remain individual calendar events.
 */
export function groupFunctionsForCalendar(functions = []) {
  const groupsMap = new Map();
  const standalone = [];

  for (const f of functions) {
    // Only group functions if they have a functionGroupId (or functionGroupName) and are not appointments or unscheduled
    if (f.type === 'appointment' || f.isUnscheduled || (!f.functionGroupId && !f.functionGroupName)) {
      standalone.push({ type: 'single', func: f });
      continue;
    }

    const startMinute = Math.floor(new Date(f.planperiod_start).getTime() / 60000);
    const endMinute = Math.floor(new Date(f.planperiod_end || f.planperiod_start).getTime() / 60000);

    // Group only functions that share project, function group, AND identical start & end times
    const groupKey = `${f.projectId || f.projectName || 'proj'}_${f.functionGroupId || f.functionGroupName}_${startMinute}_${endMinute}`;
    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey).push(f);
  }

  const calendarItems = [...standalone];

  for (const [key, groupFuncs] of groupsMap.entries()) {
    if (groupFuncs.length >= 2) {
      calendarItems.push({
        type: 'group',
        functions: groupFuncs,
      });
    } else {
      calendarItems.push({
        type: 'single',
        func: groupFuncs[0],
      });
    }
  }

  return calendarItems;
}

/**
 * Build Google Calendar Event Payload for a Grouped Function Event
 */
export function buildGroupEventPayload(cluster) {
  const first = cluster[0];
  const groupName = shortenLeverans(first.functionGroupName || 'Grupp');
  const projectName = shortenLeverans(first.projectName || '');

  // Calculate earliest start and latest end
  const startTimes = cluster.map(f => new Date(f.planperiod_start).getTime());
  const endTimes = cluster.map(f => new Date(f.planperiod_end || f.planperiod_start).getTime());
  const earliestStart = new Date(Math.min(...startTimes));
  const latestEnd = new Date(Math.max(...endTimes));

  // Date formatted in Stockholm time YYYYMMDD
  const dateStr = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(earliestStart).replace(/\D/g, '');

  const startHourMin = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Stockholm',
  }).format(earliestStart).replace(/\D/g, '');

  const endHourMin = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Stockholm',
  }).format(latestEnd).replace(/\D/g, '');

  const eventId = toGoogleGroupEventId(
    first.functionGroupId || first.functionGroupName, 
    dateStr,
    `${startHourMin}${endHourMin}`
  );

  // Short summary: [Riv] ProjectName (or [Riv])
  let summary = '';
  if (projectName) {
    summary = `[${groupName}] ${projectName}`;
  } else {
    summary = `[${groupName}]`;
  }

  // Description details
  const totalRequired = cluster.reduce((sum, f) => sum + (f.amount || 1), 0);
  const totalAssigned = cluster.reduce((sum, f) => sum + (f.assignedCrew?.length || 0), 0);
  const allVehicles = Array.from(new Set(cluster.flatMap(f => f.vehicleNames || []))).filter(Boolean);
  const allLocations = Array.from(new Set(cluster.map(f => f.locationName).filter(Boolean)));
  const primaryLocation = allLocations.join(' / ') || first.locationName || '';

  const formatTime = (iso) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return isNaN(d) ? '--:--' : d.toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Europe/Stockholm'
    });
  };

  const functionDetails = cluster.map(f => {
    const fnName = shortenLeverans(f.name);
    const timeStr = f.isUnscheduled 
      ? formatEventTimeBadge(f) 
      : `${formatTime(f.planperiod_start)} – ${formatTime(f.planperiod_end)}`;
    const req = f.amount || 1;
    const assigned = f.assignedCrew?.length || 0;
    const crewLines = (f.assignedCrew || []).map(c => 
      `    • ${c.name} (${c.category === 'internal' ? 'Intern' : 'Frilans'})`
    ).join('\n');

    const lines = [
      `⚙️ ${fnName} (${timeStr})`,
      `  Personal (${assigned}/${req}):`,
      crewLines || (f.isUnscheduled ? '    • Kan ej tilldelas förrän tider har satts i Rentman' : '    • Ingen personal tilldelad än'),
    ];

    if (f.vehicleNames?.length) {
      lines.push(`  🚚 Fordon: ${f.vehicleNames.join(', ')}`);
    }
    if (f.remark) {
      lines.push(`  💬 Anteckning: ${f.remark}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const descParts = [
    projectName ? `📌 Projekt: ${projectName}` : '📌 Typ: Internt skift',
    `📁 Funktionsgrupp: ${groupName}`,
    first.customerName ? `👤 Kund: ${first.customerName}` : null,
    primaryLocation ? `📍 Plats: ${primaryLocation}` : null,
    first.statusName && projectName ? `🏷️ Status: ${first.statusName}` : null,
    allVehicles.length ? `🚚 Fordon totalt: ${allVehicles.join(', ')}` : null,
    '',
    `👥 Personal totalt (${totalAssigned}/${totalRequired}):`,
    '',
    `📋 Funktioner i gruppen (${cluster.length} st):`,
    '────────────────────',
    functionDetails,
    '',
    '───',
    'Eventopia Dashboard Schemasynk',
  ].filter(line => line !== null).join('\n');

  // Google Calendar color ID (1=Lavender, 2=Sage/Green, 6=Tangerine/Orange, 7=Peacock/Cyan, 11=Tomato/Red)
  const hasUnscheduled = cluster.some(f => f.isUnscheduled);
  let colorId = '7'; // Peacock cyan
  if (hasUnscheduled) colorId = '6'; // Orange warning
  else if (totalAssigned >= totalRequired) colorId = '2'; // Sage green when fully staffed
  else if (totalAssigned === 0) colorId = '11'; // Tomato red when unstaffed

  return {
    id: eventId,
    summary,
    description: descParts,
    location: primaryLocation,
    colorId,
    start: {
      dateTime: earliestStart.toISOString(),
      timeZone: 'Europe/Stockholm',
    },
    end: {
      dateTime: latestEnd.toISOString(),
      timeZone: 'Europe/Stockholm',
    },
    extendedProperties: {
      private: {
        source: 'eventopia-dashboard',
        isGroup: 'true',
        functionGroupId: String(first.functionGroupId || ''),
        functionIds: cluster.map(f => String(f.id)).join(','),
      },
    },
  };
}

/**
 * Build Google Calendar Event Payload for a Single Function / Item
 */
export function buildSingleEventPayload(func) {
  const eventId = toGoogleEventId(func.id);
  const cleanName = shortenLeverans(func.name);
  const cleanProj = shortenLeverans(func.projectName);
  const cleanGroup = shortenLeverans(func.functionGroupName);

  // Summary (Title)
  let summary = '';
  if (func.isUnscheduled) {
    const timeBadge = formatEventTimeBadge(func);
    if (cleanGroup) {
      const isRedundant = cleanName.toLowerCase() === cleanGroup.toLowerCase();
      summary = `${timeBadge} [${cleanGroup}] ${cleanProj ? `${cleanProj}${isRedundant ? '' : ` – ${cleanName}`}` : cleanName}`.trim();
    } else {
      summary = `${timeBadge} ${cleanProj ? `${cleanProj} – ` : ''}${cleanName}`;
    }
  } else if (func.type === 'appointment') {
    summary = `Möte: ${cleanName}`;
  } else if (cleanGroup) {
    // Check if name duplicates group (e.g. Group: [Riv], Name: Riv)
    const isRedundant = cleanName.toLowerCase() === cleanGroup.toLowerCase();
    if (isRedundant) {
      summary = `[${cleanGroup}] ${cleanProj}`.trim();
    } else {
      summary = `[${cleanGroup}] ${cleanProj ? `${cleanProj} – ` : ''}${cleanName}`;
    }
  } else if (cleanProj) {
    summary = `${cleanProj} – ${cleanName}`;
  } else {
    summary = cleanName;
  }

  // Description
  const assignedCount = func.assignedCrew?.length || 0;
  const requiredAmount = func.amount || 1;
  const crewLines = (func.assignedCrew || []).map(c => 
    `• ${c.name} (${c.category === 'internal' ? 'Intern' : 'Frilans'})`
  ).join('\n');

  const isAppointment = func.type === 'appointment';
  const isInternalShift = !cleanProj || func.type === 'shift' || func.isInternalShift;

  const descParts = [
    func.isUnscheduled ? '⚠️ OBS: Denna funktion saknar fasta timmar på Rentmans tidslinje och kan inte tilldelas på personal förrän den schemalagts i Rentman.' : null,
    func.durationHours ? `⏱️ Beräknad arbetstid: ${func.durationHours} timmar` : null,
    func.intervalStart && func.intervalEnd ? `📅 Tillåtet tidsintervall / Period: ${formatFullDateRange(func.intervalStart, func.intervalEnd)}` : null,
    cleanProj ? `📌 Projekt: ${cleanProj}` : '📌 Typ: Internt skift',
    cleanGroup ? `📁 Funktionsgrupp: ${cleanGroup}` : null,
    `⚙️ Funktion: ${cleanName}`,
    func.statusName && !isAppointment && !isInternalShift ? `🏷️ Status: ${func.statusName}` : null,
    func.customerName ? `👤 Kund: ${func.customerName}` : null,
    func.locationName ? `📍 Plats: ${func.locationName}` : null,
    func.vehicleNames?.length ? `🚚 Fordon: ${func.vehicleNames.join(', ')}` : null,
    func.remark ? `💬 Anteckning: ${func.remark}` : null,
    '',
    isAppointment 
      ? '👥 Tilldelade personer:'
      : `👥 Personal (${assignedCount}/${requiredAmount}):`,
    crewLines || (isAppointment 
      ? '• Ingen person tilldelad än' 
      : (func.isUnscheduled ? '• Kan ej tilldelas förrän tider har satts i Rentman' : '• Ingen personal tilldelad än')),
    '',
    '───',
    'Eventopia Dashboard Schemasynk',
  ].filter(line => line !== null).join('\n');

  // Dates
  const startIso = func.planperiod_start;
  const endIso = func.planperiod_end || func.planperiod_start;

  // Google Calendar color ID (1=Lavender, 2=Sage/Green, 6=Tangerine/Orange, 7=Peacock/Cyan, 11=Tomato/Red)
  let colorId = '7'; // default Peacock cyan
  if (func.isUnscheduled) colorId = '6'; // Orange warning
  else if (func.type === 'appointment') colorId = '6'; // Orange
  else if (assignedCount >= requiredAmount) colorId = '2'; // Sage green when fully staffed
  else if (assignedCount === 0) colorId = '11'; // Tomato red when unstaffed

  const startProp = func.isAllDay 
    ? { date: String(startIso).split('T')[0] }
    : { dateTime: new Date(startIso).toISOString(), timeZone: 'Europe/Stockholm' };
  const endProp = func.isAllDay 
    ? { date: String(endIso).split('T')[0] }
    : { dateTime: new Date(endIso).toISOString(), timeZone: 'Europe/Stockholm' };

  return {
    id: eventId,
    summary,
    description: descParts,
    location: func.locationName || '',
    colorId,
    start: startProp,
    end: endProp,
    extendedProperties: {
      private: {
        source: 'eventopia-dashboard',
        functionId: String(func.id),
      },
    },
  };
}

/**
 * Backward compatibility alias
 */
function buildEventPayload(func) {
  return buildSingleEventPayload(func);
}

/**
 * Sync schedule events to Google Calendar.
 * Supports grouping functions in the same project & function group into a single event,
 * clean and short summaries, and automatic deletion of obsolete single events.
 */
export async function syncScheduleToGoogle(functions = [], options = {}) {
  const cfg = getCalendarConfig();
  if (!cfg.isConfigured) {
    throw new Error('Google Kalender är inte konfigurerad. Ange Kalender-ID och Service Account-nyckel.');
  }

  const auth = getGoogleAuthClient();
  if (!auth) {
    throw new Error('Kunde inte autentisera mot Google. Kontrollera service account-uppgifterna.');
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = cfg.calendarId;

  // 1. Filter valid schedule items
  const validFunctions = (functions || []).filter(f => {
    if (!f.planperiod_start) return false;
    // Skip events originating from Google Calendar to avoid sync loops
    if (f.source === 'google_calendar' || String(f.id).startsWith('gcal-')) return false;
    const start = new Date(f.planperiod_start);
    return !isNaN(start.getTime()) && start.getFullYear() >= 2000;
  });

  // 2. Group functions into calendar items (groups and singles)
  const calendarItems = groupFunctionsForCalendar(validFunctions);

  // 3. Build payloads
  const payloads = calendarItems.map(item => {
    if (item.type === 'group') {
      return buildGroupEventPayload(item.functions);
    }
    return buildSingleEventPayload(item.func);
  });

  const targetEventIds = new Set(payloads.map(p => p.id));

  // 4. Delete old individual events for functions that are now part of a group, plus canceled functions
  const obsoleteEventIds = new Set();
  for (const item of calendarItems) {
    if (item.type === 'group') {
      for (const fn of item.functions) {
        const oldId = toGoogleEventId(fn.id);
        if (!targetEventIds.has(oldId)) {
          obsoleteEventIds.add(oldId);
        }
      }
    }
  }

  // Explicitly add any known canceled function single IDs
  if (Array.isArray(options.canceledFunctions)) {
    for (const cf of options.canceledFunctions) {
      const singleId = toGoogleEventId(cf.id);
      if (!targetEventIds.has(singleId)) {
        obsoleteEventIds.add(singleId);
      }
    }
  }

  // 4b. Scan Google Calendar for existing events in the sync time window and delete any deleted/canceled events
  let syncTimeMin = options.timeMin ? new Date(options.timeMin).getTime() : null;
  let syncTimeMax = options.timeMax ? new Date(options.timeMax).getTime() : null;

  for (const f of [...validFunctions, ...(options.canceledFunctions || [])]) {
    const s = new Date(f.planperiod_start).getTime();
    const e = new Date(f.planperiod_end || f.planperiod_start).getTime();
    if (!isNaN(s) && (syncTimeMin === null || s < syncTimeMin)) syncTimeMin = s;
    if (!isNaN(e) && (syncTimeMax === null || e > syncTimeMax)) syncTimeMax = e;
  }

  if (syncTimeMin !== null && syncTimeMax !== null) {
    // 2-day buffer on either side
    const padMin = new Date(syncTimeMin - 2 * 24 * 3600 * 1000).toISOString();
    const padMax = new Date(syncTimeMax + 2 * 24 * 3600 * 1000).toISOString();

    try {
      const existingRes = await calendar.events.list({
        calendarId,
        timeMin: padMin,
        timeMax: padMax,
        singleEvents: true,
        maxResults: 250,
      });

      const existingItems = existingRes.data.items || [];
      for (const item of existingItems) {
        const isFromDashboard = 
          item.extendedProperties?.private?.source === 'eventopia-dashboard' ||
          item.id?.startsWith('fn') ||
          item.id?.startsWith('grp') ||
          item.id?.startsWith('app');

        if (isFromDashboard && !targetEventIds.has(item.id)) {
          obsoleteEventIds.add(item.id);
        }
      }
    } catch (listErr) {
      console.warn('Could not query Google Calendar for obsolete events cleanup:', listErr.message);
    }
  }

  for (const oldId of obsoleteEventIds) {
    try {
      await calendar.events.delete({ calendarId, eventId: oldId });
    } catch (e) {
      // 404/410 means already deleted or not existing
    }
  }

  // 5. Upsert target events
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const payload of payloads) {
    const eventId = payload.id;
    const requestBody = {
      id: payload.id,
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      colorId: payload.colorId,
      start: payload.start,
      end: payload.end,
      extendedProperties: payload.extendedProperties,
    };

    try {
      // Try updating existing event
      await calendar.events.update({
        calendarId,
        eventId,
        requestBody,
      });
      updated++;
    } catch (err) {
      if (err.code === 404) {
        // Event does not exist yet -> create it
        try {
          await calendar.events.insert({
            calendarId,
            requestBody,
          });
          created++;
        } catch (insertErr) {
          console.warn(`Failed to insert event ${eventId}:`, insertErr.message);
          failed++;
        }
      } else {
        console.warn(`Failed to update event ${eventId}:`, err.message);
        failed++;
      }
    }
  }

  const result = {
    syncedAt: new Date().toISOString(),
    created,
    updated,
    failed,
    total: payloads.length,
    calendarId,
  };

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(result, null, 2), 'utf8');
  } catch (e) {}

  return result;
}

/**
 * Get last sync status
 */
export function getLastSyncStatus() {
  if (fs.existsSync(STATUS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    } catch (e) {}
  }
  return null;
}

/**
 * Fetch calendar events directly from Google Calendar for a date range.
 * Returns raw items from Google Calendar API.
 */
export async function getGoogleCalendarEvents(timeMin, timeMax) {
  const cfg = getCalendarConfig();
  if (!cfg.isConfigured) {
    return [];
  }

  const auth = getGoogleAuthClient();
  if (!auth) {
    return [];
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = cfg.calendarId;

  const timeMinIso = typeof timeMin === 'string'
    ? (timeMin.includes('T') ? timeMin : `${timeMin}T00:00:00Z`)
    : (timeMin instanceof Date ? timeMin.toISOString() : new Date(timeMin).toISOString());

  const timeMaxIso = typeof timeMax === 'string'
    ? (timeMax.includes('T') ? timeMax : `${timeMax}T23:59:59Z`)
    : (timeMax instanceof Date ? timeMax.toISOString() : new Date(timeMax).toISOString());

  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    return res.data.items || [];
  } catch (err) {
    console.warn('Error fetching Google Calendar events:', err.message);
    return [];
  }
}

/**
 * Delete an event from Google Calendar by ID.
 */
export async function deleteGoogleCalendarEvent(eventId) {
  const cfg = getCalendarConfig();
  if (!cfg.isConfigured) return false;

  const auth = getGoogleAuthClient();
  if (!auth) return false;

  const calendar = google.calendar({ version: 'v3', auth });
  const rawId = String(eventId).replace('gcal-', '');
  try {
    await calendar.events.delete({
      calendarId: cfg.calendarId,
      eventId: rawId,
    });
    return true;
  } catch (err) {
    if (err.code === 404 || err.code === 410) return true; // Already deleted
    console.warn(`Failed to delete Google Calendar event ${rawId}:`, err.message);
    return false;
  }
}

/**
 * Update / patch an existing event in Google Calendar.
 */
export async function updateGoogleCalendarEvent(eventId, updateData = {}) {
  const cfg = getCalendarConfig();
  if (!cfg.isConfigured) throw new Error('Google Kalender är inte konfigurerad');

  const auth = getGoogleAuthClient();
  if (!auth) throw new Error('Kunde inte autentisera mot Google');

  const calendar = google.calendar({ version: 'v3', auth });
  const rawId = String(eventId).replace('gcal-', '');

  const requestBody = {};
  if (updateData.name) requestBody.summary = updateData.name;
  if (updateData.location !== undefined) requestBody.location = updateData.location;
  if (updateData.remark !== undefined) requestBody.description = updateData.remark;

  if (updateData.start) {
    const sDate = new Date(updateData.start);
    if (!isNaN(sDate.getTime())) {
      requestBody.start = {
        dateTime: sDate.toISOString(),
        timeZone: 'Europe/Stockholm',
      };
    }
  }

  if (updateData.end) {
    const eDate = new Date(updateData.end);
    if (!isNaN(eDate.getTime())) {
      requestBody.end = {
        dateTime: eDate.toISOString(),
        timeZone: 'Europe/Stockholm',
      };
    }
  }

  try {
    const res = await calendar.events.patch({
      calendarId: cfg.calendarId,
      eventId: rawId,
      requestBody,
    });
    return res.data;
  } catch (err) {
    console.error(`Failed to update Google Calendar event ${rawId}:`, err.message);
    throw err;
  }
}
