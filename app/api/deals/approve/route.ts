import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { estimate, checkMaxExposure } from '@/lib/estimator';
import { writeEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { API_RESPONSES } from '@/lib/constants';

// Request validation schema
const ApprovalRequestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  region: z.string().min(1, 'Region is required'),
  grade: z.enum(['Standard', 'Premium', 'Luxury'], {
    message: 'Grade must be Standard, Premium, or Luxury'
  })
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, endpoint: '/api/deals/approve' });

  try {
    // API key authentication (required)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    // SECURITY: Check BOTH that expectedKey exists AND matches
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      log.warn({ apiKey: apiKey ? '[redacted]' : 'none' }, 'Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = ApprovalRequestSchema.safeParse(body);

    if (!validationResult.success) {
      log.warn({ errors: validationResult.error.issues }, 'Validation failed');
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    const { dealId, region, grade } = validationResult.data;
    log.info({ dealId, region, grade }, 'Processing deal approval');

    // 1. Load DealSpec
    const deal = await prisma.dealSpec.findUnique({
      where: { id: dealId },
      include: {
        scopeNodes: true
      }
    });

    if (!deal) {
      log.warn({ dealId }, 'Deal not found');
      return NextResponse.json(
        {
          error: 'Deal not found',
          dealId,
          requestId
        },
        { status: API_RESPONSES.NOT_FOUND }
      );
    }

    // 2. Load Policy for region/grade.
    // Policy is unique on (userId, region, grade); this API-key automation
    // endpoint has no user context, so prefer the global default (userId null).
    const policy = await prisma.policy.findFirst({
      where: { region, grade },
      orderBy: { userId: { sort: 'asc', nulls: 'first' } }
    });

    if (!policy) {
      log.warn({ region, grade }, 'No policy found for region/grade');
      return NextResponse.json(
        {
          error: 'No policy configured for this region and grade',
          region,
          grade,
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    // 3. Run estimation
    const estimation = await estimate({
      dealId,
      region,
      grade,
      includeUncertainty: true,
      monteCarloRuns: 1000
    });

    log.info({
      dealId,
      baseline: estimation.baseline,
      p50: estimation.p50,
      p80: estimation.p80,
      p95: estimation.p95,
      maxExposureUsd: policy.maxExposureUsd
    }, 'Estimation complete');

    // 4. Gate G1 check: P80 vs MaxExposure
    const passesG1 = estimation.p80 <= policy.maxExposureUsd;

    if (!passesG1) {
      // Deal is BLOCKED
      const overBy = estimation.p80 - policy.maxExposureUsd;
      const overByPct = (overBy / policy.maxExposureUsd) * 100;

      // Write event for blocked deal
      const eventId = await writeEvent({
        dealId,
        actor: 'system:G1',
        artifact: 'DealSpec',
        action: 'BLOCK',
        metadata: {
          reason: 'P80 exceeds max exposure',
          p80: estimation.p80,
          maxExposureUsd: policy.maxExposureUsd,
          overBy,
          overByPct: Math.round(overByPct * 100) / 100,
          drivers: estimation.drivers.slice(0, 5)
        }
      });

      log.warn({
        dealId,
        p80: estimation.p80,
        maxExposureUsd: policy.maxExposureUsd,
        overBy,
        eventId
      }, 'Deal blocked by G1 - P80 exceeds max exposure');

      return NextResponse.json(
        {
          status: 'BLOCKED_G1',
          reason: 'P80 exceeds maximum exposure limit',
          metrics: {
            p50: estimation.p50,
            p80: estimation.p80,
            p95: estimation.p95,
            maxExposureUsd: policy.maxExposureUsd,
            overBy,
            overByPct: Math.round(overByPct * 100) / 100
          },
          drivers: estimation.drivers.slice(0, 5),
          recommendation: 'Reduce scope or negotiate better pricing',
          eventId,
          requestId
        },
        { status: API_RESPONSES.GUARDRAIL_VIOLATION }
      );
    }

    // 5. Deal is APPROVED
    // Update deal status (optional - add status field to DealSpec if needed)
    // For now, we'll just log the approval

    // Write event for approved deal
    const eventId = await writeEvent({
      dealId,
      actor: 'system:G1',
      artifact: 'DealSpec',
      action: 'APPROVE',
      metadata: {
        p50: estimation.p50,
        p80: estimation.p80,
        p95: estimation.p95,
        maxExposureUsd: policy.maxExposureUsd,
        headroom: policy.maxExposureUsd - estimation.p80,
        headroomPct: ((policy.maxExposureUsd - estimation.p80) / policy.maxExposureUsd) * 100
      }
    });

    log.info({
      dealId,
      p80: estimation.p80,
      maxExposureUsd: policy.maxExposureUsd,
      headroom: policy.maxExposureUsd - estimation.p80,
      eventId
    }, 'Deal approved by G1');

    return NextResponse.json(
      {
        status: 'APPROVED',
        dealId,
        metrics: {
          baseline: estimation.baseline,
          p50: estimation.p50,
          p80: estimation.p80,
          p95: estimation.p95
        },
        policy: {
          maxExposureUsd: policy.maxExposureUsd,
          targetRoiPct: policy.targetRoiPct,
          contingencyTargetPct: policy.contingencyTargetPct
        },
        headroom: {
          amount: policy.maxExposureUsd - estimation.p80,
          percentage: Math.round(((policy.maxExposureUsd - estimation.p80) / policy.maxExposureUsd) * 100 * 100) / 100
        },
        byTrade: estimation.byTrade,
        eventId,
        requestId
      },
      { status: API_RESPONSES.SUCCESS }
    );

  } catch (error) {
    log.error({ error }, 'Failed to process deal approval');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId
      },
      { status: 500 }
    );
  }
}