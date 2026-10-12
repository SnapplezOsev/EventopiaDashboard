import { NextResponse } from 'next/server';
import { postRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const { functionId, crewId } = body;

    if (!functionId || !crewId) {
      return NextResponse.json({ error: 'functionId and crewId are required' }, { status: 400 });
    }

    const payload = { crewmember: `/crew/${crewId}` };
    const response = await postRentman(`/projectfunctions/${functionId}/projectcrew`, payload);

    return NextResponse.json(response?.data || response || { success: true });
  } catch (error) {
    console.error('Assign API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
