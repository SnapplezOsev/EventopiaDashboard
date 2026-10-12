import { NextResponse } from 'next/server';
import { postRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const { taskId, crewId } = await request.json();
    const data = await postRentman('/taskassignments', {
      task: `/tasks/${taskId}`,
      crew: `/crew/${crewId}`
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('TaskAssign POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
