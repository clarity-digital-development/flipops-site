import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * Helper to get userId via the canonical requireUser() guard.
 * Preserves this route's historical { error, status, userId } shape.
 */
async function getAuthenticatedUserId() {
  const guard = await requireUser();
  if ('error' in guard) {
    const status = guard.error.status;
    return {
      error: status === 404 ? 'User not found' : 'Unauthorized',
      status,
      userId: null,
    };
  }
  return { error: null, status: null, userId: guard.userId };
}

interface BuyerMatch {
  buyerId: string;
  buyerName: string;
  buyerCompany: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  score: number;
  reasons: string[];
  priceMatch: boolean;
  marketMatch: boolean;
  cashBuyer: boolean;
  reliability: string;
  dealsClosed: number;
}

/**
 * GET /api/smart-matching
 * Get smart matching results for a contract
 * Query params:
 *   - contractId: required - the contract to match buyers for
 *   - limit: optional - max number of matches to return (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { error, status, userId } = await getAuthenticatedUserId();
    if (error || !userId) {
      return NextResponse.json({ error }, { status: status! });
    }

    const searchParams = request.nextUrl.searchParams;
    const contractId = searchParams.get('contractId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!contractId) {
      return NextResponse.json(
        { error: 'Missing required parameter: contractId' },
        { status: 400 }
      );
    }

    // Get the contract with property details
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        userId,
      },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            propertyType: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get all buyers for this user
    const buyers = await prisma.buyer.findMany({
      where: { userId },
    });

    // Calculate match scores for each buyer
    const matches: BuyerMatch[] = buyers.map((buyer) => {
      let score = 0;
      const reasons: string[] = [];

      // Parse JSON fields
      const targetMarkets: string[] = buyer.targetMarkets
        ? (typeof buyer.targetMarkets === 'string'
            ? JSON.parse(buyer.targetMarkets)
            : buyer.targetMarkets)
        : [];
      const propertyTypes: string[] = buyer.propertyTypes
        ? (typeof buyer.propertyTypes === 'string'
            ? JSON.parse(buyer.propertyTypes)
            : buyer.propertyTypes)
        : [];

      // Price match (30 points)
      const contractPrice = contract.purchasePrice;
      const priceMatch =
        (buyer.minPrice === null || contractPrice >= buyer.minPrice) &&
        (buyer.maxPrice === null || contractPrice <= buyer.maxPrice);

      if (priceMatch) {
        score += 30;
        reasons.push('Price in range');
      } else if (buyer.minPrice && contractPrice < buyer.minPrice) {
        // Partial credit if close
        const diff = (buyer.minPrice - contractPrice) / buyer.minPrice;
        if (diff < 0.1) {
          score += 15;
          reasons.push('Price slightly below range');
        }
      } else if (buyer.maxPrice && contractPrice > buyer.maxPrice) {
        const diff = (contractPrice - buyer.maxPrice) / buyer.maxPrice;
        if (diff < 0.1) {
          score += 15;
          reasons.push('Price slightly above range');
        }
      }

      // Market match (25 points)
      const propertyCity = contract.property.city.toLowerCase();
      const propertyState = contract.property.state.toLowerCase();
      const marketMatch = targetMarkets.some((market) => {
        const marketLower = market.toLowerCase();
        return (
          marketLower.includes(propertyCity) ||
          marketLower.includes(propertyState) ||
          propertyCity.includes(marketLower.split(',')[0].trim())
        );
      });

      if (marketMatch) {
        score += 25;
        reasons.push('Active in market');
      } else if (targetMarkets.length === 0) {
        // No market preference = open to all
        score += 15;
        reasons.push('No market restrictions');
      }

      // Property type match (15 points)
      const contractPropertyType = contract.property.propertyType?.toLowerCase() || '';
      const propertyTypeMatch =
        propertyTypes.length === 0 ||
        propertyTypes.some((type) =>
          contractPropertyType.includes(type.toLowerCase()) ||
          type.toLowerCase().includes(contractPropertyType)
        );

      if (propertyTypeMatch && propertyTypes.length > 0) {
        score += 15;
        reasons.push('Preferred property type');
      } else if (propertyTypes.length === 0) {
        score += 10;
        reasons.push('No property type restrictions');
      }

      // Cash buyer bonus (10 points)
      if (buyer.cashBuyer) {
        score += 10;
        reasons.push('Cash buyer - fast close');
      }

      // Reliability bonus (10 points)
      if (buyer.reliability === 'reliable') {
        score += 10;
        reasons.push('Reliable buyer');
      } else if (buyer.reliability === 'unreliable') {
        score -= 10;
        reasons.push('Historically unreliable');
      }

      // Deal history bonus (10 points max)
      if (buyer.dealsClosed >= 10) {
        score += 10;
        reasons.push('Experienced (10+ deals)');
      } else if (buyer.dealsClosed >= 5) {
        score += 7;
        reasons.push('Active buyer (5+ deals)');
      } else if (buyer.dealsClosed >= 1) {
        score += 4;
        reasons.push('Has closed deals before');
      }

      // Normalize score to 0-100
      score = Math.max(0, Math.min(100, score));

      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerCompany: buyer.company,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        score,
        reasons,
        priceMatch,
        marketMatch,
        cashBuyer: buyer.cashBuyer,
        reliability: buyer.reliability,
        dealsClosed: buyer.dealsClosed,
      };
    });

    // Sort by score descending and limit results
    const sortedMatches = matches
      .filter((m) => m.score > 0) // Only include buyers with some match
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({
      matches: sortedMatches,
      contract: {
        id: contract.id,
        purchasePrice: contract.purchasePrice,
        property: contract.property,
      },
      totalBuyers: buyers.length,
      matchedBuyers: sortedMatches.length,
    });
  } catch (error) {
    console.error('Error calculating smart matches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
