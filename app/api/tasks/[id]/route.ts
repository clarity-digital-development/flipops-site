import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/tasks/[id]
 * Get a single task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        userId, // Ensure user can only access their own tasks
      },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            ownerName: true,
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
            type: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/[id]
 * Update a task
 * Body can include: {
 *   title?: string,
 *   description?: string,
 *   dueDate?: string (ISO datetime),
 *   priority?: "low" | "medium" | "high",
 *   completed?: boolean,
 *   type?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;
    const body = await request.json();

    // Verify the task belongs to the user
    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Validate priority if provided
    if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be one of: low, medium, high' },
        { status: 400 }
      );
    }

    // Validate type if provided
    if (body.type) {
      const validTypes = ['call', 'email', 'text', 'showing', 'offer', 'follow_up', 'custom'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate);

    // Handle completed status
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
      // If marking as completed, set completedAt
      if (body.completed && !existing.completed) {
        updateData.completedAt = new Date();
      }
      // If marking as incomplete, clear completedAt
      if (!body.completed && existing.completed) {
        updateData.completedAt = null;
      }
    }

    // Update the task
    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            ownerName: true,
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    // Verify the task belongs to the user
    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
