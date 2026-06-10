/**
 * Contractor Performance Tracking Cron Job
 *
 * Schedule: Daily at 8 AM
 * Purpose: Calculate contractor reliability scores and send alerts for poor performers
 */

import {
  createLogger,
  prisma,
  closePrismaConnection,
  getActiveUsers,
  sendSlackNotification,
  formatCurrency,
  formatPercent,
} from '../shared';

const logger = createLogger('Contractor Performance');

interface ContractorPerformance {
  vendorId: string;
  vendorName: string;
  trade: string;
  totalBids: number;
  awardedBids: number;
  totalInvoices: number;
  totalInvoiced: number;
  avgBidAmount: number;
  avgInvoiceAmount: number;
  budgetVariance: number;
  changeOrders: number;
  avgChangeOrderCost: number;
  currentReliability: number;
  onTimePct: number;
  onBudgetPct: number;
  flags: string[];
}

/**
 * Main workflow function
 */
async function contractorPerformanceTracking() {
  logger.info('Starting contractor performance tracking');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Tracking contractor performance for ${usersWithSlack.length} users`);

    let totalFlagged = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking contractor performance for user: ${user.name}`);

        // Get contractor performance data
        const contractors = await getContractorPerformance(user.id);
        const flaggedContractors = contractors.filter((c) => c.flags.length > 0);

        if (flaggedContractors.length === 0) {
          logger.debug(`No flagged contractors for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${flaggedContractors.length} flagged contractors for user: ${user.name}`
        );

        totalFlagged += flaggedContractors.length;

        // Send Slack notification
        const sent = await sendContractorAlert(
          user.slackWebhook!,
          flaggedContractors,
          user.name ?? 'Unknown'
        );

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process contractor performance for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `Contractor performance tracking complete: ${totalFlagged} flagged contractors, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('Contractor performance tracking workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get contractor performance metrics (same logic as /api/contractors/performance)
 */
async function getContractorPerformance(
  userId: string
): Promise<ContractorPerformance[]> {
  // Get all vendors with their bids, invoices
  const vendors = await prisma.vendor.findMany({
    where: { userId },
    include: {
      bids: {
        select: {
          id: true,
          dealId: true,
          subtotal: true,
          status: true,
          createdAt: true,
        },
      },
      invoices: {
        select: {
          id: true,
          dealId: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  // Get all change orders
  const allChangeOrders = await prisma.changeOrder.findMany({
    select: {
      id: true,
      dealId: true,
      deltaUsd: true,
      status: true,
    },
  });

  // Calculate performance metrics for each vendor
  const performance: ContractorPerformance[] = await Promise.all(
    vendors.map(async (vendor) => {
      const totalBids = vendor.bids.length;
      const awardedBids = vendor.bids.filter((b) => b.status === 'awarded')
        .length;
      const totalInvoices = vendor.invoices.length;
      const totalInvoiced = vendor.invoices.reduce(
        (sum, inv) => sum + inv.amount,
        0
      );
      const avgBidAmount =
        totalBids > 0
          ? vendor.bids.reduce((sum, bid) => sum + bid.subtotal, 0) / totalBids
          : 0;
      const avgInvoiceAmount =
        totalInvoices > 0 ? totalInvoiced / totalInvoices : 0;

      // Get change orders for this vendor's deals
      const vendorDealIds = [...new Set(vendor.bids.map((b) => b.dealId))];
      const vendorChangeOrders = allChangeOrders.filter(
        (co) => vendorDealIds.includes(co.dealId) && co.status === 'approved'
      );
      const changeOrderCount = vendorChangeOrders.length;
      const avgChangeOrderCost =
        changeOrderCount > 0
          ? vendorChangeOrders.reduce((sum, co) => sum + co.deltaUsd, 0) /
            changeOrderCount
          : 0;

      // Calculate budget variance (invoices vs awarded bids)
      const awardedBidTotal = vendor.bids
        .filter((b) => b.status === 'awarded')
        .reduce((sum, bid) => sum + bid.subtotal, 0);

      const budgetVariance =
        awardedBidTotal > 0
          ? ((totalInvoiced - awardedBidTotal) / awardedBidTotal) * 100
          : 0;

      // Flag issues
      const flags: string[] = [];
      if (budgetVariance > 15) {
        flags.push('BUDGET_OVERRUN');
      }
      if (changeOrderCount > awardedBids * 0.5 && awardedBids > 0) {
        flags.push('HIGH_CHANGE_ORDERS');
      }
      if (vendor.onTimePct < 80) {
        flags.push('POOR_ON_TIME_PERFORMANCE');
      }
      if (vendor.onBudgetPct < 85) {
        flags.push('POOR_BUDGET_PERFORMANCE');
      }
      if (vendor.reliability < 75) {
        flags.push('LOW_RELIABILITY_SCORE');
      }

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        trade: vendor.trade,
        totalBids,
        awardedBids,
        totalInvoices,
        totalInvoiced,
        avgBidAmount,
        avgInvoiceAmount,
        budgetVariance,
        changeOrders: changeOrderCount,
        avgChangeOrderCost,
        currentReliability: vendor.reliability,
        onTimePct: vendor.onTimePct,
        onBudgetPct: vendor.onBudgetPct,
        flags,
      };
    })
  );

  // Sort by reliability (worst first)
  performance.sort((a, b) => a.currentReliability - b.currentReliability);

  return performance;
}

/**
 * Send Slack alert for flagged contractors
 */
async function sendContractorAlert(
  slackWebhook: string,
  flaggedContractors: ContractorPerformance[],
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending contractor alert to ${userName} for ${flaggedContractors.length} flagged contractors`
  );

  // Build contractor details (limit to 5)
  const contractorDetails = flaggedContractors
    .slice(0, 5)
    .map((contractor, index) => {
      const flagList = contractor.flags
        .map((f) => {
          switch (f) {
            case 'BUDGET_OVERRUN':
              return '💰 Budget Overrun';
            case 'HIGH_CHANGE_ORDERS':
              return '🔄 High Change Orders';
            case 'POOR_ON_TIME_PERFORMANCE':
              return '⏰ Poor On-Time';
            case 'POOR_BUDGET_PERFORMANCE':
              return '📊 Poor Budget';
            case 'LOW_RELIABILITY_SCORE':
              return '⚠️ Low Reliability';
            default:
              return f;
          }
        })
        .join(', ');

      return (
        `${index + 1}. *${contractor.vendorName}* (${contractor.trade})\n` +
        `   Reliability: ${contractor.currentReliability}% | ` +
        `On-Time: ${contractor.onTimePct}% | ` +
        `On-Budget: ${contractor.onBudgetPct}%\n` +
        `   Flags: ${flagList}`
      );
    })
    .join('\n\n');

  const moreContractorsText =
    flaggedContractors.length > 5
      ? `\n\n_...and ${flaggedContractors.length - 5} more flagged contractors_`
      : '';

  const message = `*Flagged Contractors:*\n\n${contractorDetails}${moreContractorsText}`;

  const fields = [
    {
      title: 'Total Flagged',
      value: flaggedContractors.length.toString(),
    },
    {
      title: 'Avg Reliability',
      value:
        Math.round(
          flaggedContractors.reduce((sum, c) => sum + c.currentReliability, 0) /
            flaggedContractors.length
        ).toString() + '%',
    },
  ];

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '👷 Contractor Performance Alert',
    message,
    fields,
    color: 'warning',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send contractor alert to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`Contractor alert sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  contractorPerformanceTracking()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { contractorPerformanceTracking };
