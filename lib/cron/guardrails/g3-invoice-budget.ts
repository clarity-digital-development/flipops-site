/**
 * G3 - Invoice & Budget Guardian Guardrail
 *
 * Schedule: Every 15 minutes
 * Purpose: Monitor for budget variance and flag overruns
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

const logger = createLogger('G3 - Invoice Budget');

interface G3Violation {
  dealId: string;
  address: string;
  budgetVariance: number;
  budgetVariancePct: number;
  actual: number;
  budgeted: number;
  blockedAt: Date;
}

/**
 * Main workflow function
 */
async function g3InvoiceBudgetGuardian() {
  logger.info('Starting G3 guardrail checks');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Checking G3 violations for ${usersWithSlack.length} users`);

    let totalViolations = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking G3 violations for user: ${user.name}`);

        // Get recent BLOCK events from G3 for this user's deals
        const violations = await getRecentG3Violations(user.id);

        if (violations.length === 0) {
          logger.debug(`No G3 violations for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${violations.length} G3 violations for user: ${user.name}`
        );

        totalViolations += violations.length;

        // Send Slack notification
        const sent = await sendG3Alert(user.slackWebhook!, violations, user.name);

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process G3 for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `G3 guardrail complete: ${totalViolations} violations found, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('G3 guardrail workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get recent G3 BLOCK events for a user
 */
async function getRecentG3Violations(
  userId: string
): Promise<G3Violation[]> {
  // Check events from the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get BLOCK events from G3
  const blockEvents = await prisma.event.findMany({
    where: {
      actor: 'system:G3',
      action: 'BLOCK',
      artifact: 'BudgetLedger',
      ts: {
        gte: fifteenMinutesAgo,
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
    orderBy: { ts: 'desc' },
  });

  // Filter to only this user's deals
  const userBlockEvents = blockEvents.filter(
    (event) => event.deal?.userId === userId
  );

  if (userBlockEvents.length === 0) {
    return [];
  }

  // Parse event metadata to get budget variance details
  const violations: G3Violation[] = userBlockEvents
    .map((event) => {
      try {
        const metadata = event.diff
          ? JSON.parse(event.diff as string)
          : {};
        const deal = event.deal;

        if (!deal) {
          logger.warn(`No deal found for event ${event.id}`);
          return null;
        }

        return {
          dealId: deal.id,
          address: deal.address,
          budgetVariance: metadata.budgetVariance || 0,
          budgetVariancePct: metadata.budgetVariancePct || 0,
          actual: metadata.actual || 0,
          budgeted: metadata.budgeted || 0,
          blockedAt: event.ts,
        };
      } catch (error) {
        logger.error(`Failed to parse event ${event.id}`, error);
        return null;
      }
    })
    .filter((v): v is G3Violation => v !== null);

  return violations;
}

/**
 * Send Slack alert for G3 violations
 */
async function sendG3Alert(
  slackWebhook: string,
  violations: G3Violation[],
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending G3 alert to ${userName} for ${violations.length} violations`
  );

  // Calculate totals
  const totalVariance = violations.reduce((sum, v) => sum + v.budgetVariance, 0);
  const avgVariancePct =
    violations.reduce((sum, v) => sum + v.budgetVariancePct, 0) /
    violations.length;

  // Build Slack message
  const fields = [
    {
      title: 'Budget Overruns',
      value: violations.length.toString(),
    },
    {
      title: 'Total Variance',
      value: formatCurrency(totalVariance),
    },
    {
      title: 'Avg Variance %',
      value: formatPercent(avgVariancePct / 100),
    },
  ];

  // Build violation details (limit to 5)
  const violationDetails = violations
    .slice(0, 5)
    .map(
      (v, index) =>
        `${index + 1}. *${v.address}*\n` +
        `   Actual: ${formatCurrency(v.actual)} | Budget: ${formatCurrency(v.budgeted)}\n` +
        `   Variance: ${formatCurrency(v.budgetVariance)} (${formatPercent(v.budgetVariancePct / 100)})\n` +
        `   Blocked: ${v.blockedAt.toLocaleString()}`
    )
    .join('\n\n');

  const moreDealsText =
    violations.length > 5
      ? `\n\n_...and ${violations.length - 5} more budget overruns_`
      : '';

  const message = `*Recent Budget Overruns:*\n\n${violationDetails}${moreDealsText}`;

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '💰 G3 - Invoice & Budget Guardian',
    message,
    fields,
    color: 'warning',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send G3 Slack notification to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`G3 Slack notification sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  g3InvoiceBudgetGuardian()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { g3InvoiceBudgetGuardian };
