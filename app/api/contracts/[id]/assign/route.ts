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
 * POST /api/contracts/[id]/assign
 * Assign a contract to a buyer
 * Body: {
 *   buyerId: string,
 *   assignmentFee: number,
 *   assignmentDate?: string,
 *   notes?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const { id: contractId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.buyerId || body.assignmentFee === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: buyerId, assignmentFee' },
        { status: 400 }
      );
    }

    // Verify contract belongs to user
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        userId,
      },
      include: {
        assignment: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Check if contract already assigned
    if (contract.assignment) {
      return NextResponse.json(
        { error: 'Contract is already assigned to a buyer' },
        { status: 400 }
      );
    }

    // Verify buyer belongs to user
    const buyer = await prisma.buyer.findFirst({
      where: {
        id: body.buyerId,
        userId,
      },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Create assignment
    const assignment = await prisma.contractAssignment.create({
      data: {
        contractId,
        buyerId: body.buyerId,
        assignmentFee: body.assignmentFee,
        assignmentDate: body.assignmentDate ? new Date(body.assignmentDate) : null,
        notes: body.notes,
        status: 'pending',
      },
      include: {
        buyer: true,
        contract: {
          include: {
            property: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        contractId: assignment.contractId,
        buyerId: assignment.buyerId,
        assignmentFee: assignment.assignmentFee,
        assignmentDate: assignment.assignmentDate,
        status: assignment.status,
        notes: assignment.notes,
        buyer: assignment.buyer,
        property: assignment.contract.property,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating contract assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contracts/[id]/assign
 * Get assignment details for a contract
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

    const { id: contractId } = await params;

    // Verify contract belongs to user and get assignment
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        userId,
      },
      include: {
        assignment: {
          include: {
            buyer: true,
          },
        },
        property: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or does not belong to user' },
        { status: 404 }
      );
    }

    if (!contract.assignment) {
      return NextResponse.json(
        { error: 'Contract has no assignment' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      assignment: {
        id: contract.assignment.id,
        contractId: contract.assignment.contractId,
        buyerId: contract.assignment.buyerId,
        assignmentFee: contract.assignment.assignmentFee,
        assignmentDate: contract.assignment.assignmentDate,
        status: contract.assignment.status,
        feeReceived: contract.assignment.feeReceived,
        feeReceivedDate: contract.assignment.feeReceivedDate,
        notes: contract.assignment.notes,
        buyer: contract.assignment.buyer,
        property: contract.property,
      },
    });
  } catch (error) {
    console.error('Error fetching contract assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
