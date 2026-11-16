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
    // Otherwise, fetch the full rolling window: past 2 weeks (-2) to upcoming 6 months (+26)
    // so Google Calendar always updates the past 2 weeks and upcoming 6 months in sync.
    let functions = body.functions;
    let canceledFunctions = body.canceledFunctions || [];

    const { weekStartStr: pastTwoWeeksStr } = getWeekDetails(-2);
    const { weekEndStr: sixMonthsAheadStr } = getWeekDetails(26);
    const startDate = body.startDate || pastTwoWeeksStr;
    const endDate = body.endDate || sixMonthsAheadStr;

    if (!Array.isArray(functions) || functions.length === 0 || body.syncRange === 'upcoming') {
      const port = process.env.PORT || 3000;
      const baseUrl = process.env.NEXTAUTH_URL || `http://127.0.0.1:${port}`;

      try {
        const schedRes = await fetch(
          `${baseUrl}/api/schedule?startDate=${startDate}&endDate=${endDate}&skipGcal=true`, 
          { next: { revalidate: 0 } }
        );
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          functions = schedData.functions || [];
          canceledFunctions = schedData.canceledFunctions || [];
        } else {
          throw new Error(`Schedule fetch returned ${schedRes.status}`);
        }
      } catch (err) {
        console.warn(`Could not self-fetch schedule for calendar sync (${startDate} to ${endDate}):`, err.message);
      }
    }

    if (!Array.isArray(functions) || functions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Hittade inga händelser att synka i schemat.',
      }, { status: 400 });
    }

    const result = await syncScheduleToGoogle(functions, { 
      canceledFunctions,
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
    });
    return NextResponse.json({ 
      success: true, 
      result, 
      weeksCount: 29,
      syncRange: { startDate, endDate } 
    });
  } catch (err) {
    console.error('Calendar sync API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
