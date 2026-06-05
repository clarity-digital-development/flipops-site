import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/tasks
 * Get all tasks for the authenticated user
 * Query params:
 *   - completed: "true" | "false" | "all" (default: "false")
 *   - propertyId: filter by property
 *   - dealId: filter by deal
 *   - dueDate: "today" | "week" | "overdue" | "all" (default: "all")
 *   - priority: "low" | "medium" | "high" | "all" (default: "all")
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const searchParams = request.nextUrl.searchParams;
    const completedFilter = searchParams.get('completed') || 'false';
    const propertyId = searchParams.get('propertyId');
    const dealId = searchParams.get('dealId');
    const dueDateFilter = searchParams.get('dueDate') || 'all';
    const priorityFilter = searchParams.get('priority') || 'all';

    // Build where clause
    const where: any = { userId };

    // Completed filter
    if (completedFilter === 'true') {
      where.completed = true;
    } else if (completedFilter === 'false') {
      where.completed = false;
    }
    // If "all", don't filter by completed

    // Property filter
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Deal filter
    if (dealId) {
      where.dealId = dealId;
    }

    // Due date filter
    const now = new Date();
    if (dueDateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      where.dueDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (dueDateFilter === 'week') {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      where.dueDate = {
        gte: now,
        lte: endOfWeek,
      };
    } else if (dueDateFilter === 'overdue') {
      where.dueDate = {
        lt: now,
      };
      where.completed = false; // Only show incomplete overdue tasks
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      where.priority = priorityFilter;
    }

    // Fetch tasks with property and deal relations
    const tasks = await prisma.task.findMany({
      where,
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
      orderBy: [
        { completed: 'asc' }, // Incomplete tasks first
        { dueDate: 'asc' },   // Earliest due date first
        { priority: 'desc' }, // High priority first (h > m > l alphabetically)
      ],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task
 * Body: {
 *   type: string,
 *   title: string,
 *   description?: string,
 *   dueDate: string (ISO datetime),
 *   priority?: "low" | "medium" | "high",
 *   propertyId?: string,
 *   dealId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.title || !body.dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, dueDate' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['call', 'email', 'text', 'showing', 'offer', 'follow_up', 'custom'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be one of: low, medium, high' },
        { status: 400 }
      );
    }

    // If propertyId provided, verify it belongs to user
    if (body.propertyId) {
      const property = await prisma.property.findFirst({
        where: {
          id: body.propertyId,
          userId,
        },
      });

      if (!property) {
        return NextResponse.json(
          { error: 'Property not found or does not belong to user' },
          { status: 404 }
        );
      }
    }

    // If dealId provided, verify it belongs to user
    if (body.dealId) {
      const deal = await prisma.dealSpec.findFirst({
        where: {
          id: body.dealId,
          userId,
        },
      });

      if (!deal) {
        return NextResponse.json(
          { error: 'Deal not found or does not belong to user' },
          { status: 404 }
        );
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        userId,
        type: body.type,
        title: body.title,
        description: body.description,
        dueDate: new Date(body.dueDate),
        priority: body.priority || 'medium',
        propertyId: body.propertyId,
        dealId: body.dealId,
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

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
