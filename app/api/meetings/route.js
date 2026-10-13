import { NextResponse } from 'next/server';
import { postRentman, putRentman, deleteRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    if (!body.color) body.color = 'E67E22'; // Default color for meetings (Orange)
    body.color = String(body.color).replace('#', '');
    
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
    const realId = String(id).replace('app-', '');

    if (!realId) {
      return NextResponse.json({ error: 'Missing meeting ID' }, { status: 400 });
    }

    if (updateData.color) {
      updateData.color = String(updateData.color).replace('#', '');
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

    const realId = String(id).replace('app-', '');
    await deleteRentman(`/appointments/${realId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Meeting DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
