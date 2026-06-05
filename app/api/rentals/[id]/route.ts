import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/rentals/[id]
 * Get rental details
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

    // Verify rental belongs to user
    const rental = await prisma.rental.findFirst({
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
        tenants: {
          orderBy: {
            leaseStart: 'desc',
          },
        },
        income: {
          orderBy: {
            receivedDate: 'desc',
          },
        },
        expenses: {
          orderBy: {
            expenseDate: 'desc',
          },
        },
        _count: {
          select: {
            tenants: true,
            income: true,
            expenses: true,
          },
        },
      },
    });

    if (!rental) {
      return NextResponse.json(
        { error: 'Rental not found or does not belong to user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ rental });
  } catch (error) {
    console.error('Error fetching rental:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rentals/[id]
 * Update rental details
 * Body: Any Rental fields to update (monthlyRent, deposit, status, mortgagePayment, etc.)
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

    // Verify rental belongs to user
    const existingRental = await prisma.rental.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingRental) {
      return NextResponse.json(
        { error: 'Rental not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.monthlyRent !== undefined) updateData.monthlyRent = body.monthlyRent;
    if (body.deposit !== undefined) updateData.deposit = body.deposit;
    if (body.leaseStart !== undefined) updateData.leaseStart = body.leaseStart ? new Date(body.leaseStart) : null;
    if (body.leaseEnd !== undefined) updateData.leaseEnd = body.leaseEnd ? new Date(body.leaseEnd) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.purchasePrice !== undefined) updateData.purchasePrice = body.purchasePrice;
    if (body.mortgagePayment !== undefined) updateData.mortgagePayment = body.mortgagePayment;
    if (body.propertyTax !== undefined) updateData.propertyTax = body.propertyTax;
    if (body.insurance !== undefined) updateData.insurance = body.insurance;
    if (body.hoa !== undefined) updateData.hoa = body.hoa;
    if (body.utilities !== undefined) updateData.utilities = body.utilities;
    if (body.maintenance !== undefined) updateData.maintenance = body.maintenance;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update rental
    const rental = await prisma.rental.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        contract: {
          include: {
            property: true,
          },
        },
        tenants: true,
        income: true,
        expenses: true,
        _count: {
          select: {
            tenants: true,
            income: true,
            expenses: true,
          },
        },
      },
    });

    return NextResponse.json({ rental });
  } catch (error) {
    console.error('Error updating rental:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rentals/[id]
 * Delete a rental property
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

    // Verify rental belongs to user
    const existingRental = await prisma.rental.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingRental) {
      return NextResponse.json(
        { error: 'Rental not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Delete rental (cascading deletes will handle related records)
    await prisma.rental.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rental:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
