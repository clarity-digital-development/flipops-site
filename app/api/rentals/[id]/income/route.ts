import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/rentals/[id]/income
 * Record rent payment or other rental income
 * Body: {
 *   amount: number,
 *   type?: string (rent, late_fee, pet_fee, parking, other),
 *   description?: string,
 *   receivedDate: string,
 *   dueDate?: string,
 *   paymentMethod?: string,
 *   referenceNumber?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (body.amount === undefined || !body.receivedDate) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, receivedDate' },
        { status: 400 }
      );
    }

    // Verify rental belongs to user
    const rental = await prisma.rental.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!rental) {
      return NextResponse.json(
        { error: 'Rental not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Create income record
    const income = await prisma.rentalIncome.create({
      data: {
        rentalId: id,
        amount: body.amount,
        type: body.type || 'rent',
        description: body.description || null,
        receivedDate: new Date(body.receivedDate),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paymentMethod: body.paymentMethod || null,
        referenceNumber: body.referenceNumber || null,
      },
    });

    // Update rental totalIncome
    await prisma.rental.update({
      where: { id },
      data: {
        totalIncome: {
          increment: body.amount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      income,
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording income:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
