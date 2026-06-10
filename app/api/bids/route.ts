import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/bids
 * Create a new bid for a renovation project
 * Body: {
 *   dealId: string,       // Renovation (DealSpec) ID
 *   vendorId: string,     // Vendor ID
 *   trade: string,        // Trade category (kitchen, bathroom, etc.)
 *   items: array,         // Line items: [{task, quantity, unit, unitPrice, totalPrice}]
 *   subtotal: number,     // Total bid amount
 *   includes?: array,     // What's included
 *   excludes?: array,     // What's excluded
 *   notes?: string        // Additional notes
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const body = await request.json();

    // Validate required fields
    if (!body.dealId || !body.vendorId || body.subtotal === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: dealId, vendorId, subtotal' },
        { status: 400 }
      );
    }

    // Verify the renovation (DealSpec) belongs to the user
    const deal = await prisma.dealSpec.findFirst({
      where: {
        id: body.dealId,
        userId,
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Renovation not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Verify the vendor exists and belongs to user (or is a platform vendor)
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: body.vendorId,
        OR: [
          { userId }, // User's own vendor
          { userId: null }, // Platform vendor
        ],
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found or not accessible' },
        { status: 404 }
      );
    }

    // Prepare items array with trade info
    const items = (body.items || []).map((item: any) => ({
      ...item,
      trade: body.trade || item.trade,
    }));

    // Create the bid
    const bid = await prisma.bid.create({
      data: {
        dealId: body.dealId,
        vendorId: body.vendorId,
        items: JSON.stringify(items),
        subtotal: body.subtotal,
        includes: body.includes || [],
        excludes: body.excludes || [],
        status: 'pending',
        normalized: body.normalized || null,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            trade: true,
            onTimePct: true,
            onBudgetPct: true,
            reliability: true,
          },
        },
      },
    });

    return NextResponse.json({
      bid: {
        ...bid,
        items: JSON.parse(bid.items),
        trade: body.trade,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating bid:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bids
 * List bids for a renovation
 * Query params:
 *  - dealId: required - filter by renovation
 *  - status: optional - filter by status (pending, awarded, rejected)
 *  - vendorId: optional - filter by vendor
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const searchParams = request.nextUrl.searchParams;
    const dealId = searchParams.get('dealId');
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');

    if (!dealId) {
      return NextResponse.json(
        { error: 'dealId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify the renovation belongs to the user
    const deal = await prisma.dealSpec.findFirst({
      where: {
        id: dealId,
        userId,
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Renovation not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Build query
    const where: any = { dealId };
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const bids = await prisma.bid.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            trade: true,
            onTimePct: true,
            onBudgetPct: true,
            reliability: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse items JSON and add vendor name for convenience
    const formattedBids = bids.map(bid => {
      const items = JSON.parse(bid.items);
      const trade = items[0]?.trade || 'unknown';
      return {
        ...bid,
        items,
        trade,
        vendorName: bid.vendor?.name || 'Unknown Vendor',
      };
    });

    return NextResponse.json({ bids: formattedBids });
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
