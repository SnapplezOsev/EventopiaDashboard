import { NextResponse } from 'next/server';
import { postRentman } from '@/lib/rentman';

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
      await Promise.all(pendingAssignments.map(crewId => 
        postRentman('/appointmentcrew', {
          appointment: `/appointments/${newMeetingId}`,
          crew: `/crew/${crewId}`
        }).catch(err => console.error('Failed to assign crew to meeting:', err))
      ));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Meeting POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
