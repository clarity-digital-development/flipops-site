import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * Helper to get userId via the canonical requireUser() guard.
 * Preserves this route's historical { error, status, userId } shape.
 */
async function getAuthenticatedUserId() {
  const guard = await requireUser();
  if ('error' in guard) {
    const status = guard.error.status;
    return {
      error: status === 404 ? 'User not found' : 'Unauthorized',
      status,
      userId: null,
    };
  }
  return { error: null, status: null, userId: guard.userId };
}

/**
 * GET /api/buyers/[id]
 * Get a single buyer with performance data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const { id } = await params;

    const buyer = await prisma.buyer.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
        assignments: {
          include: {
            contract: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const formattedBuyer = {
      ...buyer,
      propertyTypes: buyer.propertyTypes ? JSON.parse(buyer.propertyTypes) : null,
      targetMarkets: buyer.targetMarkets ? JSON.parse(buyer.targetMarkets) : null,
    };

    return NextResponse.json({ buyer: formattedBuyer });
  } catch (error) {
    console.error('Error fetching buyer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/buyers/[id]
 * Update a buyer
 * Body: Any buyer fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify buyer belongs to user
    const existingBuyer = await prisma.buyer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingBuyer) {
      return NextResponse.json(
        { error: 'Buyer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.propertyTypes !== undefined) {
      updateData.propertyTypes = body.propertyTypes ? JSON.stringify(body.propertyTypes) : null;
    }
    if (body.minPrice !== undefined) updateData.minPrice = body.minPrice;
    if (body.maxPrice !== undefined) updateData.maxPrice = body.maxPrice;
    if (body.targetMarkets !== undefined) {
      updateData.targetMarkets = body.targetMarkets ? JSON.stringify(body.targetMarkets) : null;
    }
    if (body.cashBuyer !== undefined) updateData.cashBuyer = body.cashBuyer;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.dealsClosed !== undefined) updateData.dealsClosed = body.dealsClosed;
    if (body.totalRevenue !== undefined) updateData.totalRevenue = body.totalRevenue;
    if (body.reliability !== undefined) updateData.reliability = body.reliability;

    // Update buyer
    const buyer = await prisma.buyer.update({
      where: { id },
      data: updateData,
    });

    // Parse JSON fields for response
    const formattedBuyer = {
      ...buyer,
      propertyTypes: buyer.propertyTypes ? JSON.parse(buyer.propertyTypes) : null,
      targetMarkets: buyer.targetMarkets ? JSON.parse(buyer.targetMarkets) : null,
    };

    return NextResponse.json({ buyer: formattedBuyer });
  } catch (error) {
    console.error('Error updating buyer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/buyers/[id]
 * Delete a buyer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const { id } = await params;

    // Verify buyer belongs to user
    const existingBuyer = await prisma.buyer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingBuyer) {
      return NextResponse.json(
        { error: 'Buyer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Check if buyer has any assignments
    const assignmentCount = await prisma.contractAssignment.count({
      where: { buyerId: id },
    });

    if (assignmentCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete buyer with ${assignmentCount} active assignment(s)` },
        { status: 400 }
      );
    }

    // Delete buyer
    await prisma.buyer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting buyer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
