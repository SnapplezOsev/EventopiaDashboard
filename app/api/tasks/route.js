import { NextResponse } from 'next/server';
import { postRentman, putRentman } from '@/lib/rentman';

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    // Rentman task schema: name (required), color (required), description (optional), deadline (ISO datetime), completed (boolean)
    const cleanColor = body.color ? String(body.color).replace('#', '') : '3b82f6';
    const taskPayload = {
      name: body.name,
      description: body.description || body.details || '',
      completed: false,
      color: cleanColor,
    };

    if (body.deadline) {
      taskPayload.deadline = body.deadline.includes('T') ? body.deadline : `${body.deadline}T18:00:00Z`;
    }

    const data = await postRentman('/tasks', taskPayload);
    const newTaskId = data?.data?.id || data?.id;

    if (newTaskId && pendingAssignments.length > 0) {
      for (const crewId of pendingAssignments) {
        try {
          await postRentman('/taskassignments', {
            task: `/tasks/${newTaskId}`,
            crew: `/crew/${crewId}`
          });
        } catch (assignErr) {
          console.warn('Failed to assign crew to task:', assignErr.message);
        }
      }
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

    const taskPayload = {};
    if (updateData.name !== undefined) taskPayload.name = updateData.name;
    if (updateData.details !== undefined || updateData.description !== undefined) {
      taskPayload.description = updateData.details !== undefined ? updateData.details : updateData.description;
    }
    if (updateData.deadline !== undefined) {
      taskPayload.deadline = updateData.deadline && !updateData.deadline.includes('T')
        ? `${updateData.deadline}T18:00:00Z`
        : updateData.deadline;
    }
    if (updateData.completed !== undefined) {
      taskPayload.completed = updateData.completed;
    }
    if (updateData.color !== undefined) {
      taskPayload.color = String(updateData.color).replace('#', '');
    }

    const data = await putRentman(`/tasks/${id}`, taskPayload);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Task PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
