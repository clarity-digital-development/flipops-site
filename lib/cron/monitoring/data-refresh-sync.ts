/**
 * Data Refresh & Sync Cron Job
 *
 * Schedule: Daily at 8 AM UTC
 * Purpose: Refresh active deal data, recalculate budgets, validate health
 *
 * Performs:
 * 1. Budget Recalculation - Recalculate variance for active deals
 * 2. Deal Health Check - Validate data integrity, flag missing fields
 * 3. Status Updates - Update deal status based on related records
 */

import {
  createLogger,
  prisma,
  closePrismaConnection,
  sendSlackNotification,
  getActiveUsers,
} from '../shared';

const logger = createLogger('Data Refresh & Sync');

interface DealHealthIssue {
  dealId: string;
  address: string;
  issues: string[];
  severity: 'warning' | 'error';
}

interface BudgetRecalcResult {
  dealId: string;
  address: string;
  previousVariance: number | null;
  newVariance: number;
  totalBaseline: number;
  totalActuals: number;
  overBudget: boolean;
}

interface StatusUpdateResult {
  dealId: string;
  address: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
}

interface RefreshSummary {
  dealsProcessed: number;
  budgetRecalculations: BudgetRecalcResult[];
  healthIssues: DealHealthIssue[];
  statusUpdates: StatusUpdateResult[];
  errors: string[];
}

/**
 * Main workflow function
 */
async function dataRefreshAndSync() {
  logger.info('Starting data refresh workflow');

  const summary: RefreshSummary = {
    dealsProcessed: 0,
    budgetRecalculations: [],
    healthIssues: [],
    statusUpdates: [],
    errors: [],
  };

  try {
    // Get active users for notifications
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    // Fetch active deals (created in last 90 days or status not 'completed'/'cancelled')
    logger.info('Fetching active deals');

    const deals = await prisma.dealSpec.findMany({
      where: {
        OR: [
          { status: { notIn: ['completed', 'cancelled'] } },
          { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        ],
      },
      include: {
        budgetLedger: true,
        bids: {
          where: { status: { in: ['pending', 'awarded'] } },
        },
        changeOrders: true,
        property: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Invoice has no back-relation on DealSpec — fetch and group by dealId.
    const allInvoices = deals.length > 0
      ? await prisma.invoice.findMany({ where: { dealId: { in: deals.map((d) => d.id) } } })
      : [];
    const invoicesByDeal = new Map<string, typeof allInvoices>();
    for (const inv of allInvoices) {
      const list = invoicesByDeal.get(inv.dealId) ?? [];
      list.push(inv);
      invoicesByDeal.set(inv.dealId, list);
    }

    logger.info(`Found ${deals.length} active deals to process`);
    summary.dealsProcessed = deals.length;

    if (deals.length === 0) {
      logger.info('No active deals to refresh');
      return;
    }

    // Process each deal
    for (const deal of deals) {
      try {
        // 1. Budget Recalculation
        const budgetResult = await recalculateBudget({
          ...deal,
          invoices: invoicesByDeal.get(deal.id) ?? [],
        });
        if (budgetResult) {
          summary.budgetRecalculations.push(budgetResult);
        }

        // 2. Deal Health Check
        const healthIssues = checkDealHealth(deal);
        if (healthIssues.issues.length > 0) {
          summary.healthIssues.push(healthIssues);
        }

        // 3. Status Update
        const statusUpdate = await updateDealStatus(deal);
        if (statusUpdate) {
          summary.statusUpdates.push(statusUpdate);
        }

        // Update deal's updatedAt timestamp
        await prisma.dealSpec.update({
          where: { id: deal.id },
          data: { updatedAt: new Date() },
        });

      } catch (error) {
        const errorMsg = `Deal ${deal.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        summary.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    // Send summary notifications to users
    for (const user of usersWithSlack) {
      // Filter results to user's deals
      const userDeals = deals.filter(d => d.userId === user.id);
      if (userDeals.length === 0) continue;

      const userSummary: RefreshSummary = {
        dealsProcessed: userDeals.length,
        budgetRecalculations: summary.budgetRecalculations.filter(b =>
          userDeals.some(d => d.id === b.dealId)
        ),
        healthIssues: summary.healthIssues.filter(h =>
          userDeals.some(d => d.id === h.dealId)
        ),
        statusUpdates: summary.statusUpdates.filter(s =>
          userDeals.some(d => d.id === s.dealId)
        ),
        errors: summary.errors.filter(e =>
          userDeals.some(d => e.includes(d.id))
        ),
      };

      await sendRefreshSummary(user.slackWebhook!, user.name ?? 'Unknown', userSummary);
    }

    logger.success(`Data refresh complete: ${summary.dealsProcessed} deals, ` +
      `${summary.budgetRecalculations.length} budget updates, ` +
      `${summary.healthIssues.length} health issues, ` +
      `${summary.statusUpdates.length} status changes`);

  } catch (error) {
    logger.error('Data refresh workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Recalculate budget variance for a deal
 */
async function recalculateBudget(deal: any): Promise<BudgetRecalcResult | null> {
  if (!deal.budgetLedger) return null;

  const ledger = deal.budgetLedger;
  // BudgetLedger stores trade maps as JSON strings (SQLite-era schema).
  const parseTradeMap = (raw: unknown): Record<string, number> => {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) ?? {}; } catch { return {}; }
    }
    return (raw as Record<string, number>) || {};
  };
  const baseline = parseTradeMap(ledger.baseline);
  const actuals = parseTradeMap(ledger.actuals);

  // Calculate totals
  const totalBaseline = Object.entries(baseline)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, val]) => sum + (val || 0), 0);

  const totalActuals = Object.entries(actuals)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, val]) => sum + (val || 0), 0);

  // Add pending invoices to actuals
  const pendingInvoiceTotal = deal.invoices
    .filter((inv: any) => inv.status === 'pending' || inv.status === 'approved')
    .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

  const projectedActuals = totalActuals + pendingInvoiceTotal;

  // Calculate variance
  const newVariance = totalBaseline > 0
    ? ((projectedActuals - totalBaseline) / totalBaseline) * 100
    : 0;

  const previousVariance = actuals.total && baseline.total
    ? ((actuals.total - baseline.total) / baseline.total) * 100
    : null;

  // Update ledger if variance changed significantly (>0.5%)
  if (previousVariance === null || Math.abs(newVariance - previousVariance) > 0.5) {
    // Update actuals total
    actuals.total = projectedActuals;

    await prisma.budgetLedger.update({
      where: { dealId: ledger.dealId },
      data: {
        actuals: JSON.stringify(actuals),
        updatedAt: new Date(),
      },
    });

    return {
      dealId: deal.id,
      address: deal.address,
      previousVariance,
      newVariance: Math.round(newVariance * 10) / 10,
      totalBaseline,
      totalActuals: projectedActuals,
      overBudget: newVariance > 0,
    };
  }

  return null;
}

/**
 * Check deal health and data integrity
 */
function checkDealHealth(deal: any): DealHealthIssue {
  const issues: string[] = [];
  let severity: 'warning' | 'error' = 'warning';

  // Check for missing required fields
  if (!deal.maxExposureUsd || deal.maxExposureUsd <= 0) {
    issues.push('Missing max exposure limit');
    severity = 'error';
  }

  if (!deal.targetRoiPct) {
    issues.push('Missing target ROI');
  }

  if (!deal.arv || deal.arv <= 0) {
    issues.push('Missing ARV estimate');
  }

  // Check for stale data
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceUpdate > 14) {
    issues.push(`No updates in ${daysSinceUpdate} days`);
  }

  // Check for budget ledger
  if (!deal.budgetLedger) {
    issues.push('Missing budget ledger');
    severity = 'error';
  }

  // Check for orphaned bids (pending for too long)
  const oldPendingBids = deal.bids.filter((bid: any) => {
    const daysPending = Math.floor(
      (Date.now() - new Date(bid.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return bid.status === 'pending' && daysPending > 7;
  });
  if (oldPendingBids.length > 0) {
    issues.push(`${oldPendingBids.length} bid(s) pending > 7 days`);
  }

  // Check for pending change orders
  const pendingCOs = deal.changeOrders.filter((co: any) => co.status === 'proposed');
  if (pendingCOs.length > 0) {
    issues.push(`${pendingCOs.length} change order(s) awaiting approval`);
  }

  // Check for flagged invoices
  const flaggedInvoices = deal.invoices.filter((inv: any) => inv.status === 'flagged');
  if (flaggedInvoices.length > 0) {
    issues.push(`${flaggedInvoices.length} flagged invoice(s)`);
    severity = 'error';
  }

  return {
    dealId: deal.id,
    address: deal.address,
    issues,
    severity,
  };
}

/**
 * Update deal status based on related records
 */
async function updateDealStatus(deal: any): Promise<StatusUpdateResult | null> {
  const currentStatus = deal.status || 'active';
  let newStatus = currentStatus;
  let reason = '';

  // Determine new status based on related records
  const awardedBids = deal.bids.filter((b: any) => b.status === 'awarded');
  const pendingBids = deal.bids.filter((b: any) => b.status === 'pending');
  const paidInvoices = deal.invoices.filter((i: any) => i.status === 'paid');
  const pendingInvoices = deal.invoices.filter((i: any) => i.status === 'pending' || i.status === 'approved');
  const approvedCOs = deal.changeOrders.filter((co: any) => co.status === 'approved');

  // Status progression logic
  if (currentStatus === 'pending_approval') {
    // Check if deal has been through G1
    // This would require checking events, for now just check if bids exist
    if (deal.bids.length > 0) {
      newStatus = 'bidding';
      reason = 'Bids received, moved to bidding phase';
    }
  } else if (currentStatus === 'bidding' || currentStatus === 'active') {
    if (awardedBids.length > 0 && pendingBids.length === 0) {
      newStatus = 'in_progress';
      reason = 'All bids awarded, construction in progress';
    }
  } else if (currentStatus === 'in_progress') {
    // Check if all invoices are paid
    if (deal.invoices.length > 0 && pendingInvoices.length === 0 && paidInvoices.length > 0) {
      // Could be nearing completion
      const totalPaid = paidInvoices.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
      const totalCommitted = deal.budgetLedger?.committed?.total || 0;

      if (totalCommitted > 0 && totalPaid >= totalCommitted * 0.9) {
        newStatus = 'closing';
        reason = '90%+ of committed budget paid, entering closing phase';
      }
    }
  }

  // Only update if status changed
  if (newStatus !== currentStatus) {
    await prisma.dealSpec.update({
      where: { id: deal.id },
      data: { status: newStatus },
    });

    logger.info(`Deal ${deal.id} status: ${currentStatus} -> ${newStatus}`);

    return {
      dealId: deal.id,
      address: deal.address,
      previousStatus: currentStatus,
      newStatus,
      reason,
    };
  }

  return null;
}

/**
 * Send Slack summary notification
 */
async function sendRefreshSummary(
  slackWebhook: string,
  userName: string,
  summary: RefreshSummary
) {
  if (summary.dealsProcessed === 0) return;

  logger.info(`Sending refresh summary to ${userName}`);

  const sections: string[] = [];

  // Budget alerts
  const overBudgetDeals = summary.budgetRecalculations.filter(b => b.overBudget && b.newVariance > 5);
  if (overBudgetDeals.length > 0) {
    const budgetSection = overBudgetDeals
      .slice(0, 3)
      .map(b => `• *${b.address}*: ${b.newVariance > 0 ? '+' : ''}${b.newVariance.toFixed(1)}% variance`)
      .join('\n');
    sections.push(`*⚠️ Budget Alerts:*\n${budgetSection}`);
  }

  // Health issues
  const criticalIssues = summary.healthIssues.filter(h => h.severity === 'error');
  if (criticalIssues.length > 0) {
    const healthSection = criticalIssues
      .slice(0, 3)
      .map(h => `• *${h.address}*: ${h.issues.join(', ')}`)
      .join('\n');
    sections.push(`*🔴 Critical Issues:*\n${healthSection}`);
  }

  // Status changes
  if (summary.statusUpdates.length > 0) {
    const statusSection = summary.statusUpdates
      .slice(0, 3)
      .map(s => `• *${s.address}*: ${s.previousStatus} → ${s.newStatus}`)
      .join('\n');
    sections.push(`*📊 Status Updates:*\n${statusSection}`);
  }

  // Build message
  const message = sections.length > 0
    ? sections.join('\n\n')
    : 'All deals healthy, no action required.';

  const fields = [
    { title: 'Deals Processed', value: summary.dealsProcessed.toString() },
    { title: 'Budget Updates', value: summary.budgetRecalculations.length.toString() },
    { title: 'Health Issues', value: summary.healthIssues.filter(h => h.issues.length > 0).length.toString() },
    { title: 'Status Changes', value: summary.statusUpdates.length.toString() },
  ];

  const hasErrors = criticalIssues.length > 0 || summary.errors.length > 0;
  const hasWarnings = overBudgetDeals.length > 0 || summary.healthIssues.some(h => h.severity === 'warning');

  const color = hasErrors ? 'danger' : hasWarnings ? 'warning' : 'good';

  await sendSlackNotification({
    webhook: slackWebhook,
    title: '🔄 Daily Data Refresh Complete',
    message,
    fields,
    color,
  });
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  dataRefreshAndSync()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { dataRefreshAndSync };
