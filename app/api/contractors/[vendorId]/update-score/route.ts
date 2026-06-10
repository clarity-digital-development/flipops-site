import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import log from '@/lib/logger';

// NOTE: Use shared prisma singleton, never create new PrismaClient instances

interface ScoreUpdate {
  onTimePct?: number;
  onBudgetPct?: number;
  reliability?: number;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;
  try {
    // API key authentication (required)
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    // SECURITY: Check BOTH that expectedKey exists AND matches
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ScoreUpdate = await req.json();

    // Validate vendor exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        onTimePct: true,
        onBudgetPct: true,
        reliability: true
      }
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: 'Vendor not found', vendorId },
        { status: 404 }
      );
    }

    // Validate score values (0-100)
    if (body.onTimePct !== undefined && (body.onTimePct < 0 || body.onTimePct > 100)) {
      return NextResponse.json(
        { error: 'onTimePct must be between 0 and 100' },
        { status: 400 }
      );
    }
    if (body.onBudgetPct !== undefined && (body.onBudgetPct < 0 || body.onBudgetPct > 100)) {
      return NextResponse.json(
        { error: 'onBudgetPct must be between 0 and 100' },
        { status: 400 }
      );
    }
    if (body.reliability !== undefined && (body.reliability < 0 || body.reliability > 100)) {
      return NextResponse.json(
        { error: 'reliability must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Track changes
    const changes: any = {};
    if (body.onTimePct !== undefined && body.onTimePct !== existingVendor.onTimePct) {
      changes.onTimePct = {
        old: existingVendor.onTimePct,
        new: body.onTimePct,
        delta: body.onTimePct - existingVendor.onTimePct
      };
    }
    if (body.onBudgetPct !== undefined && body.onBudgetPct !== existingVendor.onBudgetPct) {
      changes.onBudgetPct = {
        old: existingVendor.onBudgetPct,
        new: body.onBudgetPct,
        delta: body.onBudgetPct - existingVendor.onBudgetPct
      };
    }
    if (body.reliability !== undefined && body.reliability !== existingVendor.reliability) {
      changes.reliability = {
        old: existingVendor.reliability,
        new: body.reliability,
        delta: body.reliability - existingVendor.reliability
      };
    }

    const hasChanges = Object.keys(changes).length > 0;

    // Update vendor scores
    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(body.onTimePct !== undefined && { onTimePct: body.onTimePct }),
        ...(body.onBudgetPct !== undefined && { onBudgetPct: body.onBudgetPct }),
        ...(body.reliability !== undefined && { reliability: body.reliability })
      }
    });

    log.info(
      { vendorId, vendorName: existingVendor.name, changes, hasChanges },
      'Contractor reliability scores updated'
    );

    return NextResponse.json({
      success: true,
      vendor: updatedVendor,
      changes,
      hasChanges,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    log.error({ error, vendorId }, 'Failed to update contractor scores');
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
  // NOTE: Do not call prisma.$disconnect() - uses shared singleton
}
