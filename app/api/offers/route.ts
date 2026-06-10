import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { emitLeadEvent, buildPropertySnapshot } from '@/lib/events/emit';

/**
 * POST /api/offers
 * Create a new offer
 * Body: {
 *   propertyId: string,
 *   analysisId?: string,
 *   amount: number,
 *   terms?: string,
 *   contingencies?: string[],
 *   closingDate?: string,
 *   expiresAt?: string,
 *   earnestMoney?: number,
 *   dueDate?: string,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const body = await request.json();

    // Validate required fields
    if (!body.propertyId || body.amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, amount' },
        { status: 400 }
      );
    }

    // Verify the property belongs to the user
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

    // Create offer + emit the 'offer_made' behavioral outcome label in the
    // SAME transaction (M1.1) — outcome labels are server-side, never
    // client best-effort. Both commit or neither does.
    const offer = await prisma.$transaction(async (tx) => {
      const created = await tx.offer.create({
        data: {
          userId,
          propertyId: body.propertyId,
          analysisId: body.analysisId,
          amount: body.amount,
          terms: body.terms,
          contingencies: body.contingencies ? JSON.stringify(body.contingencies) : null,
          closingDate: body.closingDate ? new Date(body.closingDate) : null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          earnestMoney: body.earnestMoney,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          notes: body.notes,
          status: 'draft', // Always start as draft
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
        },
      });

      await emitLeadEvent(tx, {
        userId,
        propertyId: body.propertyId,
        eventType: 'offer_made',
        leadSnapshot: buildPropertySnapshot(property),
        metadata: {
          offerId: created.id,
          amount: created.amount,
          terms: created.terms ?? undefined,
          source: 'api/offers#POST',
        },
      });

      return created;
    });

    // Parse contingencies for response
    const formattedOffer = {
      ...offer,
      contingencies: offer.contingencies ? JSON.parse(offer.contingencies) : null,
    };

    return NextResponse.json({ offer: formattedOffer }, { status: 201 });
  } catch (error) {
    console.error('Error creating offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/offers
 * Get all offers for authenticated user
 * Query params:
 *   - status: filter by status (draft, sent, countered, accepted, rejected, expired)
 *   - propertyId: filter by property
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const offers = await prisma.offer.findMany({
      where,
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
        contract: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse JSON fields
    const formattedOffers = offers.map((offer) => ({
      ...offer,
      contingencies: offer.contingencies ? JSON.parse(offer.contingencies) : null,
      counterTerms: offer.counterTerms ? JSON.parse(offer.counterTerms) : null,
    }));

    return NextResponse.json({ offers: formattedOffers });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
