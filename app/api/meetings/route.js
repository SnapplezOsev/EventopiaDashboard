import { NextResponse } from 'next/server';
import { postRentman, putRentman, deleteRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    if (!body.color) body.color = 'E67E22'; // Default color for meetings (Orange)
    
    // Create Appointment
    const data = await postRentman('/appointments', body);

    const newMeetingId = data?.data?.id || data?.id;
    if (newMeetingId && pendingAssignments.length > 0) {
      for (const crewId of pendingAssignments) {
        try {
          await postRentman('/appointmentcrew', {
            appointment: `/appointments/${newMeetingId}`,
            crew: `/crew/${crewId}`,
            crewmember: `/crew/${crewId}`
          });
        } catch (err) {
          console.warn('Retrying appointment crew with direct id:', err.message);
          try {
            await postRentman('/appointmentcrew', {
              appointment: newMeetingId,
              crew: crewId
            });
          } catch (err2) {
            console.error('Failed to link crew to appointment:', err2.message);
          }
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

    const data = await putRentman(`/appointments/${realId}`, updateData);

    if (Array.isArray(pendingAssignments) && pendingAssignments.length > 0) {
      for (const crewId of pendingAssignments) {
        try {
          await postRentman('/appointmentcrew', {
            appointment: `/appointments/${realId}`,
            crew: `/crew/${crewId}`,
            crewmember: `/crew/${crewId}`
          });
        } catch (err) {
          console.warn('Failed to assign attendee on update:', err.message);
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
