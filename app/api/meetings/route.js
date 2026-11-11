import { NextResponse } from 'next/server';
import { fetchRentman, postRentman, putRentman, deleteRentman, extractId } from '@/lib/rentman';
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent, toGoogleEventId } from '@/lib/googleCalendar';
import { clearCachedSchedule } from '@/lib/scheduleCache';

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    if (!body.color) body.color = 'E67E22'; // Default color for meetings (Orange)
    body.color = String(body.color).replace('#', '');

    // Ensure start and end adhere to ISO 8601 UTC format (yyyy-MM-dd'T'HH:mm:ss.SSSZ)
    if (body.start) {
      const s = new Date(body.start);
      if (!isNaN(s.getTime())) body.start = s.toISOString();
    }
    if (body.end) {
      const e = new Date(body.end);
      if (!isNaN(e.getTime())) body.end = e.toISOString();
    }
    
    // Create Appointment
    const data = await postRentman('/appointments', body);

    const newMeetingId = data?.data?.id || data?.id;
    if (newMeetingId && pendingAssignments.length > 0) {
      for (const crewId of pendingAssignments) {
        try {
          await postRentman(`/appointments/${newMeetingId}/appointmentcrew`, {
            crew: `/crew/${crewId}`
          });
        } catch (err) {
          console.error(`Failed to link crew ${crewId} to appointment ${newMeetingId}:`, err.message);
        }
      }
    }

    clearCachedSchedule();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Meeting POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, pendingAssignments, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing meeting ID' }, { status: 400 });
    }

    // Handle editing an event from Google Calendar directly
    if (String(id).startsWith('gcal-')) {
      const gcalResult = await updateGoogleCalendarEvent(id, updateData);
      clearCachedSchedule();
      return NextResponse.json({ success: true, data: gcalResult });
    }

    const realId = String(id).replace('app-', '');
    if (!realId) {
      return NextResponse.json({ error: 'Missing meeting ID' }, { status: 400 });
    }

    if (updateData.color) {
      updateData.color = String(updateData.color).replace('#', '');
    }

    // Ensure start and end adhere to ISO 8601 UTC format (yyyy-MM-dd'T'HH:mm:ss.SSSZ)
    if (updateData.start) {
      const s = new Date(updateData.start);
      if (!isNaN(s.getTime())) updateData.start = s.toISOString();
    }
    if (updateData.end) {
      const e = new Date(updateData.end);
      if (!isNaN(e.getTime())) updateData.end = e.toISOString();
    }

    const data = await putRentman(`/appointments/${realId}`, updateData);

    if (Array.isArray(pendingAssignments)) {
      // Fetch current appointment crew from Rentman to diff additions and removals
      const currentRes = await fetchRentman(`/appointments/${realId}/appointmentcrew`).catch(() => null);
      const currentCrewItems = currentRes?.data || [];
      const currentCrewMap = new Map();
      for (const ac of currentCrewItems) {
        const cId = extractId(ac.crew);
        if (cId) currentCrewMap.set(Number(cId), ac.id);
      }

      // Add new assignments
      for (const crewId of pendingAssignments) {
        const numId = Number(crewId);
        if (!currentCrewMap.has(numId)) {
          try {
            await postRentman(`/appointments/${realId}/appointmentcrew`, {
              crew: `/crew/${numId}`
            });
          } catch (err) {
            console.warn(`Failed to assign attendee ${crewId} on update:`, err.message);
          }
        }
      }

      // Remove unselected assignments
      const desiredSet = new Set(pendingAssignments.map(Number));
      for (const [cId, acId] of currentCrewMap.entries()) {
        if (!desiredSet.has(cId)) {
          try {
            await deleteRentman(`/appointmentcrew/${acId}`);
          } catch (err) {
            console.warn(`Failed to remove attendee ${cId} on update:`, err.message);
          }
        }
      }
    }

    clearCachedSchedule();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Meeting PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing meeting ID' }, { status: 400 });

    if (String(id).startsWith('gcal-')) {
      const gcalEventId = String(id).replace('gcal-', '');
      await deleteGoogleCalendarEvent(gcalEventId);
      clearCachedSchedule();
      return NextResponse.json({ success: true, deleted: id });
    }

    const realId = String(id).replace('app-', '');
    await deleteRentman(`/appointments/${realId}`);

    // Also delete any synced copy in Google Calendar
    try {
      await deleteGoogleCalendarEvent(toGoogleEventId(`app-${realId}`));
    } catch (e) {
      // Ignore if not present
    }

    clearCachedSchedule();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Meeting DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
