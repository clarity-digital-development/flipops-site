import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-helpers';

/**
 * GET /api/dashboard/hot-leads
 * Get hot leads (score >= 85) for authenticated user
 */
export async function GET() {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    // Get top 5 hot leads with score >= 85
    const hotLeads = await prisma.property.findMany({
      where: {
        userId,
        score: { gte: 85 },
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        score: true,
        dataSource: true,
        enriched: true,
        lastContactDate: true,
        ownerName: true,
      },
      orderBy: [
        { score: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 5,
    });

    // Map to frontend format
    const formattedLeads = hotLeads.map((lead) => ({
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      score: lead.score || 0,
      dataSource: lead.dataSource || 'Unknown',
      skipTraced: lead.enriched || false,
      contacted: !!lead.lastContactDate,
      ownerName: lead.ownerName || null,
    }));

    return NextResponse.json({ hotLeads: formattedLeads });
  } catch (error) {
    console.error('Error fetching hot leads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
