import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/deal-analysis
 * Create a new deal analysis
 * Body: {
 *   propertyId: string,
 *   arv: number,
 *   arvMethod: string,
 *   compsUsed?: object[],
 *   repairTotal: number,
 *   repairItems?: object[],
 *   maxOffer: number,
 *   rule?: string,
 *   offerAmount?: number,
 *   purchasePrice?: number,
 *   closingCosts?: number,
 *   holdingCosts?: number,
 *   holdingMonths?: number,
 *   sellingCosts?: number,
 *   projectedProfit?: number,
 *   roi?: number,
 *   name?: string,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await request.json();

    // Validate required fields
    if (!body.propertyId || body.arv === undefined || body.repairTotal === undefined || body.maxOffer === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, arv, repairTotal, maxOffer' },
        { status: 400 }
      );
    }

    // Verify the property belongs to the user
    const property = await prisma.property.findFirst({
      where: {
        id: body.propertyId,
        userId,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Create deal analysis
    const analysis = await prisma.dealAnalysis.create({
      data: {
        userId,
        propertyId: body.propertyId,
        arv: body.arv,
        arvMethod: body.arvMethod || 'manual',
        compsUsed: body.compsUsed ? JSON.stringify(body.compsUsed) : null,
        repairTotal: body.repairTotal,
        repairItems: body.repairItems ? JSON.stringify(body.repairItems) : null,
        maxOffer: body.maxOffer,
        rule: body.rule || '70%',
        offerAmount: body.offerAmount,
        purchasePrice: body.purchasePrice,
        closingCosts: body.closingCosts,
        holdingCosts: body.holdingCosts,
        holdingMonths: body.holdingMonths,
        sellingCosts: body.sellingCosts,
        projectedProfit: body.projectedProfit,
        roi: body.roi,
        name: body.name,
        notes: body.notes,
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

    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    console.error('Error creating deal analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
