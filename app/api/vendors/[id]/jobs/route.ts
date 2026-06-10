import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { VendorCategory } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vendors/:id/jobs
 * Get job history for a vendor (either UserVendor or UserVendorRelationship)
 * Query params:
 *   - status: filter by job status (pending, scheduled, in_progress, completed, cancelled)
 *   - limit: number of results (default 20)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };
    const { id } = await context.params;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Determine if this is a UserVendor or UserVendorRelationship
    const isUserVendor = await prisma.userVendor.findFirst({
      where: { id, userId: user.id },
    });

    const where: any = { userId: user.id };

    if (isUserVendor) {
      where.userVendorId = id;
    } else {
      // Check if it's a valid relationship
      const relationship = await prisma.userVendorRelationship.findFirst({
        where: { id, userId: user.id },
      });

      if (!relationship) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      where.userVendorRelationshipId = id;
    }

    if (status) {
      where.status = status;
    }

    const jobs = await prisma.vendorJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        deal: {
          select: {
            id: true,
            address: true,
            status: true,
          },
        },
      },
    });

    // Get summary stats
    const [totalJobs, completedJobs, avgQuality, totalSpent] = await Promise.all([
      prisma.vendorJob.count({ where }),
      prisma.vendorJob.count({ where: { ...where, status: 'completed' } }),
      prisma.vendorJob.aggregate({
        where: { ...where, qualityRating: { not: null } },
        _avg: { qualityRating: true },
      }),
      prisma.vendorJob.aggregate({
        where: { ...where, finalAmount: { not: null } },
        _sum: { finalAmount: true },
      }),
    ]);

    return NextResponse.json({
      jobs,
      stats: {
        totalJobs,
        completedJobs,
        avgQualityRating: avgQuality._avg.qualityRating,
        totalSpent: totalSpent._sum.finalAmount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching vendor jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/:id/jobs
 * Record a new job with a vendor
 * Body: {
 *   title: string (required)
 *   description?: string
 *   category?: VendorCategory
 *   dealId?: string (link to a renovation)
 *   quotedAmount?: number
 *   scheduledDate?: string (ISO date)
 * }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };
    const { id } = await context.params;

    const body = await request.json();

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (body.category && !Object.values(VendorCategory).includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category: ${body.category}` },
        { status: 400 }
      );
    }

    // Determine if this is a UserVendor or UserVendorRelationship
    const isUserVendor = await prisma.userVendor.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    let jobData: any = {
      userId: user.id,
      title: body.title,
      description: body.description,
      category: body.category,
      quotedAmount: body.quotedAmount,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      status: 'pending',
    };

    if (isUserVendor) {
      jobData.userVendorId = id;
    } else {
      // Check if it's a valid relationship
      const relationship = await prisma.userVendorRelationship.findFirst({
        where: { id, userId: user.id },
      });

      if (!relationship) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      jobData.userVendorRelationshipId = id;

      // Update lastUsedAt on the relationship
      await prisma.userVendorRelationship.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    }

    // Link to deal if provided
    if (body.dealId) {
      const deal = await prisma.dealSpec.findFirst({
        where: { id: body.dealId, userId: user.id },
      });

      if (!deal) {
        return NextResponse.json(
          { error: 'Deal not found or not authorized' },
          { status: 404 }
        );
      }

      jobData.dealId = body.dealId;
    }

    const job = await prisma.vendorJob.create({
      data: jobData,
      include: {
        deal: {
          select: {
            id: true,
            address: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
