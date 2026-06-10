import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/renovations/[id]
 * Get renovation details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const { id } = await params;

    // Verify renovation belongs to user
    const renovation = await prisma.dealSpec.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        property: true,
        contract: {
          include: {
            property: true,
            offer: true,
          },
        },
        budgetLedger: true,
        scopeNodes: {
          orderBy: {
            trade: 'asc',
          },
        },
        bids: {
          include: {
            vendor: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        changeOrders: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        tasks: {
          where: {
            completed: false,
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
        _count: {
          select: {
            scopeNodes: true,
            bids: true,
            changeOrders: true,
            tasks: true,
          },
        },
      },
    });

    if (!renovation) {
      return NextResponse.json(
        { error: 'Renovation not found or does not belong to user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      renovation: {
        ...renovation,
        constraints: JSON.parse(renovation.constraints),
      },
    });
  } catch (error) {
    console.error('Error fetching renovation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/renovations/[id]
 * Update renovation details
 * Body: Any DealSpec fields to update (status, maxExposureUsd, targetRoiPct, arv, startAt, completedAt, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const { id } = await params;
    const body = await request.json();

    // Verify renovation belongs to user
    const existingRenovation = await prisma.dealSpec.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingRenovation) {
      return NextResponse.json(
        { error: 'Renovation not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.maxExposureUsd !== undefined) updateData.maxExposureUsd = body.maxExposureUsd;
    if (body.targetRoiPct !== undefined) updateData.targetRoiPct = body.targetRoiPct;
    if (body.arv !== undefined) updateData.arv = body.arv;
    if (body.grade !== undefined) updateData.grade = body.grade;
    if (body.startAt !== undefined) updateData.startAt = body.startAt ? new Date(body.startAt) : null;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    if (body.dailyBurnUsd !== undefined) updateData.dailyBurnUsd = body.dailyBurnUsd;
    if (body.constraints !== undefined) {
      updateData.constraints = JSON.stringify(body.constraints);
    }

    // If status is being set to completed and no completedAt is set, set it now
    if (body.status === 'completed' && !body.completedAt && !existingRenovation.completedAt) {
      updateData.completedAt = new Date();
    }

    // Update renovation
    const renovation = await prisma.dealSpec.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        contract: {
          include: {
            property: true,
          },
        },
        budgetLedger: true,
        scopeNodes: true,
        _count: {
          select: {
            scopeNodes: true,
            bids: true,
            changeOrders: true,
            tasks: true,
          },
        },
      },
    });

    return NextResponse.json({
      renovation: {
        ...renovation,
        constraints: JSON.parse(renovation.constraints),
      },
    });
  } catch (error) {
    console.error('Error updating renovation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/renovations/[id]
 * Delete a renovation project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const { id } = await params;

    // Verify renovation belongs to user
    const existingRenovation = await prisma.dealSpec.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingRenovation) {
      return NextResponse.json(
        { error: 'Renovation not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Delete renovation (cascading deletes will handle related records)
    await prisma.dealSpec.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting renovation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
