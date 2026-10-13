import { NextResponse } from 'next/server';
import { deleteRentman, fetchRentman, extractId } from '@/lib/rentman';
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
      let deleted = false;
      const isRealId = projectCrewId && typeof projectCrewId === 'number' || (typeof projectCrewId === 'string' && !projectCrewId.startsWith('temp-') && !projectCrewId.startsWith('local-'));
      if (isRealId) {
        try {
          await deleteRentman(`/appointmentcrew/${projectCrewId}`);
          deleted = true;
        } catch (err) {
          console.warn('Could not delete appointment crew by id from Rentman:', err.message);
        }
      }

      if (!deleted && functionId && crewId) {
        // Fallback: fetch appointmentcrew for this appointment, find matching crewmember, and delete
        const realAppId = String(functionId).replace('app-', '');
        try {
          const crewRes = await fetchRentman(`/appointments/${realAppId}/appointmentcrew`).catch(() => null);
          const match = crewRes?.data?.find(ac => extractId(ac.crew) === Number(crewId));
          if (match?.id) {
            await deleteRentman(`/appointmentcrew/${match.id}`);
          }
        } catch (err) {
          console.warn('Fallback appointment crew delete failed:', err.message);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unassign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
