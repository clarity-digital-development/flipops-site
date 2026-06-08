import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

// POST /api/contracts
// Create a contract from an accepted offer
export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = clerkUserId;

    const body = await request.json();
    const { offerId, closingDate, notes } = body;

    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the offer and verify it belongs to the user
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        property: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (offer.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to access this offer' }, { status: 403 });
    }

    // Verify offer is accepted
    if (offer.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Can only create contracts from accepted offers' },
        { status: 400 }
      );
    }

    // Check if contract already exists for this offer
    const existingContract = await prisma.contract.findUnique({
      where: { offerId },
    });

    if (existingContract) {
      return NextResponse.json(
        { error: 'Contract already exists for this offer' },
        { status: 400 }
      );
    }

    // Create the contract
    const contract = await prisma.contract.create({
      data: {
        userId: user.id,
        propertyId: offer.propertyId,
        offerId: offer.id,
        purchasePrice: offer.amount,
        closingDate: closingDate ? new Date(closingDate) : null,
        notes: notes || null,
        status: 'pending',
      },
      include: {
        property: true,
        offer: true,
      },
    });

    // Auto-create closing tasks (only if closing date is set)
    if (closingDate) {
      const closingDateObj = new Date(closingDate);
      const closingTasksData = [
        {
          title: 'Schedule home inspection',
          description: `Schedule and complete home inspection for ${offer.property.address}`,
          type: 'custom',
          priority: 'high',
          dueDate: new Date(closingDateObj.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days before closing
        },
        {
          title: 'Order appraisal',
          description: `Order property appraisal for ${offer.property.address}`,
          type: 'custom',
          priority: 'high',
          dueDate: new Date(closingDateObj.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days before closing
        },
        {
          title: 'Apply for financing',
          description: `Submit financing application for ${offer.property.address}`,
          type: 'custom',
          priority: 'high',
          dueDate: new Date(closingDateObj.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days before closing
        },
        {
          title: 'Review title report',
          description: `Review title report and resolve any title issues for ${offer.property.address}`,
          type: 'custom',
          priority: 'medium',
          dueDate: new Date(closingDateObj.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days before closing
        },
        {
          title: 'Schedule final walkthrough',
          description: `Schedule and complete final walkthrough of ${offer.property.address}`,
          type: 'custom',
          priority: 'medium',
          dueDate: new Date(closingDateObj.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before closing
        },
        {
          title: 'Prepare closing documents',
          description: `Review and prepare all closing documents for ${offer.property.address}`,
          type: 'custom',
          priority: 'high',
          dueDate: new Date(closingDateObj.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before closing
        },
        {
          title: 'Wire closing funds',
          description: `Wire funds for closing on ${offer.property.address}`,
          type: 'custom',
          priority: 'high',
          dueDate: new Date(closingDateObj.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before closing
        },
      ];

      // Create tasks for this contract
      await prisma.task.createMany({
        data: closingTasksData.map((task) => ({
          userId: user.id,
          propertyId: offer.propertyId,
          ...task,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        propertyId: contract.propertyId,
        offerId: contract.offerId,
        purchasePrice: contract.purchasePrice,
        status: contract.status,
        closingDate: contract.closingDate,
        signedAt: contract.signedAt,
        escrowOpenedAt: contract.escrowOpenedAt,
        closedAt: contract.closedAt,
        notes: contract.notes,
        createdAt: contract.createdAt,
        property: contract.property,
        offer: contract.offer,
      },
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }
}

// Admin email that should NOT see demo data
const ADMIN_EMAIL = 'tannercarlson@vvsvault.com';
// Demo user email whose data is shown to all non-admin users
const DEMO_USER_EMAIL = 'tanner@claritydigital.dev';

// GET /api/contracts
// List all contracts for the current user (+ demo data for non-admin users)
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = clerkUserId;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    // Check if user is admin or the demo user themselves
    const isAdmin = user?.email === ADMIN_EMAIL;
    const isDemoUser = user?.email === DEMO_USER_EMAIL;

    // For non-admin users (except demo user), also fetch demo data
    let demoContracts: Awaited<ReturnType<typeof prisma.contract.findMany>> = [];
    if (!isAdmin && !isDemoUser) {
      const demoUser = await prisma.user.findFirst({
        where: { email: DEMO_USER_EMAIL },
      });

      if (demoUser) {
        demoContracts = await prisma.contract.findMany({
          where: { userId: demoUser.id },
          include: {
            property: true,
            offer: true,
            assignment: {
              include: {
                buyer: true,
              },
            },
            renovation: {
              include: {
                _count: {
                  select: {
                    scopeNodes: true,
                    bids: true,
                    changeOrders: true,
                    tasks: true,
                  },
                },
              },
            },
            rental: {
              include: {
                _count: {
                  select: {
                    tenants: true,
                    income: true,
                    expenses: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }
    }

    // Get user's own contracts (if user exists)
    let contracts: Awaited<ReturnType<typeof prisma.contract.findMany>> = [];
    if (user) {
      contracts = await prisma.contract.findMany({
        where: { userId: user.id },
        include: {
          property: true,
          offer: true,
          assignment: {
            include: {
              buyer: true,
            },
          },
          renovation: {
            include: {
              _count: {
                select: {
                  scopeNodes: true,
                  bids: true,
                  changeOrders: true,
                  tasks: true,
                },
              },
            },
          },
          rental: {
            include: {
              _count: {
                select: {
                  tenants: true,
                  income: true,
                  expenses: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // Join most-recent DealAnalysis per (userId, propertyId) for ARV + repair display
    // on the Buyers Listings tab. Owner scoping: user contracts -> user.id,
    // demo contracts -> demoUser.id. Map key: `${ownerUserId}:${propertyId}`.
    const dealLookupPairs: Array<{ ownerUserId: string; propertyId: string }> = [];
    if (user) {
      for (const c of contracts) {
        dealLookupPairs.push({ ownerUserId: user.id, propertyId: c.propertyId });
      }
    }
    if (demoContracts.length > 0) {
      const demoOwnerId = demoContracts[0].userId; // all demo rows share demoUser.id
      for (const c of demoContracts) {
        dealLookupPairs.push({ ownerUserId: demoOwnerId, propertyId: c.propertyId });
      }
    }

    const dealLookup = new Map<string, { arv: number; estimatedRepairCost: number }>();
    if (dealLookupPairs.length > 0) {
      const uniqueUserIds = Array.from(new Set(dealLookupPairs.map((p) => p.ownerUserId)));
      const uniquePropertyIds = Array.from(new Set(dealLookupPairs.map((p) => p.propertyId)));
      const analyses = await prisma.dealAnalysis.findMany({
        where: {
          userId: { in: uniqueUserIds },
          propertyId: { in: uniquePropertyIds },
        },
        select: { userId: true, propertyId: true, arv: true, repairTotal: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      // findMany is ordered desc by createdAt, so the first hit per key wins (most recent).
      for (const a of analyses) {
        const key = `${a.userId}:${a.propertyId}`;
        if (!dealLookup.has(key)) {
          dealLookup.set(key, { arv: a.arv, estimatedRepairCost: a.repairTotal });
        }
      }
    }

    const resolveDeal = (ownerUserId: string, propertyId: string) =>
      dealLookup.get(`${ownerUserId}:${propertyId}`) ?? null;

    // Combine user contracts with demo contracts (demo contracts marked with isDemo flag)
    const allContracts = [
      ...contracts.map((contract) => ({
        id: contract.id,
        propertyId: contract.propertyId,
        offerId: contract.offerId,
        purchasePrice: contract.purchasePrice,
        status: contract.status,
        closingDate: contract.closingDate,
        signedAt: contract.signedAt,
        escrowOpenedAt: contract.escrowOpenedAt,
        closedAt: contract.closedAt,
        notes: contract.notes,
        documentUrls: contract.documentUrls ? JSON.parse(contract.documentUrls) : [],
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        property: {
          id: contract.property.id,
          address: contract.property.address,
          city: contract.property.city,
          state: contract.property.state,
          zip: contract.property.zip,
        },
        offer: {
          id: contract.offer.id,
          amount: contract.offer.amount,
          status: contract.offer.status,
        },
        assignment: contract.assignment,
        renovation: contract.renovation,
        rental: contract.rental,
        deal: user ? resolveDeal(user.id, contract.propertyId) : null,
        isDemo: false,
      })),
      ...demoContracts.map((contract) => ({
        id: contract.id,
        propertyId: contract.propertyId,
        offerId: contract.offerId,
        purchasePrice: contract.purchasePrice,
        status: contract.status,
        closingDate: contract.closingDate,
        signedAt: contract.signedAt,
        escrowOpenedAt: contract.escrowOpenedAt,
        closedAt: contract.closedAt,
        notes: contract.notes,
        documentUrls: contract.documentUrls ? JSON.parse(contract.documentUrls) : [],
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        property: {
          id: contract.property.id,
          address: contract.property.address,
          city: contract.property.city,
          state: contract.property.state,
          zip: contract.property.zip,
        },
        offer: {
          id: contract.offer.id,
          amount: contract.offer.amount,
          status: contract.offer.status,
        },
        assignment: contract.assignment,
        renovation: contract.renovation,
        rental: contract.rental,
        deal: resolveDeal(contract.userId, contract.propertyId),
        isDemo: true,
      })),
    ];

    return NextResponse.json({ contracts: allContracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
  }
}
