import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/buyers
 * Create a new buyer
 * Body: {
 *   name: string,
 *   email?: string,
 *   phone?: string,
 *   company?: string,
 *   propertyTypes?: string[], // will be stored as JSON
 *   minPrice?: number,
 *   maxPrice?: number,
 *   targetMarkets?: string[], // will be stored as JSON
 *   cashBuyer?: boolean,
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
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Create buyer
    const buyer = await prisma.buyer.create({
      data: {
        userId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        company: body.company,
        propertyTypes: body.propertyTypes ? JSON.stringify(body.propertyTypes) : null,
        minPrice: body.minPrice,
        maxPrice: body.maxPrice,
        targetMarkets: body.targetMarkets ? JSON.stringify(body.targetMarkets) : null,
        cashBuyer: body.cashBuyer ?? false,
        notes: body.notes,
      },
    });

    // Parse JSON fields for response
    const formattedBuyer = {
      ...buyer,
      propertyTypes: buyer.propertyTypes ? JSON.parse(buyer.propertyTypes) : null,
      targetMarkets: buyer.targetMarkets ? JSON.parse(buyer.targetMarkets) : null,
    };

    return NextResponse.json({ buyer: formattedBuyer }, { status: 201 });
  } catch (error) {
    console.error('Error creating buyer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/buyers
 * Get all buyers for authenticated user
 * Query params:
 *   - search: filter by name, email, or company
 *   - cashBuyer: filter by cash buyer status (true/false)
 *   - reliability: filter by reliability status (reliable/unreliable/unknown)
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const cashBuyerFilter = searchParams.get('cashBuyer');
    const reliabilityFilter = searchParams.get('reliability');

    const where: any = { userId };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { targetMarkets: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add cash buyer filter
    if (cashBuyerFilter !== null && cashBuyerFilter !== undefined) {
      where.cashBuyer = cashBuyerFilter === 'true';
    }

    // Add reliability filter
    if (reliabilityFilter && reliabilityFilter !== 'all') {
      where.reliability = reliabilityFilter;
    }

    const buyers = await prisma.buyer.findMany({
      where,
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse JSON fields
    const formattedBuyers = buyers.map((buyer) => ({
      ...buyer,
      propertyTypes: buyer.propertyTypes ? JSON.parse(buyer.propertyTypes) : null,
      targetMarkets: buyer.targetMarkets ? JSON.parse(buyer.targetMarkets) : null,
    }));

    return NextResponse.json({ buyers: formattedBuyers });
  } catch (error) {
    console.error('Error fetching buyers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
