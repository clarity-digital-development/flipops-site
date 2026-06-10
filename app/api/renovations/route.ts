import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/renovations
 * Start a renovation project from a closed contract
 * Body: {
 *   contractId: string,
 *   propertyId: string,
 *   maxExposureUsd: number,
 *   targetRoiPct: number,
 *   arv?: number,
 *   type?: string,
 *   startAt?: string,
 *   constraints?: array
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const userId = guard.userId;

    const body = await request.json();

    // Validate required fields
    if (!body.contractId || !body.propertyId || body.maxExposureUsd === undefined || body.targetRoiPct === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, propertyId, maxExposureUsd, targetRoiPct' },
        { status: 400 }
      );
    }

    // Verify contract belongs to user and is closed
    const contract = await prisma.contract.findFirst({
      where: {
        id: body.contractId,
        userId,
      },
      include: {
        property: true,
        renovation: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Check if contract already has a renovation
    if (contract.renovation) {
      return NextResponse.json(
        { error: 'Contract already has a renovation project' },
        { status: 400 }
      );
    }

    // Verify property belongs to user
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

    // Create renovation (DealSpec)
    const renovation = await prisma.dealSpec.create({
      data: {
        userId,
        contractId: body.contractId,
        propertyId: body.propertyId,
        address: contract.property.address,
        type: body.type || property.propertyType || 'single_family',
        maxExposureUsd: body.maxExposureUsd,
        targetRoiPct: body.targetRoiPct,
        arv: body.arv,
        region: `${property.city}, ${property.state}`,
        grade: body.grade || 'Standard',
        status: 'planning',
        startAt: body.startAt ? new Date(body.startAt) : null,
        constraints: body.constraints ? JSON.stringify(body.constraints) : JSON.stringify([]),
        dailyBurnUsd: body.dailyBurnUsd || 0,
      },
      include: {
        property: true,
        contract: {
          include: {
            property: true,
          },
        },
        budgetLedger: true,
        scopeNodes: true,
      },
    });

    return NextResponse.json({
      success: true,
      renovation: {
        id: renovation.id,
        contractId: renovation.contractId,
        propertyId: renovation.propertyId,
        address: renovation.address,
        type: renovation.type,
        maxExposureUsd: renovation.maxExposureUsd,
        targetRoiPct: renovation.targetRoiPct,
        arv: renovation.arv,
        region: renovation.region,
        grade: renovation.grade,
        status: renovation.status,
        startAt: renovation.startAt,
        completedAt: renovation.completedAt,
        constraints: JSON.parse(renovation.constraints),
        createdAt: renovation.createdAt,
        property: renovation.property,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating renovation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/renovations
 * List all renovations for authenticated user
 * Query params:
 *  - status: filter by status (planning, active, on_hold, completed, cancelled)
 *  - propertyId: filter by property
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

    const renovations = await prisma.dealSpec.findMany({
      where,
      include: {
        property: true,
        contract: {
          include: {
            property: true,
          },
        },
        budgetLedger: true,
        scopeNodes: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        bids: {
          include: {
            vendor: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            scopeNodes: true,
            bids: true,
            changeOrders: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response with parsed JSON fields
    const formattedRenovations = renovations.map((renovation) => ({
      ...renovation,
      constraints: JSON.parse(renovation.constraints),
    }));

    return NextResponse.json({ renovations: formattedRenovations });
  } catch (error) {
    console.error('Error fetching renovations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
