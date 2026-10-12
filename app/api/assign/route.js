import { NextResponse } from 'next/server';
import { postRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const { functionId, crewId } = body;

    if (!functionId || !crewId) {
      return NextResponse.json({ error: 'functionId and crewId are required' }, { status: 400 });
    }

    const fnStr = String(functionId);

    // If this is an appointment/meeting
    if (fnStr.startsWith('app-')) {
      const realAppointmentId = fnStr.replace('app-', '');
      let response;
      try {
        response = await postRentman('/appointmentcrew', {
          appointment: `/appointments/${realAppointmentId}`,
          crew: `/crew/${crewId}`,
          crewmember: `/crew/${crewId}`
        });
      } catch (err) {
        response = await postRentman('/appointmentcrew', {
          appointment: realAppointmentId,
          crew: crewId
        });
      }
      return NextResponse.json(response?.data || response || { success: true });
    }

    // Standard Project Function
    const payload = { crewmember: `/crew/${crewId}` };
    const response = await postRentman(`/projectfunctions/${functionId}/projectcrew`, payload);

    return NextResponse.json(response?.data || response || { success: true });
  } catch (error) {
    console.error('Assign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
