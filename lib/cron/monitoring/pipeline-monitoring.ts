/**
 * Pipeline Monitoring Cron Job
 *
 * Schedule: Daily at 8 AM
 * Purpose: Track deals stalled at each gate and send daily summary
 */

import {
  createLogger,
  prisma,
  closePrismaConnection,
  getActiveUsers,
  sendSlackNotification,
  createSlackTable,
} from '../shared';

const logger = createLogger('Pipeline Monitoring');

interface StalledDeal {
  gate: string;
  dealId: string;
  address?: string;
  stalledFor: number; // hours
  status: string;
  details: any;
}

interface GateSummary {
  G1: number;
  G2: number;
  G3: number;
  G4: number;
  total: number;
}

/**
 * Main workflow function
 */
async function pipelineMonitoring() {
  logger.info('Starting pipeline monitoring');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Monitoring pipeline for ${usersWithSlack.length} users`);

    let totalStalled = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking stalled deals for user: ${user.name}`);

        // Get stalled deals for this user
        const { stalledDeals, summary } = await getStalledDeals(user.id);

        if (stalledDeals.length === 0) {
          logger.debug(`No stalled deals for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${stalledDeals.length} stalled deals for user: ${user.name}`
        );

        totalStalled += stalledDeals.length;

        // Send Slack notification
        const sent = await sendPipelineSummary(
          user.slackWebhook!,
          stalledDeals,
          summary,
          user.name
        );

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(`Failed to process pipeline for user ${user.id}`, error);
      }
    }

    logger.success(
      `Pipeline monitoring complete: ${totalStalled} stalled deals found, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('Pipeline monitoring workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get stalled deals for a user (using the same logic as /api/deals/stalled)
 */
async function getStalledDeals(userId: string): Promise<{
  stalledDeals: StalledDeal[];
  summary: GateSummary;
}> {
  const stalledDeals: StalledDeal[] = [];
  const now = new Date();

  // G1: Deals without APPROVE or BLOCK events (stuck in approval limbo)
  const g1Threshold = 72; // 3 days in hours
  const g1DealsWithEvents = await prisma.event.findMany({
    where: {
      artifact: 'DealSpec',
      action: { in: ['APPROVE', 'BLOCK'] },
      actor: 'system:G1',
    },
    select: { dealId: true },
    distinct: ['dealId'],
  });

  const g1ProcessedDealIds = g1DealsWithEvents
    .map((e) => e.dealId)
    .filter((id) => id !== null) as string[];

  const g1StalledDeals = await prisma.dealSpec.findMany({
    where: {
      userId,
      id: { notIn: g1ProcessedDealIds },
      createdAt: {
        lte: new Date(now.getTime() - g1Threshold * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      address: true,
      createdAt: true,
      maxExposureUsd: true,
      targetRoiPct: true,
    },
    take: 20,
  });

  for (const deal of g1StalledDeals) {
    const hoursSinceCreation = Math.floor(
      (now.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60)
    );
    stalledDeals.push({
      gate: 'G1',
      dealId: deal.id,
      address: deal.address,
      stalledFor: hoursSinceCreation,
      status: 'pending_approval',
      details: {
        maxExposureUsd: deal.maxExposureUsd,
        targetRoiPct: deal.targetRoiPct,
        createdAt: deal.createdAt,
      },
    });
  }

  // G2: Bids pending award for > 5 days (120 hours)
  const g2Threshold = 120; // 5 days in hours
  const g2StalledBids = await prisma.bid.findMany({
    where: {
      status: 'pending',
      createdAt: {
        lte: new Date(now.getTime() - g2Threshold * 60 * 60 * 1000),
      },
    },
    include: {
      deal: {
        select: {
          id: true,
          userId: true,
          address: true,
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 20,
  });

  for (const bid of g2StalledBids.filter((b) => b.deal?.userId === userId)) {
    const hoursSinceCreation = Math.floor(
      (now.getTime() - bid.createdAt.getTime()) / (1000 * 60 * 60)
    );
    stalledDeals.push({
      gate: 'G2',
      dealId: bid.dealId,
      address: bid.deal!.address,
      stalledFor: hoursSinceCreation,
      status: 'bid_pending',
      details: {
        bidId: bid.id,
        vendorId: bid.vendorId,
        vendorName: bid.vendor?.name || 'Unknown',
        subtotal: bid.subtotal,
        createdAt: bid.createdAt,
      },
    });
  }

  // G3: Invoices pending processing for > 2 days (48 hours)
  const g3Threshold = 48; // 2 days in hours
  const g3StalledInvoices = await prisma.invoice.findMany({
    where: {
      status: 'pending',
      createdAt: {
        lte: new Date(now.getTime() - g3Threshold * 60 * 60 * 1000),
      },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 20,
  });

  // Group invoices by dealId to get deal addresses
  const g3DealIds = [...new Set(g3StalledInvoices.map((inv) => inv.dealId))];
  const g3Deals = await prisma.dealSpec.findMany({
    where: {
      userId,
      id: { in: g3DealIds },
    },
    select: {
      id: true,
      address: true,
    },
  });

  const dealMap = new Map(g3Deals.map((d) => [d.id, d]));

  for (const invoice of g3StalledInvoices) {
    const deal = dealMap.get(invoice.dealId);
    if (!deal) continue; // Skip if not this user's deal

    const hoursSinceCreation = Math.floor(
      (now.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60)
    );
    stalledDeals.push({
      gate: 'G3',
      dealId: invoice.dealId,
      address: deal.address,
      stalledFor: hoursSinceCreation,
      status: 'invoice_pending',
      details: {
        invoiceId: invoice.id,
        trade: invoice.trade,
        amount: invoice.amount,
        vendorId: invoice.vendorId,
        vendorName: invoice.vendor?.name || 'Unknown',
        createdAt: invoice.createdAt,
      },
    });
  }

  // G4: Change orders pending approval for > 1 day (24 hours)
  const g4Threshold = 24; // 1 day in hours
  const g4StalledCOs = await prisma.changeOrder.findMany({
    where: {
      status: 'proposed',
      createdAt: {
        lte: new Date(now.getTime() - g4Threshold * 60 * 60 * 1000),
      },
    },
    include: {
      deal: {
        select: {
          id: true,
          userId: true,
          address: true,
        },
      },
    },
    take: 20,
  });

  for (const co of g4StalledCOs.filter((c) => c.deal.userId === userId)) {
    const hoursSinceCreation = Math.floor(
      (now.getTime() - co.createdAt.getTime()) / (1000 * 60 * 60)
    );
    stalledDeals.push({
      gate: 'G4',
      dealId: co.dealId,
      address: co.deal.address,
      stalledFor: hoursSinceCreation,
      status: 'change_order_pending',
      details: {
        changeOrderId: co.id,
        trade: co.trade,
        deltaUsd: co.deltaUsd,
        impactDays: co.impactDays,
        createdAt: co.createdAt,
      },
    });
  }

  // Sort by stalledFor (most stalled first)
  stalledDeals.sort((a, b) => b.stalledFor - a.stalledFor);

  const summary: GateSummary = {
    G1: stalledDeals.filter((d) => d.gate === 'G1').length,
    G2: stalledDeals.filter((d) => d.gate === 'G2').length,
    G3: stalledDeals.filter((d) => d.gate === 'G3').length,
    G4: stalledDeals.filter((d) => d.gate === 'G4').length,
    total: stalledDeals.length,
  };

  return { stalledDeals, summary };
}

/**
 * Send Slack pipeline summary
 */
async function sendPipelineSummary(
  slackWebhook: string,
  stalledDeals: StalledDeal[],
  summary: GateSummary,
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending pipeline summary to ${userName} for ${stalledDeals.length} stalled deals`
  );

  // Build summary table
  const summaryText =
    `*Gate Summary:*\n` +
    `• G1 (Pending Approval): ${summary.G1} deals\n` +
    `• G2 (Pending Bid Award): ${summary.G2} deals\n` +
    `• G3 (Pending Invoice): ${summary.G3} deals\n` +
    `• G4 (Pending Change Order): ${summary.G4} deals\n` +
    `\n*Total Stalled: ${summary.total} deals*`;

  // Build top stalled deals (limit to 5)
  const topStalled = stalledDeals
    .slice(0, 5)
    .map((deal, index) => {
      const daysStalled = Math.floor(deal.stalledFor / 24);
      const hoursStalled = deal.stalledFor % 24;
      return (
        `${index + 1}. *${deal.address || deal.dealId}*\n` +
        `   Gate: ${deal.gate} | Status: ${deal.status}\n` +
        `   Stalled for: ${daysStalled}d ${hoursStalled}h`
      );
    })
    .join('\n\n');

  const moreDealsText =
    stalledDeals.length > 5
      ? `\n\n_...and ${stalledDeals.length - 5} more stalled deals_`
      : '';

  const message = `${summaryText}\n\n*Top Stalled Deals:*\n\n${topStalled}${moreDealsText}`;

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '📊 Pipeline Monitoring - Daily Summary',
    message,
    color: summary.total > 10 ? 'warning' : 'good',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send pipeline summary to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`Pipeline summary sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  pipelineMonitoring()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { pipelineMonitoring };
