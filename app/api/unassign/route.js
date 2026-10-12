import { NextResponse } from 'next/server';
import { deleteRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const { projectCrewId, isAppointment } = body;

    if (!projectCrewId) {
      return NextResponse.json({ error: 'projectCrewId is required' }, { status: 400 });
    }

    if (typeof projectCrewId === 'string' && projectCrewId.startsWith('temp-')) {
      return NextResponse.json({ success: true });
    }

    if (isAppointment) {
      await deleteRentman(`/appointmentcrew/${projectCrewId}`);
    } else {
      // Try project crew first, fallback to appointment crew if 404
      try {
        await deleteRentman(`/projectcrew/${projectCrewId}`);
      } catch (err) {
        if (err.message?.includes('404')) {
          await deleteRentman(`/appointmentcrew/${projectCrewId}`);
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unassign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
