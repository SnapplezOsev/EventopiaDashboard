import { NextResponse } from 'next/server';
import { deleteRentman } from '@/lib/rentman';
import { removeLocalAssignment } from '@/lib/localAssignments';

export async function POST(request) {
  try {
    const body = await request.json();
    const { projectCrewId, isAppointment, functionId, crewId } = body;

    if (!projectCrewId && (!functionId || !crewId)) {
      return NextResponse.json({ error: 'projectCrewId or functionId/crewId is required' }, { status: 400 });
    }

    // Always remove from local persistent store if matched
    removeLocalAssignment(projectCrewId, functionId, crewId);

    if (typeof projectCrewId === 'string' && (projectCrewId.startsWith('temp-') || projectCrewId.startsWith('local-'))) {
      return NextResponse.json({ success: true });
    }

    if (isAppointment) {
      try {
        await deleteRentman(`/appointmentcrew/${projectCrewId}`);
      } catch (err) {
        console.warn('Could not delete appointment crew from Rentman:', err.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unassign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
