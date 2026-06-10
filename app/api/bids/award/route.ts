import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { compareBids, type BidItem } from '@/lib/normalizeBid';
import { writeEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { API_RESPONSES, GUARDRAILS } from '@/lib/constants';

// Request validation schema
const BidAwardRequestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  winningBidId: z.string().min(1, 'Winning bid ID is required')
});

/** Bid.items is a JSON-string column — parse defensively. */
function parseBidItems(raw: string | null | undefined): BidItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, endpoint: '/api/bids/award' });

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
    const validationResult = BidAwardRequestSchema.safeParse(body);

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

    const { dealId, winningBidId } = validationResult.data;
    log.info({ dealId, winningBidId }, 'Processing bid award');

    // 1. Load the winning bid
    const winningBid = await prisma.bid.findUnique({
      where: { id: winningBidId },
      include: { vendor: true }
    });

    if (!winningBid || winningBid.dealId !== dealId) {
      log.warn({ winningBidId, dealId }, 'Winning bid not found for deal');
      return NextResponse.json(
        {
          error: 'Winning bid not found for this deal',
          winningBidId,
          dealId,
          requestId
        },
        { status: API_RESPONSES.NOT_FOUND }
      );
    }

    // 2. Extract trade/task from winning bid to find comparable bids
    const winningItems = parseBidItems(winningBid.items);
    if (!winningItems || winningItems.length === 0) {
      log.error({ winningBidId }, 'Winning bid has no items');
      return NextResponse.json(
        {
          error: 'Winning bid has no line items',
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    // For simplicity, compare based on the primary trade (first item's trade)
    const primaryTrade = winningItems[0].trade;
    const primaryTask = winningItems[0].task;

    log.info({ primaryTrade, primaryTask }, 'Comparing bids for trade/task');

    // 3. Load all bids for this deal and same primary trade
    const allBids = await prisma.bid.findMany({
      where: {
        dealId,
        status: { in: ['pending', 'awarded'] } // Include already awarded for comparison
      },
      include: { vendor: true }
    });

    // Filter bids that have items for the same trade
    const comparableBids = allBids.filter(bid => {
      const items = parseBidItems(bid.items);
      return items && items.some(item => item.trade === primaryTrade);
    });

    if (comparableBids.length < 2) {
      log.warn({ comparableBids: comparableBids.length }, 'Insufficient bids for spread analysis');
      return NextResponse.json(
        {
          error: 'Need at least 2 bids for spread analysis',
          availableBids: comparableBids.length,
          requestId
        },
        { status: API_RESPONSES.VALIDATION_ERROR }
      );
    }

    // 4. Normalize and compare bids
    const comparison = compareBids(
      comparableBids.map(bid => ({
        id: bid.id,
        vendorId: bid.vendorId,
        items: parseBidItems(bid.items),
        subtotal: bid.subtotal
      })),
      primaryTrade
    );

    log.info({
      stats: comparison.stats,
      outliers: comparison.outliers
    }, 'Bid comparison complete');

    // 5. Load deal and policy to check spread threshold
    const deal = await prisma.dealSpec.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      log.error({ dealId }, 'Deal not found');
      return NextResponse.json(
        {
          error: 'Deal not found',
          dealId,
          requestId
        },
        { status: API_RESPONSES.NOT_FOUND }
      );
    }

    // Get policy (for now using default region/grade from seed)
    const policy = await prisma.policy.findFirst({
      where: {
        region: 'Miami', // TODO: Add region to DealSpec
        grade: 'Standard' // TODO: Add grade to DealSpec
      }
    });

    if (!policy) {
      log.warn('No policy found, using default threshold');
    }

    const maxSpreadPct = policy?.bidSpreadMaxPct || GUARDRAILS.maxBidSpread;
    const spreadPct = comparison.stats.spreadPct / 100; // Convert to decimal

    // 6. Gate G2 check: Spread vs Threshold
    if (spreadPct > maxSpreadPct) {
      // Bid spread exceeds threshold - BLOCK
      const eventId = await writeEvent({
        dealId,
        actor: 'system:G2',
        artifact: 'Bid',
        action: 'BLOCK',
        metadata: {
          reason: 'Bid spread exceeds threshold',
          trade: primaryTrade,
          task: primaryTask,
          winningBidId,
          winningVendor: winningBid.vendor?.name || winningBid.vendorId,
          stats: {
            min: comparison.stats.min,
            median: comparison.stats.median,
            max: comparison.stats.max,
            spread: comparison.stats.spread,
            spreadPct: comparison.stats.spreadPct
          },
          threshold: maxSpreadPct * 100,
          outliers: comparison.outliers,
          allBids: comparison.normalized.map(n => ({
            bidId: n.bidId,
            vendorId: n.vendorId,
            total: n.comparableTotal
          }))
        }
      });

      log.warn({
        dealId,
        spreadPct: comparison.stats.spreadPct,
        threshold: maxSpreadPct * 100,
        eventId
      }, 'Bid award blocked by G2 - spread exceeds threshold');

      return NextResponse.json(
        {
          status: 'BLOCKED_G2',
          reason: `Bid spread ${comparison.stats.spreadPct.toFixed(1)}% exceeds threshold ${(maxSpreadPct * 100).toFixed(0)}%`,
          trade: primaryTrade,
          stats: {
            min: comparison.stats.min,
            median: comparison.stats.median,
            max: comparison.stats.max,
            spread: comparison.stats.spread,
            spreadPct: Math.round(comparison.stats.spreadPct * 10) / 10
          },
          threshold: maxSpreadPct * 100,
          outliers: comparison.outliers,
          recommendation: 'Request additional bids or negotiate with vendors',
          bids: comparison.normalized.map(n => ({
            bidId: n.bidId,
            vendorId: n.vendorId,
            total: n.comparableTotal,
            isOutlier: comparison.outliers.includes(n.bidId)
          })),
          eventId,
          requestId
        },
        { status: API_RESPONSES.GUARDRAIL_VIOLATION }
      );
    }

    // 7. Award the bid
    // Update bid status
    await prisma.bid.update({
      where: { id: winningBidId },
      data: {
        status: 'awarded',
        normalized: comparison.normalized.find(n => n.bidId === winningBidId)?.breakdown
      }
    });

    // Update other bids for same trade to rejected
    await prisma.bid.updateMany({
      where: {
        dealId,
        id: { not: winningBidId },
        status: 'pending'
      },
      data: {
        status: 'rejected'
      }
    });

    // Update BudgetLedger if it exists
    const ledger = await prisma.budgetLedger.findUnique({
      where: { dealId }
    });

    if (ledger) {
      const committed = ledger.committed as any || {};
      const winningTotal = comparison.normalized.find(n => n.bidId === winningBidId)?.comparableTotal || 0;

      if (!committed[primaryTrade]) {
        committed[primaryTrade] = 0;
      }
      committed[primaryTrade] += winningTotal;
      committed.total = Object.values(committed)
        .filter(v => typeof v === 'number')
        .reduce((sum: number, v: any) => sum + v, 0);

      await prisma.budgetLedger.update({
        where: { dealId },
        data: { committed }
      });

      log.info({
        dealId,
        trade: primaryTrade,
        committedAmount: winningTotal,
        totalCommitted: committed.total
      }, 'Budget ledger updated');
    }

    // Write success event
    const eventId = await writeEvent({
      dealId,
      actor: 'system:G2',
      artifact: 'Bid',
      action: 'AWARD',
      metadata: {
        winningBidId,
        winningVendor: winningBid.vendor?.name || winningBid.vendorId,
        trade: primaryTrade,
        task: primaryTask,
        awardedAmount: winningBid.subtotal,
        stats: {
          min: comparison.stats.min,
          median: comparison.stats.median,
          max: comparison.stats.max,
          spread: comparison.stats.spread,
          spreadPct: comparison.stats.spreadPct
        },
        threshold: maxSpreadPct * 100
      }
    });

    log.info({
      dealId,
      winningBidId,
      trade: primaryTrade,
      amount: winningBid.subtotal,
      eventId
    }, 'Bid awarded successfully');

    return NextResponse.json(
      {
        status: 'AWARDED',
        dealId,
        winningBidId,
        vendor: {
          id: winningBid.vendorId,
          name: winningBid.vendor?.name || 'Unknown'
        },
        trade: primaryTrade,
        awardedAmount: winningBid.subtotal,
        stats: {
          min: comparison.stats.min,
          median: comparison.stats.median,
          max: comparison.stats.max,
          spread: comparison.stats.spread,
          spreadPct: Math.round(comparison.stats.spreadPct * 10) / 10
        },
        threshold: maxSpreadPct * 100,
        savingsVsMax: comparison.stats.max - winningBid.subtotal,
        savingsVsMedian: comparison.stats.median - winningBid.subtotal,
        eventId,
        requestId
      },
      { status: API_RESPONSES.SUCCESS }
    );

  } catch (error) {
    log.error({ error }, 'Failed to process bid award');

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