import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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
 * Build Google Calendar Event Payload
 */
function buildEventPayload(func) {
  const eventId = toGoogleEventId(func.id);

  // Summary (Title)
  let summary = '';
  if (func.type === 'appointment') {
    summary = `Möte: ${func.name}`;
  } else if (func.functionGroupName) {
    summary = `[${func.functionGroupName}] ${func.projectName ? `${func.projectName} – ` : ''}${func.name}`;
  } else if (func.projectName) {
    summary = `${func.projectName} – ${func.name}`;
  } else {
    summary = func.name;
  }

  // Description
  const assignedCount = func.assignedCrew?.length || 0;
  const requiredAmount = func.amount || 1;
  const crewLines = (func.assignedCrew || []).map(c => 
    `• ${c.name} (${c.category === 'internal' ? 'Intern' : 'Frilans'})`
  ).join('\n');

  const descParts = [
    func.projectName ? `📌 Projekt: ${func.projectName}` : '📌 Typ: Internt skift',
    func.functionGroupName ? `📁 Funktionsgrupp: ${func.functionGroupName}` : null,
    `⚙️ Funktion: ${func.name}`,
    func.statusName ? `🏷️ Status: ${func.statusName}` : null,
    func.customerName ? `👤 Kund: ${func.customerName}` : null,
    func.locationName ? `📍 Plats: ${func.locationName}` : null,
    func.vehicleNames?.length ? `🚚 Fordon: ${func.vehicleNames.join(', ')}` : null,
    func.remark ? `💬 Anteckning: ${func.remark}` : null,
    '',
    `👥 Personal (${assignedCount}/${requiredAmount}):`,
    crewLines || '• Ingen personal tilldelad än',
    '',
    '───',
    'Eventopia Dashboard Schemasynk',
  ].filter(line => line !== null).join('\n');

  // Dates
  const startIso = func.planperiod_start;
  const endIso = func.planperiod_end || func.planperiod_start;

  // Google Calendar color ID (1=Lavender, 2=Sage/Green, 6=Tangerine/Orange, 7=Peacock/Cyan, 11=Tomato/Red)
  let colorId = '7'; // default Peacock cyan
  if (func.type === 'appointment') colorId = '6'; // Orange
  else if (assignedCount >= requiredAmount) colorId = '2'; // Sage green when fully staffed
  else if (assignedCount === 0) colorId = '11'; // Tomato red when unstaffed

  return {
    id: eventId,
    summary,
    description: descParts,
    location: func.locationName || '',
    colorId,
    start: {
      dateTime: new Date(startIso).toISOString(),
      timeZone: 'Europe/Stockholm',
    },
    end: {
      dateTime: new Date(endIso).toISOString(),
      timeZone: 'Europe/Stockholm',
    },
    extendedProperties: {
      private: {
        source: 'eventopia-dashboard',
        functionId: String(func.id),
      },
    },
  };
}

/**
 * Sync schedule events to Google Calendar
 */
export async function syncScheduleToGoogle(functions = []) {
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

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const func of functions) {
    if (!func.planperiod_start) continue;

    const eventPayload = buildEventPayload(func);
    const eventId = eventPayload.id;

    try {
      // Try updating existing event
      await calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventPayload,
      });
      updated++;
    } catch (err) {
      if (err.code === 404) {
        // Event does not exist yet -> create it
        try {
          await calendar.events.insert({
            calendarId,
            requestBody: eventPayload,
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
    total: functions.length,
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
