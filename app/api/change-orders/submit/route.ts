import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluateChangeOrder, simulateCO } from '@/lib/cog';
import { writeEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { API_RESPONSES } from '@/lib/constants';

// Request validation schema
const ChangeOrderSubmitSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  trade: z.string().min(1, 'Trade is required'),
  deltaUsd: z.number().int('Delta must be an integer'),
  impactDays: z.number().int().min(0, 'Impact days must be non-negative').default(0),
  reason: z.string().optional(),
  evidence: z.array(z.string().url()).optional()
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, endpoint: '/api/change-orders/submit' });

  try {
    // API key authentication (required)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    // SECURITY: Check BOTH that expectedKey exists AND matches
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      log.warn({ apiKey: apiKey ? '[redacted]' : 'none' }, 'Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = ChangeOrderSubmitSchema.safeParse(body);

    if (!validation.success) {
      log.warn({ errors: validation.error.issues }, 'Validation failed');
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten(),
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    const { dealId, trade, deltaUsd, impactDays, reason, evidence } = validation.data;
    log.info({ dealId, trade, deltaUsd, impactDays }, 'Processing Change Order submission');

    // Verify deal exists
    const deal = await prisma.dealSpec.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      log.warn({ dealId }, 'Deal not found');
      return NextResponse.json(
        { error: 'Deal not found', dealId, requestId },
        { status: 404 }
      );
    }

    // Create the Change Order in proposed status
    const changeOrder = await prisma.changeOrder.create({
      data: {
        dealId,
        trade,
        deltaUsd,
        impactDays,
        status: 'proposed',
        rationale: reason || null
        // simResults intentionally omitted (defaults to NULL) — updated after simulation
      }
    });

    log.info({ changeOrderId: changeOrder.id }, 'Change Order created');

    // Evaluate the Change Order against guardrails
    const evaluation = await evaluateChangeOrder({
      dealId,
      trade,
      deltaUsd,
      impactDays,
      reason,
      evidence
    });

    const { approved, simulation, violations } = evaluation;

    // Update Change Order with simulation results
    await prisma.changeOrder.update({
      where: { id: changeOrder.id },
      data: {
        status: approved ? 'approved' : 'denied',
        simResults: simulation as any,
        decidedAt: new Date(),
        decidedBy: 'system:G4'
      }
    });

    // If approved and delta is positive, update budget ledger
    if (approved && deltaUsd > 0) {
      const ledger = await prisma.budgetLedger.findUnique({
        where: { dealId }
      });

      if (ledger) {
        // BudgetLedger.committed is a JSON-string column — parse defensively.
        let committed: Record<string, number> = {};
        try {
          committed = ledger.committed ? JSON.parse(ledger.committed) ?? {} : {};
        } catch {
          committed = {};
        }
        const tradeCommitted = committed[trade] || 0;

        // Update trade-specific commitment
        committed[trade] = tradeCommitted + deltaUsd;

        // Update total commitment
        committed.total = Object.entries(committed)
          .filter(([key]) => key !== 'total')
          .reduce((sum, [, value]) => sum + value, 0);

        await prisma.budgetLedger.update({
          where: { dealId },
          data: { committed: JSON.stringify(committed) }
        });

        log.info({ trade, deltaUsd, newCommitted: committed[trade] }, 'Updated budget ledger commitments');
      }
    }

    // Write event for audit trail
    const eventAction = approved ? 'APPROVE_CO' : 'DENY_CO';
    const eventId = await writeEvent({
      dealId,
      actor: 'system:G4',
      artifact: 'ChangeOrder',
      action: eventAction,
      after: {
        changeOrderId: changeOrder.id,
        trade,
        deltaUsd,
        impactDays,
        reason,
        evidence,
        simulation: {
          before: simulation.before,
          after: simulation.after,
          deltas: simulation.deltas
        },
        guardrails: {
          maxExposureUsd: deal.maxExposureUsd,
          targetRoiPct: deal.targetRoiPct
        },
        violations,
        decision: approved ? 'APPROVED' : 'DENIED',
        rationale: violations.message || 'All guardrails passed'
      }
    });

    // Build response
    const response = {
      status: approved ? 'APPROVED' : 'DENIED',
      changeOrderId: changeOrder.id,
      trade,
      deltaUsd,
      impactDays,
      reason: violations.message || 'Change Order evaluation complete',
      guardrails: {
        maxExposureUsd: deal.maxExposureUsd,
        targetRoiPct: deal.targetRoiPct
      },
      before: simulation.before,
      after: simulation.after,
      deltas: simulation.deltas,
      violations: {
        exposure: violations.exposure,
        roi: violations.roi
      },
      eventId,
      requestId
    };

    // Return 200 for both approved and denied (business logic decision, not error)
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    log.error({ error }, 'Change Order submission failed');
    return NextResponse.json(
      {
        error: 'Failed to process Change Order',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      },
      { status: 500 }
    );
  }
}