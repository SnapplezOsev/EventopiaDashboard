import { NextResponse } from 'next/server';
import { deleteRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const { projectCrewId } = body;

    if (!projectCrewId) {
      return NextResponse.json({ error: 'projectCrewId is required' }, { status: 400 });
    }

    if (typeof projectCrewId === 'string' && projectCrewId.startsWith('temp-')) {
      return NextResponse.json({ success: true });
    }

    await deleteRentman(`/projectcrew/${projectCrewId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unassign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
