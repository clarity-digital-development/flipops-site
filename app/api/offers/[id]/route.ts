import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
 * GET /api/offers/[id]
 * Get a single offer by ID
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

    const offer = await prisma.offer.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            ownerName: true,
            phoneNumbers: true,
            emails: true,
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const formattedOffer = {
      ...offer,
      contingencies: offer.contingencies ? JSON.parse(offer.contingencies) : null,
      counterTerms: offer.counterTerms ? JSON.parse(offer.counterTerms) : null,
    };

    return NextResponse.json({ offer: formattedOffer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/offers/[id]
 * Update an offer (status, counter-offer, etc.)
 * Body: {
 *   status?: string,
 *   amount?: number,
 *   terms?: string,
 *   contingencies?: string[],
 *   closingDate?: string,
 *   expiresAt?: string,
 *   earnestMoney?: number,
 *   dueDate?: string,
 *   responseNotes?: string,
 *   counterAmount?: number,
 *   counterTerms?: object,
 *   notes?: string
 * }
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
    const existingOffer = await prisma.offer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: 'Offer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Auto-set timestamps based on status change
      if (body.status === 'sent' && !existingOffer.sentAt) {
        updateData.sentAt = new Date();
      }
      if (['accepted', 'rejected', 'countered'].includes(body.status) && !existingOffer.responseAt) {
        updateData.responseAt = new Date();
      }
      if (body.status === 'countered' && body.counterAmount) {
        updateData.counterDate = new Date();
      }
    }

    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.terms !== undefined) updateData.terms = body.terms;
    if (body.contingencies !== undefined) {
      updateData.contingencies = JSON.stringify(body.contingencies);
    }
    if (body.closingDate !== undefined) {
      updateData.closingDate = body.closingDate ? new Date(body.closingDate) : null;
    }
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.earnestMoney !== undefined) updateData.earnestMoney = body.earnestMoney;
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.responseNotes !== undefined) updateData.responseNotes = body.responseNotes;
    if (body.counterAmount !== undefined) updateData.counterAmount = body.counterAmount;
    if (body.counterTerms !== undefined) {
      updateData.counterTerms = JSON.stringify(body.counterTerms);
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update offer
    const updatedOffer = await prisma.offer.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            ownerName: true,
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

    return NextResponse.json({ offer: formattedOffer });
  } catch (error) {
    console.error('Error updating offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/offers/[id]
 * Delete an offer
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
    const offer = await prisma.offer.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Delete offer
    await prisma.offer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
