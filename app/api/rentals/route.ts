import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/rentals
 * Create a rental property from a closed contract
 * Body: {
 *   contractId?: string,
 *   propertyId: string,
 *   monthlyRent: number,
 *   deposit?: number,
 *   leaseStart?: string,
 *   leaseEnd?: string,
 *   purchasePrice?: number,
 *   mortgagePayment?: number,
 *   propertyTax?: number,
 *   insurance?: number,
 *   hoa?: number,
 *   utilities?: number,
 *   maintenance?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await request.json();

    // Validate required fields
    if (!body.propertyId || body.monthlyRent === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, monthlyRent' },
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

    // If contractId provided, verify contract ownership and that it doesn't have a rental
    let contract = null;
    if (body.contractId) {
      contract = await prisma.contract.findFirst({
        where: {
          id: body.contractId,
          userId,
        },
        include: {
          rental: true,
        },
      });

      if (!contract) {
        return NextResponse.json(
          { error: 'Contract not found or does not belong to user' },
          { status: 404 }
        );
      }

      if (contract.rental) {
        return NextResponse.json(
          { error: 'Contract already has a rental property' },
          { status: 400 }
        );
      }
    }

    // Create rental
    const rental = await prisma.rental.create({
      data: {
        userId,
        propertyId: body.propertyId,
        contractId: body.contractId || null,
        address: property.address,
        monthlyRent: body.monthlyRent,
        deposit: body.deposit || null,
        leaseStart: body.leaseStart ? new Date(body.leaseStart) : null,
        leaseEnd: body.leaseEnd ? new Date(body.leaseEnd) : null,
        status: body.status || 'vacant',
        purchasePrice: body.purchasePrice || contract?.purchasePrice || null,
        mortgagePayment: body.mortgagePayment || null,
        propertyTax: body.propertyTax || null,
        insurance: body.insurance || null,
        hoa: body.hoa || null,
        utilities: body.utilities || null,
        maintenance: body.maintenance || null,
      },
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

    return NextResponse.json({
      success: true,
      rental: {
        id: rental.id,
        contractId: rental.contractId,
        propertyId: rental.propertyId,
        address: rental.address,
        monthlyRent: rental.monthlyRent,
        deposit: rental.deposit,
        leaseStart: rental.leaseStart,
        leaseEnd: rental.leaseEnd,
        status: rental.status,
        purchasePrice: rental.purchasePrice,
        mortgagePayment: rental.mortgagePayment,
        propertyTax: rental.propertyTax,
        insurance: rental.insurance,
        hoa: rental.hoa,
        utilities: rental.utilities,
        maintenance: rental.maintenance,
        totalIncome: rental.totalIncome,
        totalExpenses: rental.totalExpenses,
        occupancyRate: rental.occupancyRate,
        createdAt: rental.createdAt,
        property: rental.property,
        _count: rental._count,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating rental:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rentals
 * List all rentals for authenticated user
 * Query params:
 *  - status: filter by status (vacant, leased, maintenance, listed)
 *  - propertyId: filter by property
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

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

    const rentals = await prisma.rental.findMany({
      where,
      include: {
        property: true,
        contract: {
          include: {
            property: true,
          },
        },
        tenants: {
          where: {
            status: 'active',
          },
          orderBy: {
            leaseStart: 'desc',
          },
        },
        income: {
          orderBy: {
            receivedDate: 'desc',
          },
          take: 10,
        },
        expenses: {
          orderBy: {
            expenseDate: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            tenants: true,
            income: true,
            expenses: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ rentals });
  } catch (error) {
    console.error('Error fetching rentals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
