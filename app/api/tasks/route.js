import { NextResponse } from 'next/server';
import { postRentman, putRentman, fetchRentman } from '@/lib/rentman';

let cachedTaskStatuses = null;
let lastTaskStatusFetch = 0;

async function getTaskStatuses() {
  const now = Date.now();
  if (cachedTaskStatuses && now - lastTaskStatusFetch < 60000) {
    return cachedTaskStatuses;
  }
  try {
    const res = await fetchRentman('/taskstatuses');
    const list = res?.data || [];
    const doneStatus = list.find(s => s.type === 'done' || /avslut|klar|done|completed/i.test(s.name)) || { id: 2 };
    const todoStatus = list.find(s => s.type === 'todo' || /to do|göra/i.test(s.name)) || { id: 1 };
    cachedTaskStatuses = { doneStatusId: doneStatus.id, todoStatusId: todoStatus.id };
    lastTaskStatusFetch = now;
    return cachedTaskStatuses;
  } catch (err) {
    return { doneStatusId: 2, todoStatusId: 1 };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const pendingAssignments = body.pendingAssignments || [];
    delete body.pendingAssignments;

    // Rentman task schema: name (required), color (required), details (optional), deadline (ISO datetime)
    const cleanColor = body.color ? String(body.color).replace('#', '') : '3b82f6';
    const taskPayload = {
      name: body.name,
      details: body.details || body.description || '',
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
          await postRentman(`/tasks/${newTaskId}/taskassignments`, {
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
    const { id, pendingAssignments, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });

    const taskPayload = {};
    if (updateData.name !== undefined && String(updateData.name).trim()) {
      taskPayload.name = String(updateData.name).trim();
    }
    if (updateData.details !== undefined || updateData.description !== undefined) {
      taskPayload.details = updateData.details !== undefined ? updateData.details : updateData.description;
    }
    if (updateData.deadline !== undefined) {
      if (!updateData.deadline) {
        taskPayload.deadline = null;
      } else {
        taskPayload.deadline = updateData.deadline.includes('T')
          ? updateData.deadline
          : `${updateData.deadline}T18:00:00Z`;
      }
    }

    // Handle completed toggle
    if (updateData.completed !== undefined) {
      const { doneStatusId, todoStatusId } = await getTaskStatuses();
      if (updateData.completed) {
        taskPayload.status = `/taskstatuses/${doneStatusId}`;
        taskPayload.completed_at = new Date().toISOString();
      } else {
        taskPayload.status = `/taskstatuses/${todoStatusId}`;
        taskPayload.completed_at = null;
      }
    }

    // Rentman PUT /tasks/{id} ALWAYS requires 'color'
    let color = updateData.color ? String(updateData.color).replace('#', '') : null;
    if (!color) {
      const existing = await fetchRentman(`/tasks/${id}`).catch(() => null);
      color = existing?.data?.color ? String(existing.data.color).replace('#', '') : '3b82f6';
    }
    taskPayload.color = color;

    const data = await putRentman(`/tasks/${id}`, taskPayload);

    // If pendingAssignments are provided on PUT, assign them as well
    if (Array.isArray(pendingAssignments) && pendingAssignments.length > 0) {
      for (const crewId of pendingAssignments) {
        try {
          await postRentman(`/tasks/${id}/taskassignments`, {
            crew: `/crew/${crewId}`
          });
        } catch (assignErr) {
          console.warn(`Failed to assign crew ${crewId} to task ${id}:`, assignErr.message);
        }
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Task PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
