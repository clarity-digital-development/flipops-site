import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/comps
 * Get comparable properties for underwriting analysis
 *
 * Query params:
 *   - city: Required - city to search comps in
 *   - state: Required - state to search comps in
 *   - propertyType: Optional - filter by property type
 *   - beds: Optional - target bedroom count (will search ±1)
 *   - baths: Optional - target bathroom count (will search ±1)
 *   - sqft: Optional - target square footage (will search ±20%)
 *   - yearBuilt: Optional - target year (will search ±10 years)
 *   - limit: Optional - max number of comps to return (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const _userId = guard.userId;
    void _userId;

    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const propertyType = searchParams.get('propertyType');
    const beds = searchParams.get('beds') ? parseInt(searchParams.get('beds')!) : null;
    const baths = searchParams.get('baths') ? parseFloat(searchParams.get('baths')!) : null;
    const sqft = searchParams.get('sqft') ? parseInt(searchParams.get('sqft')!) : null;
    const yearBuilt = searchParams.get('yearBuilt') ? parseInt(searchParams.get('yearBuilt')!) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const excludeId = searchParams.get('excludeId'); // Exclude the subject property

    // Require at least city and state
    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required parameters' },
        { status: 400 }
      );
    }

    // Build the where clause for finding comparable properties
    const where: any = {
      city: { equals: city, mode: 'insensitive' },
      state: { equals: state, mode: 'insensitive' },
      // Only include properties with sale data for comps
      OR: [
        { lastSalePrice: { not: null } },
        { estimatedValue: { not: null } },
      ],
    };

    // Exclude the subject property if provided
    if (excludeId) {
      where.id = { not: excludeId };
    }

    // Add property type filter
    if (propertyType) {
      where.propertyType = { equals: propertyType, mode: 'insensitive' };
    }

    // Add bedroom range filter (±1 bedroom)
    if (beds !== null) {
      where.bedrooms = {
        gte: Math.max(1, beds - 1),
        lte: beds + 1,
      };
    }

    // Add bathroom range filter (±1 bathroom)
    if (baths !== null) {
      where.bathrooms = {
        gte: Math.max(1, baths - 1),
        lte: baths + 1,
      };
    }

    // Add sqft range filter (±20%)
    if (sqft !== null) {
      where.squareFeet = {
        gte: Math.round(sqft * 0.8),
        lte: Math.round(sqft * 1.2),
      };
    }

    // Add year built range filter (±10 years)
    if (yearBuilt !== null) {
      where.yearBuilt = {
        gte: yearBuilt - 10,
        lte: yearBuilt + 10,
      };
    }

    // Query for comparable properties
    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        propertyType: true,
        bedrooms: true,
        bathrooms: true,
        squareFeet: true,
        yearBuilt: true,
        lastSaleDate: true,
        lastSalePrice: true,
        estimatedValue: true,
        assessedValue: true,
      },
      orderBy: [
        { lastSaleDate: 'desc' }, // Most recent sales first
      ],
      take: limit * 2, // Get more than needed to filter and rank
    });

    // Calculate similarity score and price per sqft for each comp
    const comps = properties.map(prop => {
      // Use lastSalePrice if available, otherwise estimatedValue
      const salePrice = prop.lastSalePrice || prop.estimatedValue || 0;
      const pricePerSqft = prop.squareFeet && prop.squareFeet > 0
        ? Math.round(salePrice / prop.squareFeet)
        : 0;

      // Calculate similarity score (0-100)
      let similarity = 100;

      // Bedroom difference penalty
      if (beds !== null && prop.bedrooms !== null) {
        similarity -= Math.abs(beds - prop.bedrooms) * 5;
      }

      // Bathroom difference penalty
      if (baths !== null && prop.bathrooms !== null) {
        similarity -= Math.abs(baths - prop.bathrooms) * 5;
      }

      // Sqft difference penalty
      if (sqft !== null && prop.squareFeet !== null) {
        const sqftDiff = Math.abs(sqft - prop.squareFeet) / sqft;
        similarity -= Math.round(sqftDiff * 30);
      }

      // Year built difference penalty
      if (yearBuilt !== null && prop.yearBuilt !== null) {
        const yearDiff = Math.abs(yearBuilt - prop.yearBuilt);
        similarity -= Math.round(yearDiff * 0.5);
      }

      // Sale recency bonus (more recent = better)
      if (prop.lastSaleDate) {
        const monthsAgo = getMonthsAgo(prop.lastSaleDate);
        if (monthsAgo <= 3) similarity += 5;
        else if (monthsAgo <= 6) similarity += 2;
        else if (monthsAgo > 12) similarity -= 5;
      }

      return {
        id: prop.id,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        propertyType: prop.propertyType,
        beds: prop.bedrooms,
        baths: prop.bathrooms,
        sqft: prop.squareFeet,
        yearBuilt: prop.yearBuilt,
        soldDate: prop.lastSaleDate,
        soldPrice: salePrice,
        pricePerSqft,
        similarity: Math.max(0, Math.min(100, similarity)),
        // Mock distance - would need lat/lng for real calculation
        distance: Math.random() * 0.5 + 0.1,
        // Default selection for top 3
        selected: false,
        weight: 0,
      };
    });

    // Sort by similarity and take the limit
    const sortedComps = comps
      .filter(c => c.soldPrice > 0 && c.pricePerSqft > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((comp, index) => ({
        ...comp,
        // Auto-select top 3
        selected: index < 3,
        // Assign weights based on similarity
        weight: index < 3 ? Math.round((comp.similarity / 100) * 35) / 100 : 0,
      }));

    // Calculate aggregate stats
    const selectedComps = sortedComps.filter(c => c.selected);
    const avgPricePerSqft = selectedComps.length > 0
      ? Math.round(selectedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / selectedComps.length)
      : 0;

    return NextResponse.json({
      comps: sortedComps,
      stats: {
        totalFound: properties.length,
        returned: sortedComps.length,
        avgPricePerSqft,
        medianPricePerSqft: getMedian(sortedComps.map(c => c.pricePerSqft)),
      },
    });
  } catch (error) {
    console.error('Error fetching comps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate months ago
function getMonthsAgo(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  return months;
}

// Helper function to calculate median
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
