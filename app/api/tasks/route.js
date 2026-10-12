import { NextResponse } from 'next/server';
import { postRentman, putRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    // Default color if missing, Rentman requires it
    if (!body.color) body.color = '14B4EC';
    const data = await postRentman('/tasks', body);

    const newTaskId = data?.data?.id || data?.id;
    if (newTaskId && pendingAssignments.length > 0) {
      await Promise.all(pendingAssignments.map(crewId => 
        postRentman('/taskassignments', {
          task: `/tasks/${newTaskId}`,
          crew: `/crew/${crewId}`
        }).catch(err => console.error('Failed to assign crew:', err))
      ));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Task POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });
    const data = await putRentman(`/tasks/${id}`, updateData);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Task PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
