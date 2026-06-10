import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// NOTE: Use shared prisma singleton, never create new PrismaClient instances

// Schema for score update
const ScoreUpdateSchema = z.object({
  score: z.number().min(0).max(100),
  scoredAt: z.string(),
  scoreBreakdown: z.object({
    foreclosure: z.number(),
    preForeclosure: z.number(),
    taxDelinquent: z.number(),
    vacant: z.number(),
    bankruptcy: z.number(),
    absenteeOwner: z.number(),
  }),
  potentialProfit: z.number().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // API key authentication (required)
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    // SECURITY: Check BOTH that expectedKey exists AND matches
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (id.startsWith('virt-')) {
      return NextResponse.json(
        {
          error: 'Virtual lead — promote it first',
          hint: 'POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.',
          code: 'VIRTUAL_LEAD_NOT_PROMOTED',
        },
        { status: 409 },
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const scoreData = ScoreUpdateSchema.parse(body);

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Update the property with score
    const updated = await prisma.property.update({
      where: { id },
      data: {
        score: scoreData.score,
        scoredAt: new Date(scoreData.scoredAt),
        scoreBreakdown: JSON.stringify(scoreData.scoreBreakdown),
        potentialProfit: scoreData.potentialProfit,
        updatedAt: new Date(),
      },
    });

    console.log(`[POST /api/properties/${id}/score] Scored property: ${updated.address} (Score: ${updated.score})`);

    return NextResponse.json({
      success: true,
      message: 'Property scored successfully',
      data: {
        id: updated.id,
        address: updated.address,
        city: updated.city,
        state: updated.state,
        zip: updated.zip,
        ownerName: updated.ownerName,
        propertyType: updated.propertyType,
        bedrooms: updated.bedrooms,
        bathrooms: updated.bathrooms,
        squareFeet: updated.squareFeet,
        assessedValue: updated.assessedValue,
        estimatedValue: updated.estimatedValue,
        score: updated.score,
        scoredAt: updated.scoredAt,
        scoreBreakdown: updated.scoreBreakdown,
        potentialProfit: updated.potentialProfit,
        foreclosure: updated.foreclosure,
        preForeclosure: updated.preForeclosure,
        taxDelinquent: updated.taxDelinquent,
        vacant: updated.vacant,
        bankruptcy: updated.bankruptcy,
        absenteeOwner: updated.absenteeOwner,
      },
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('[POST /api/properties/:id/score Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
  // NOTE: Do not call prisma.$disconnect() - uses shared singleton
}
