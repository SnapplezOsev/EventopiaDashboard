import { NextResponse } from 'next/server';
import { 
  getCalendarConfig, 
  saveCalendarConfig, 
  syncScheduleToGoogle, 
  getLastSyncStatus 
} from '@/lib/googleCalendar';
import { getWeekDetails } from '@/lib/weekUtils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getCalendarConfig();
  const lastSync = getLastSyncStatus();

  return NextResponse.json({
    config,
    lastSync,
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, calendarId } = body;

    // 1. Action: Save Calendar Configuration
    if (action === 'saveConfig') {
      if (typeof calendarId === 'string') {
        saveCalendarConfig({ calendarId: calendarId.trim() });
      }
      const updatedConfig = getCalendarConfig();
      return NextResponse.json({ success: true, config: updatedConfig });
    }

    // 2. Action: Trigger Sync
    const config = getCalendarConfig();
    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        notConfigured: true,
        error: 'Google Kalender är inte konfigurerad än. Ange Kalender-ID och lägg till service-kontots nyckelfil.',
        config,
      }, { status: 200 });
    }

    // Determine functions to sync:
    // If specific functions are passed and syncRange is not 'upcoming', sync those.
    // Otherwise, fetch the full rolling 4-week window (current week + 3 upcoming weeks)
    // so Google Calendar always has future projects, deliveries, and shifts in sync.
    let functions = body.functions;
    let canceledFunctions = body.canceledFunctions || [];

    if (!Array.isArray(functions) || functions.length === 0 || body.syncRange === 'upcoming') {
      const port = process.env.PORT || 3000;
      const baseUrl = process.env.NEXTAUTH_URL || `http://127.0.0.1:${port}`;
      const weekOffsets = [0, 1, 2, 3];
      const allFunctionsMap = new Map();
      const allCanceledMap = new Map();

      for (const offset of weekOffsets) {
        const { weekStr } = getWeekDetails(offset);
        try {
          const schedRes = await fetch(`${baseUrl}/api/schedule?week=${weekStr}`, { next: { revalidate: 0 } });
          if (schedRes.ok) {
            const schedData = await schedRes.json();
            for (const f of (schedData.functions || [])) allFunctionsMap.set(f.id, f);
            for (const cf of (schedData.canceledFunctions || [])) allCanceledMap.set(cf.id, cf);
          }
        } catch (err) {
          console.warn(`Could not self-fetch schedule for calendar sync (week ${weekStr}):`, err.message);
        }
      }

      functions = Array.from(allFunctionsMap.values());
      canceledFunctions = Array.from(allCanceledMap.values());
    }

    if (!Array.isArray(functions) || functions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Hittade inga händelser att synka i schemat.',
      }, { status: 400 });
    }

    const result = await syncScheduleToGoogle(functions, { canceledFunctions });
    return NextResponse.json({ success: true, result, weeksCount: 4 });
  } catch (err) {
    console.error('Calendar sync API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
