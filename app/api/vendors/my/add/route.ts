import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/vendors/my/add
 * Add a platform vendor to user's list (creates UserVendorRelationship)
 * Body: {
 *   platformVendorId: string (required)
 *   personalRating?: number (1-5)
 *   notes?: string
 *   tags?: string[]
 *   isFavorite?: boolean
 *   isPreferred?: boolean
 *   contactName?: string
 *   contactPhone?: string
 *   contactEmail?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };

    const body = await request.json();

    // Validate required fields
    if (!body.platformVendorId) {
      return NextResponse.json(
        { error: 'Missing required field: platformVendorId' },
        { status: 400 }
      );
    }

    // Check if platform vendor exists
    const platformVendor = await prisma.platformVendor.findUnique({
      where: { id: body.platformVendorId },
      include: {
        market: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!platformVendor) {
      return NextResponse.json(
        { error: 'Platform vendor not found' },
        { status: 404 }
      );
    }

    if (platformVendor.deletedAt) {
      return NextResponse.json(
        { error: 'Platform vendor is no longer available' },
        { status: 410 }
      );
    }

    // Check if relationship already exists
    const existing = await prisma.userVendorRelationship.findUnique({
      where: {
        userId_platformVendorId: {
          userId: user.id,
          platformVendorId: body.platformVendorId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Vendor already in your list', relationship: existing },
        { status: 409 }
      );
    }

    // Validate rating if provided
    if (body.personalRating !== undefined && body.personalRating !== null) {
      if (body.personalRating < 1 || body.personalRating > 5) {
        return NextResponse.json(
          { error: 'Personal rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Create relationship
    const relationship = await prisma.userVendorRelationship.create({
      data: {
        userId: user.id,
        platformVendorId: body.platformVendorId,
        personalRating: body.personalRating,
        notes: body.notes,
        tags: body.tags || [],
        isFavorite: body.isFavorite ?? false,
        isPreferred: body.isPreferred ?? false,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
      },
      include: {
        platformVendor: {
          include: {
            market: true,
          },
        },
      },
    });

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    console.error('Error adding platform vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
