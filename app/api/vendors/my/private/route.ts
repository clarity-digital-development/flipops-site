import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { VendorCategory } from '@prisma/client';

/**
 * POST /api/vendors/my/private
 * Create a private (user-owned) vendor
 * Body: {
 *   name: string (required)
 *   description?: string
 *   contactName?: string
 *   address?: string
 *   city?: string
 *   state?: string
 *   zip?: string
 *   phone?: string
 *   email?: string
 *   website?: string
 *   categories?: VendorCategory[]
 *   tags?: string[]
 *   personalRating?: number (1-5)
 *   notes?: string
 *   isFavorite?: boolean
 *   isPreferred?: boolean
 *   availabilityStatus?: string
 *   licenseNumber?: string
 *   insuranceVerified?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const user = { id: guard.userId };

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
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

    // Validate rating if provided
    if (body.personalRating !== undefined && body.personalRating !== null) {
      if (body.personalRating < 1 || body.personalRating > 5) {
        return NextResponse.json(
          { error: 'Personal rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    const vendor = await prisma.userVendor.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description,
        contactName: body.contactName,
        address: body.address,
        city: body.city,
        state: body.state?.toUpperCase(),
        zip: body.zip,
        phone: body.phone,
        email: body.email,
        website: body.website,
        categories: body.categories || [],
        tags: body.tags || [],
        personalRating: body.personalRating,
        notes: body.notes,
        isFavorite: body.isFavorite ?? false,
        isPreferred: body.isPreferred ?? false,
        availabilityStatus: body.availabilityStatus,
        licenseNumber: body.licenseNumber,
        insuranceVerified: body.insuranceVerified ?? false,
      },
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    console.error('Error creating private vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
