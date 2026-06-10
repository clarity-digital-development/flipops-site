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
 * POST /api/buyer-offers
 * Create a new buyer offer on a contract
 * Body: {
 *   contractId: string,
 *   buyerId: string,
 *   offerPrice: number,
 *   terms?: string,
 *   earnestMoney?: number,
 *   closingDays?: number,
 *   contingencies?: string[],
 *   expiresAt?: string,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.contractId || !body.buyerId || body.offerPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, buyerId, offerPrice' },
        { status: 400 }
      );
    }

    // Verify contract belongs to user
    const contract = await prisma.contract.findFirst({
      where: {
        id: body.contractId,
        userId,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or does not belong to user' },
        { status: 404 }
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

    // Create buyer offer
    const buyerOffer = await prisma.buyerOffer.create({
      data: {
        userId,
        contractId: body.contractId,
        buyerId: body.buyerId,
        offerPrice: body.offerPrice,
        terms: body.terms,
        earnestMoney: body.earnestMoney,
        closingDays: body.closingDays,
        contingencies: body.contingencies ? JSON.stringify(body.contingencies) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        notes: body.notes,
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

    // Parse JSON fields for response
    const formattedOffer = {
      ...buyerOffer,
      contingencies: buyerOffer.contingencies ? JSON.parse(buyerOffer.contingencies) : null,
    };

    return NextResponse.json({ buyerOffer: formattedOffer }, { status: 201 });
  } catch (error) {
    console.error('Error creating buyer offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/buyer-offers
 * Get all buyer offers for authenticated user
 * Query params:
 *   - contractId: filter by contract
 *   - buyerId: filter by buyer
 *   - status: filter by status (submitted, countered, accepted, rejected, expired)
 */
export async function GET(request: NextRequest) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const searchParams = request.nextUrl.searchParams;
    const contractId = searchParams.get('contractId');
    const buyerId = searchParams.get('buyerId');
    const offerStatus = searchParams.get('status');

    const where: Record<string, unknown> = { userId };

    if (contractId) {
      where.contractId = contractId;
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (offerStatus) {
      where.status = offerStatus;
    }

    const buyerOffers = await prisma.buyerOffer.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse JSON fields
    const formattedOffers = buyerOffers.map((offer) => ({
      ...offer,
      contingencies: offer.contingencies ? JSON.parse(offer.contingencies) : null,
      counterTerms: offer.counterTerms ? JSON.parse(offer.counterTerms) : null,
    }));

    return NextResponse.json({ buyerOffers: formattedOffers });
  } catch (error) {
    console.error('Error fetching buyer offers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
