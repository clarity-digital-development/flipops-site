/**
 * G4 - Change Order Gatekeeper Guardrail
 *
 * Schedule: Every 15 minutes
 * Purpose: Monitor change order impact on project scope/budget
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

const logger = createLogger('G4 - Change Order');

interface G4Violation {
  dealId: string;
  address: string;
  changeOrderImpact: number;
  changeOrderImpactPct: number;
  originalBudget: number;
  newBudget: number;
  blockedAt: Date;
}

/**
 * Main workflow function
 */
async function g4ChangeOrderGatekeeper() {
  logger.info('Starting G4 guardrail checks');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Checking G4 violations for ${usersWithSlack.length} users`);

    let totalViolations = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking G4 violations for user: ${user.name}`);

        // Get recent BLOCK events from G4 for this user's deals
        const violations = await getRecentG4Violations(user.id);

        if (violations.length === 0) {
          logger.debug(`No G4 violations for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${violations.length} G4 violations for user: ${user.name}`
        );

        totalViolations += violations.length;

        // Send Slack notification
        const sent = await sendG4Alert(user.slackWebhook!, violations, user.name);

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process G4 for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `G4 guardrail complete: ${totalViolations} violations found, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('G4 guardrail workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get recent G4 BLOCK events for a user
 */
async function getRecentG4Violations(
  userId: string
): Promise<G4Violation[]> {
  // Check events from the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get BLOCK events from G4
  const blockEvents = await prisma.event.findMany({
    where: {
      actor: 'system:G4',
      action: 'BLOCK',
      artifact: 'ChangeOrder',
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

  // Parse event metadata to get change order impact details
  const violations: G4Violation[] = userBlockEvents
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
          changeOrderImpact: metadata.changeOrderImpact || 0,
          changeOrderImpactPct: metadata.changeOrderImpactPct || 0,
          originalBudget: metadata.originalBudget || 0,
          newBudget: metadata.newBudget || 0,
          blockedAt: event.ts,
        };
      } catch (error) {
        logger.error(`Failed to parse event ${event.id}`, error);
        return null;
      }
    })
    .filter((v): v is G4Violation => v !== null);

  return violations;
}

/**
 * Send Slack alert for G4 violations
 */
async function sendG4Alert(
  slackWebhook: string,
  violations: G4Violation[],
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending G4 alert to ${userName} for ${violations.length} violations`
  );

  // Calculate totals
  const totalImpact = violations.reduce(
    (sum, v) => sum + v.changeOrderImpact,
    0
  );
  const avgImpactPct =
    violations.reduce((sum, v) => sum + v.changeOrderImpactPct, 0) /
    violations.length;

  // Build Slack message
  const fields = [
    {
      title: 'Pending Change Orders',
      value: violations.length.toString(),
    },
    {
      title: 'Total Impact',
      value: formatCurrency(totalImpact),
    },
    {
      title: 'Avg Impact %',
      value: formatPercent(avgImpactPct / 100),
    },
  ];

  // Build violation details (limit to 5)
  const violationDetails = violations
    .slice(0, 5)
    .map(
      (v, index) =>
        `${index + 1}. *${v.address}*\n` +
        `   Original: ${formatCurrency(v.originalBudget)} → New: ${formatCurrency(v.newBudget)}\n` +
        `   Impact: ${formatCurrency(v.changeOrderImpact)} (${formatPercent(v.changeOrderImpactPct / 100)})\n` +
        `   Blocked: ${v.blockedAt.toLocaleString()}`
    )
    .join('\n\n');

  const moreDealsText =
    violations.length > 5
      ? `\n\n_...and ${violations.length - 5} more pending change orders_`
      : '';

  const message = `*Pending Change Orders Requiring Approval:*\n\n${violationDetails}${moreDealsText}`;

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '🔄 G4 - Change Order Gatekeeper',
    message,
    fields,
    color: 'warning',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send G4 Slack notification to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`G4 Slack notification sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  g4ChangeOrderGatekeeper()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { g4ChangeOrderGatekeeper };
