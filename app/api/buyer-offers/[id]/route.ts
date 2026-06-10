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
 * GET /api/buyer-offers/[id]
 * Get a single buyer offer
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

    const buyerOffer = await prisma.buyerOffer.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        contract: {
          include: {
            property: {
              select: {
                id: true,
                address: true,
                city: true,
                state: true,
                zip: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
            cashBuyer: true,
            reliability: true,
          },
        },
      },
    });

    if (!buyerOffer) {
      return NextResponse.json(
        { error: 'Buyer offer not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const formattedOffer = {
      ...buyerOffer,
      contingencies: buyerOffer.contingencies ? JSON.parse(buyerOffer.contingencies) : null,
      counterTerms: buyerOffer.counterTerms ? JSON.parse(buyerOffer.counterTerms) : null,
    };

    return NextResponse.json({ buyerOffer: formattedOffer });
  } catch (error) {
    console.error('Error fetching buyer offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/buyer-offers/[id]
 * Update a buyer offer (status, counter-offer, etc.)
 * Body: Any fields to update
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

    // Verify offer belongs to user
    const existingOffer = await prisma.buyerOffer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: 'Buyer offer not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.offerPrice !== undefined) updateData.offerPrice = body.offerPrice;
    if (body.terms !== undefined) updateData.terms = body.terms;
    if (body.earnestMoney !== undefined) updateData.earnestMoney = body.earnestMoney;
    if (body.closingDays !== undefined) updateData.closingDays = body.closingDays;
    if (body.contingencies !== undefined) {
      updateData.contingencies = Array.isArray(body.contingencies)
        ? JSON.stringify(body.contingencies)
        : body.contingencies;
    }
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.responseNotes !== undefined) updateData.responseNotes = body.responseNotes;

    // Status updates with timestamps
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (['accepted', 'rejected', 'countered'].includes(body.status)) {
        updateData.responseAt = new Date();
      }
    }

    // Counter offer tracking
    if (body.counterAmount !== undefined) updateData.counterAmount = body.counterAmount;
    if (body.counterTerms !== undefined) {
      updateData.counterTerms = typeof body.counterTerms === 'object'
        ? JSON.stringify(body.counterTerms)
        : body.counterTerms;
    }

    const updatedOffer = await prisma.buyerOffer.update({
      where: { id },
      data: updateData,
      include: {
        contract: {
          include: {
            property: {
              select: {
                id: true,
                address: true,
                city: true,
                state: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Parse JSON fields
    const formattedOffer = {
      ...updatedOffer,
      contingencies: updatedOffer.contingencies ? JSON.parse(updatedOffer.contingencies) : null,
      counterTerms: updatedOffer.counterTerms ? JSON.parse(updatedOffer.counterTerms) : null,
    };

    return NextResponse.json({ buyerOffer: formattedOffer });
  } catch (error) {
    console.error('Error updating buyer offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/buyer-offers/[id]
 * Delete a buyer offer
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

    // Verify offer belongs to user
    const existingOffer = await prisma.buyerOffer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: 'Buyer offer not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting accepted offers
    if (existingOffer.status === 'accepted') {
      return NextResponse.json(
        { error: 'Cannot delete an accepted offer' },
        { status: 400 }
      );
    }

    await prisma.buyerOffer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting buyer offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
