import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { VendorCategory } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vendors/my/:id
 * Get a single vendor from user's list (either UserVendor or UserVendorRelationship)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };
    const { id } = await context.params;

    // Try to find as UserVendor first
    const userVendor = await prisma.userVendor.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
      },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { jobs: true },
        },
      },
    });

    if (userVendor) {
      return NextResponse.json({
        vendor: {
          ...userVendor,
          type: 'private',
          platformVendorId: null,
          sourceRating: null,
          sourceReviewCount: null,
          source: null,
          isVerified: false,
        },
      });
    }

    // Try to find as UserVendorRelationship
    const relationship = await prisma.userVendorRelationship.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        platformVendor: {
          include: {
            market: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { jobs: true },
        },
      },
    });

    if (relationship) {
      const pv = relationship.platformVendor;
      return NextResponse.json({
        vendor: {
          id: relationship.id,
          type: 'platform',
          name: pv.name,
          description: pv.description,
          contactName: relationship.contactName,
          address: pv.address,
          city: pv.city,
          state: pv.state,
          zip: pv.zip,
          phone: relationship.contactPhone || pv.phone,
          email: relationship.contactEmail || pv.email,
          website: pv.website,
          categories: pv.categories,
          tags: relationship.tags,
          personalRating: relationship.personalRating,
          notes: relationship.notes,
          isFavorite: relationship.isFavorite,
          isPreferred: relationship.isPreferred,
          availabilityStatus: null,
          licenseNumber: pv.licenseNumber,
          insuranceVerified: pv.insuranceVerified,
          sourceRating: pv.sourceRating,
          sourceReviewCount: pv.sourceReviewCount,
          source: pv.source,
          isVerified: pv.isVerified,
          platformVendorId: pv.id,
          market: pv.market,
          jobs: relationship.jobs,
          _count: relationship._count,
          createdAt: relationship.addedAt,
          updatedAt: relationship.updatedAt,
        },
      });
    }

    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/my/:id
 * Update user-specific data for a vendor
 * For UserVendor: can update all fields
 * For UserVendorRelationship: can update personalRating, notes, tags, isFavorite, isPreferred, contact overrides
 * Body: Partial vendor fields
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };
    const { id } = await context.params;

    const body = await request.json();

    // Validate rating if provided
    if (body.personalRating !== undefined && body.personalRating !== null) {
      if (body.personalRating < 1 || body.personalRating > 5) {
        return NextResponse.json(
          { error: 'Personal rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Validate categories if provided
    if (body.categories && Array.isArray(body.categories)) {
      const validCategories = Object.values(VendorCategory);
      for (const cat of body.categories) {
        if (!validCategories.includes(cat)) {
          return NextResponse.json(
            { error: `Invalid category: ${cat}` },
            { status: 400 }
          );
        }
      }
    }

    // Try to update as UserVendor first
    const existingUserVendor = await prisma.userVendor.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (existingUserVendor) {
      const updated = await prisma.userVendor.update({
        where: { id },
        data: {
          name: body.name ?? existingUserVendor.name,
          description: body.description,
          contactName: body.contactName,
          address: body.address,
          city: body.city,
          state: body.state?.toUpperCase(),
          zip: body.zip,
          phone: body.phone,
          email: body.email,
          website: body.website,
          categories: body.categories ?? existingUserVendor.categories,
          tags: body.tags ?? existingUserVendor.tags,
          personalRating: body.personalRating,
          notes: body.notes,
          isFavorite: body.isFavorite ?? existingUserVendor.isFavorite,
          isPreferred: body.isPreferred ?? existingUserVendor.isPreferred,
          availabilityStatus: body.availabilityStatus,
          licenseNumber: body.licenseNumber,
          insuranceVerified: body.insuranceVerified ?? existingUserVendor.insuranceVerified,
        },
      });

      return NextResponse.json({ vendor: { ...updated, type: 'private' } });
    }

    // Try to update as UserVendorRelationship
    const existingRelationship = await prisma.userVendorRelationship.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (existingRelationship) {
      const updated = await prisma.userVendorRelationship.update({
        where: { id },
        data: {
          personalRating: body.personalRating,
          notes: body.notes,
          tags: body.tags ?? existingRelationship.tags,
          isFavorite: body.isFavorite ?? existingRelationship.isFavorite,
          isPreferred: body.isPreferred ?? existingRelationship.isPreferred,
          contactName: body.contactName,
          contactPhone: body.contactPhone ?? body.phone,
          contactEmail: body.contactEmail ?? body.email,
          lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt) : undefined,
        },
        include: {
          platformVendor: {
            include: {
              market: true,
            },
          },
        },
      });

      return NextResponse.json({
        vendor: {
          ...updated,
          type: 'platform',
          name: updated.platformVendor.name,
        },
      });
    }

    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vendors/my/:id
 * Remove a vendor from user's list
 * For UserVendor: soft delete (sets deletedAt)
 * For UserVendorRelationship: hard delete (removes the relationship)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };
    const { id } = await context.params;

    // Try to soft delete as UserVendor first
    const existingUserVendor = await prisma.userVendor.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (existingUserVendor) {
      await prisma.userVendor.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return NextResponse.json({ success: true, type: 'private' });
    }

    // Try to delete as UserVendorRelationship
    const existingRelationship = await prisma.userVendorRelationship.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (existingRelationship) {
      // Check if there are any jobs associated
      const jobCount = await prisma.vendorJob.count({
        where: { userVendorRelationshipId: id },
      });

      if (jobCount > 0) {
        // If there are jobs, we could either soft delete (if we add a deletedAt to relationships)
        // or just return an error. For now, let's just delete the relationship
        // but the jobs will remain orphaned (userVendorRelationshipId will be null)
        // This is a design decision - you might want to cascade delete jobs or prevent deletion
      }

      await prisma.userVendorRelationship.delete({
        where: { id },
      });

      return NextResponse.json({ success: true, type: 'platform' });
    }

    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
