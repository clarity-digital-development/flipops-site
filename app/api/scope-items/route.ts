import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

// POST /api/scope-items
// Body: { dealId: string, trade: string, task: string, quantity: number, unit?: string, finishLvl?: string }
// Creates a ScopeTreeNode after verifying the DealSpec belongs to the caller.
// Uses Clerk auth (browser-callable) — the FO_API_KEY-gated guardrail endpoints
// can't be hit from the dialog directly.

const Schema = z.object({
  dealId: z.string().min(1),
  trade: z.string().min(1),
  task: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional().default('lot'),
  finishLvl: z.string().optional(),
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

    const { dealId, trade, task, quantity, unit, finishLvl } = parsed.data;

    // Verify deal ownership (multi-tenant gate).
    const deal = await prisma.dealSpec.findFirst({
      where: { id: dealId, userId },
    });
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found or not owned by user' },
        { status: 404 },
      );
    }

    const scopeItem = await prisma.scopeTreeNode.create({
      data: {
        dealId,
        trade,
        task,
        quantity: { value: quantity, unit: unit || 'lot', method: 'manual' },
        finishLvl: finishLvl ?? null,
        assumptions: [],
      },
    });

    return NextResponse.json({ success: true, scopeItem }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/scope-items]', error);
    // Duplicate (dealId,trade,task) unique constraint will hit P2002.
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
