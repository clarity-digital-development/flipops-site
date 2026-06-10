import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/markets
 * Get all active markets
 * Query params:
 *   - state: filter by state code (e.g., "FL", "AZ")
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;

    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state');

    const where: any = { isActive: true };

    if (state) {
      where.state = state.toUpperCase();
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: [
        { state: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        latitude: true,
        longitude: true,
        radiusMiles: true,
        isActive: true,
        _count: {
          select: {
            platformVendors: true,
          },
        },
      },
    });

    return NextResponse.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/markets
 * Create a new market (admin only in the future, for now allow authenticated users)
 * Body: {
 *   name: string,
 *   city: string,
 *   state: string,
 *   country?: string,
 *   latitude?: number,
 *   longitude?: number,
 *   radiusMiles?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.city || !body.state) {
      return NextResponse.json(
        { error: 'Missing required fields: name, city, state' },
        { status: 400 }
      );
    }

    // Check for existing market
    const existing = await prisma.market.findFirst({
      where: {
        city: body.city,
        state: body.state.toUpperCase(),
        country: body.country || 'US',
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Market already exists', market: existing },
        { status: 409 }
      );
    }

    const market = await prisma.market.create({
      data: {
        name: body.name,
        city: body.city,
        state: body.state.toUpperCase(),
        country: body.country || 'US',
        latitude: body.latitude,
        longitude: body.longitude,
        radiusMiles: body.radiusMiles || 50,
        isActive: true,
      },
    });

    return NextResponse.json({ market }, { status: 201 });
  } catch (error) {
    console.error('Error creating market:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
