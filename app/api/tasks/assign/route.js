import { NextResponse } from 'next/server';
import { postRentman, deleteRentman, fetchRentman, extractId } from '@/lib/rentman';

export async function POST(request) {
  try {
    const { taskId, crewId } = await request.json();
    if (!taskId || !crewId) {
      return NextResponse.json({ error: 'taskId and crewId are required' }, { status: 400 });
    }

    const data = await postRentman(`/tasks/${taskId}/taskassignments`, {
      crew: `/crew/${crewId}`
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error('TaskAssign POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let assignmentId = searchParams.get('assignmentId');
    let taskId = searchParams.get('taskId');
    let crewId = searchParams.get('crewId');

    if (!assignmentId && !taskId) {
      try {
        const body = await request.json();
        assignmentId = body.assignmentId;
        taskId = body.taskId;
        crewId = body.crewId;
      } catch (e) {
        // Body might be empty
      }
    }

    if (assignmentId) {
      await deleteRentman(`/taskassignments/${assignmentId}`);
      return NextResponse.json({ success: true });
    }

    if (taskId && crewId) {
      const res = await fetchRentman(`/tasks/${taskId}/taskassignments`).catch(() => null);
      const match = res?.data?.find(ta => extractId(ta.crew) === Number(crewId));
      if (match?.id) {
        await deleteRentman(`/taskassignments/${match.id}`);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Missing assignmentId or taskId and crewId' }, { status: 400 });
  } catch (error) {
    console.error('TaskAssign DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
