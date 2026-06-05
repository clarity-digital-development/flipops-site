import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

// POST /api/change-orders
// Body: { dealId, trade, deltaUsd, impactDays?, reason? }
// Creates a ChangeOrder in 'proposed' status. The existing
// /api/change-orders/submit endpoint requires FO_API_KEY and runs the full
// guardrail simulation; this Clerk-auth wrapper lets users submit COs from
// the Renovations UI. The G4 cron picks up 'proposed' COs and evaluates.

const Schema = z.object({
  dealId: z.string().min(1),
  trade: z.string().min(1),
  deltaUsd: z.number().int(),
  impactDays: z.number().int().min(0).optional().default(0),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { dealId, trade, deltaUsd, impactDays, reason } = parsed.data;

    const deal = await prisma.dealSpec.findFirst({
      where: { id: dealId, userId },
    });
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found or not owned by user' },
        { status: 404 },
      );
    }

    const changeOrder = await prisma.changeOrder.create({
      data: {
        dealId,
        trade,
        deltaUsd,
        impactDays,
        status: 'proposed',
        rationale: reason ?? null,
        simResults: undefined,
      },
    });

    return NextResponse.json({ success: true, changeOrder }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/change-orders]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
