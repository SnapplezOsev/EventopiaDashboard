import { NextResponse } from 'next/server';
import { 
  getCalendarConfig, 
  saveCalendarConfig, 
  syncScheduleToGoogle, 
  getLastSyncStatus 
} from '@/lib/googleCalendar';

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
        error: 'Google Kalender är inte konfigurerad än. Ange Kalender-ID och lägg till service-kontots nyckelfil.',
        config,
      }, { status: 400 });
    }

    // Get functions to sync (either passed in body or fetched from /api/schedule)
    let functions = body.functions;
    if (!Array.isArray(functions) || functions.length === 0) {
      const port = process.env.PORT || 3000;
      const baseUrl = process.env.NEXTAUTH_URL || `http://127.0.0.1:${port}`;
      try {
        const schedRes = await fetch(`${baseUrl}/api/schedule`, { next: { revalidate: 0 } });
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          functions = schedData.functions || [];
        }
      } catch (err) {
        console.warn('Could not self-fetch schedule for calendar sync:', err.message);
      }
    }

    if (!Array.isArray(functions) || functions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Hittade inga händelser att synka i schemat.',
      }, { status: 400 });
    }

    const result = await syncScheduleToGoogle(functions);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('Calendar sync API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
