import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { VendorCategory } from '@prisma/client';

/**
 * GET /api/vendors/my
 * Get user's vendors (both private UserVendor and UserVendorRelationship with platform vendors)
 * Query params:
 *   - category: filter by trade category
 *   - search: search by name
 *   - favorites: filter favorites only (true/false)
 *   - preferred: filter preferred only (true/false)
 *   - type: filter by type ("private" for UserVendor, "platform" for relationships)
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const favorites = searchParams.get('favorites');
    const preferred = searchParams.get('preferred');
    const type = searchParams.get('type');

    // Build results array combining both vendor types
    const results: any[] = [];

    // Get UserVendors (private vendors) unless filtering for platform only
    if (type !== 'platform') {
      const userVendorWhere: any = {
        userId: user.id,
        deletedAt: null,
      };

      if (category && Object.values(VendorCategory).includes(category as VendorCategory)) {
        userVendorWhere.categories = { has: category as VendorCategory };
      }

      if (search) {
        userVendorWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (favorites === 'true') {
        userVendorWhere.isFavorite = true;
      }

      if (preferred === 'true') {
        userVendorWhere.isPreferred = true;
      }

      const userVendors = await prisma.userVendor.findMany({
        where: userVendorWhere,
        include: {
          _count: {
            select: { jobs: true },
          },
        },
        orderBy: [
          { isFavorite: 'desc' },
          { isPreferred: 'desc' },
          { name: 'asc' },
        ],
      });

      // Normalize to unified format
      for (const vendor of userVendors) {
        results.push({
          id: vendor.id,
          type: 'private' as const,
          name: vendor.name,
          description: vendor.description,
          contactName: vendor.contactName,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          zip: vendor.zip,
          phone: vendor.phone,
          email: vendor.email,
          website: vendor.website,
          categories: vendor.categories,
          tags: vendor.tags,
          personalRating: vendor.personalRating,
          notes: vendor.notes,
          isFavorite: vendor.isFavorite,
          isPreferred: vendor.isPreferred,
          availabilityStatus: vendor.availabilityStatus,
          licenseNumber: vendor.licenseNumber,
          insuranceVerified: vendor.insuranceVerified,
          jobCount: vendor._count.jobs,
          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt,
          // Platform-specific fields (null for private vendors)
          sourceRating: null,
          sourceReviewCount: null,
          source: null,
          isVerified: false,
          platformVendorId: null,
        });
      }
    }

    // Get UserVendorRelationships (platform vendors added to list) unless filtering for private only
    if (type !== 'private') {
      const relationshipWhere: any = {
        userId: user.id,
        platformVendor: {
          deletedAt: null,
        },
      };

      if (favorites === 'true') {
        relationshipWhere.isFavorite = true;
      }

      if (preferred === 'true') {
        relationshipWhere.isPreferred = true;
      }

      const relationships = await prisma.userVendorRelationship.findMany({
        where: relationshipWhere,
        include: {
          platformVendor: {
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
          },
          _count: {
            select: { jobs: true },
          },
        },
        orderBy: [
          { isFavorite: 'desc' },
          { isPreferred: 'desc' },
          { addedAt: 'desc' },
        ],
      });

      // Filter and normalize
      for (const rel of relationships) {
        const vendor = rel.platformVendor;

        // Apply category filter (on platform vendor's categories)
        if (category && Object.values(VendorCategory).includes(category as VendorCategory)) {
          if (!vendor.categories.includes(category as VendorCategory)) {
            continue;
          }
        }

        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          if (
            !vendor.name.toLowerCase().includes(searchLower) &&
            !(vendor.description?.toLowerCase().includes(searchLower))
          ) {
            continue;
          }
        }

        results.push({
          id: rel.id,
          type: 'platform' as const,
          name: vendor.name,
          description: vendor.description,
          contactName: rel.contactName || null,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          zip: vendor.zip,
          phone: rel.contactPhone || vendor.phone,
          email: rel.contactEmail || vendor.email,
          website: vendor.website,
          categories: vendor.categories,
          tags: rel.tags,
          personalRating: rel.personalRating,
          notes: rel.notes,
          isFavorite: rel.isFavorite,
          isPreferred: rel.isPreferred,
          availabilityStatus: null, // Platform vendors don't have availability
          licenseNumber: vendor.licenseNumber,
          insuranceVerified: vendor.insuranceVerified,
          jobCount: rel._count.jobs,
          createdAt: rel.addedAt,
          updatedAt: rel.updatedAt,
          // Platform-specific fields
          sourceRating: vendor.sourceRating,
          sourceReviewCount: vendor.sourceReviewCount,
          source: vendor.source,
          isVerified: vendor.isVerified,
          platformVendorId: vendor.id,
          market: vendor.market,
        });
      }
    }

    // Sort combined results
    results.sort((a, b) => {
      // Favorites first
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      // Then preferred
      if (a.isPreferred !== b.isPreferred) {
        return a.isPreferred ? -1 : 1;
      }
      // Then by name
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ vendors: results });
  } catch (error) {
    console.error('Error fetching user vendors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
