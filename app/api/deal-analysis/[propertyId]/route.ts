import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * GET /api/deal-analysis/[propertyId]
 * Get all deal analyses for a property
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { propertyId } = await params;

    // Verify the property belongs to the user
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        userId,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Get all analyses for this property
    const analyses = await prisma.dealAnalysis.findMany({
      where: {
        propertyId,
        userId, // Extra security layer
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });

    // Parse JSON fields
    const formattedAnalyses = analyses.map((analysis) => ({
      ...analysis,
      compsUsed: analysis.compsUsed ? JSON.parse(analysis.compsUsed) : null,
      repairItems: analysis.repairItems ? JSON.parse(analysis.repairItems) : null,
    }));

    return NextResponse.json({ analyses: formattedAnalyses });
  } catch (error) {
    console.error('Error fetching deal analyses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
