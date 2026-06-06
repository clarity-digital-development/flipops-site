/**
 * G1 - Deal Approval Alert Guardrail
 *
 * Schedule: Every 15 minutes
 * Purpose: Monitor for deals where P80 exceeds maxExposureUsd and send alerts
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

const logger = createLogger('G1 - Deal Approval');

interface G1Violation {
  dealId: string;
  address: string;
  p80: number;
  maxExposureUsd: number;
  overBy: number;
  overByPct: number;
  blockedAt: Date;
}

/**
 * Main workflow function
 */
async function g1DealApprovalAlert() {
  logger.info('Starting G1 guardrail checks');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Checking G1 violations for ${usersWithSlack.length} users`);

    let totalViolations = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking G1 violations for user: ${user.name}`);

        // Get recent BLOCK events from G1 for this user's deals
        const violations = await getRecentG1Violations(user.id);

        if (violations.length === 0) {
          logger.debug(`No G1 violations for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${violations.length} G1 violations for user: ${user.name}`
        );

        totalViolations += violations.length;

        // Send Slack notification
        const sent = await sendG1Alert(user.slackWebhook!, violations, user.name);

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process G1 for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `G1 guardrail complete: ${totalViolations} violations found, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('G1 guardrail workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get recent G1 BLOCK events for a user
 */
async function getRecentG1Violations(
  userId: string
): Promise<G1Violation[]> {
  // Check events from the last 15 minutes (since this runs every 15 min)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get BLOCK events from G1
  const blockEvents = await prisma.event.findMany({
    where: {
      actor: 'system:G1',
      action: 'BLOCK',
      artifact: 'DealSpec',
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
          maxExposureUsd: true,
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

  // Parse event metadata to get P80 and violation details
  const violations: G1Violation[] = userBlockEvents
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
          p80: metadata.p80 || 0,
          maxExposureUsd: deal.maxExposureUsd,
          overBy: metadata.overBy || 0,
          overByPct: metadata.overByPct || 0,
          blockedAt: event.ts,
        };
      } catch (error) {
        logger.error(`Failed to parse event ${event.id}`, error);
        return null;
      }
    })
    .filter((v): v is G1Violation => v !== null);

  return violations;
}

/**
 * Send Slack alert for G1 violations
 */
async function sendG1Alert(
  slackWebhook: string,
  violations: G1Violation[],
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending G1 alert to ${userName} for ${violations.length} violations`
  );

  // Calculate totals
  const totalOverage = violations.reduce((sum, v) => sum + v.overBy, 0);
  const avgOveragePct =
    violations.reduce((sum, v) => sum + v.overByPct, 0) / violations.length;

  // Build Slack message
  const fields = [
    {
      title: 'Blocked Deals',
      value: violations.length.toString(),
    },
    {
      title: 'Total Overage',
      value: formatCurrency(totalOverage),
    },
    {
      title: 'Avg Overage %',
      value: formatPercent(avgOveragePct / 100),
    },
  ];

  // Build violation details (limit to 5)
  const violationDetails = violations
    .slice(0, 5)
    .map(
      (v, index) =>
        `${index + 1}. *${v.address}*\n` +
        `   P80: ${formatCurrency(v.p80)} | Max: ${formatCurrency(v.maxExposureUsd)}\n` +
        `   Over by: ${formatCurrency(v.overBy)} (${formatPercent(v.overByPct / 100)})\n` +
        `   Blocked: ${v.blockedAt.toLocaleString()}`
    )
    .join('\n\n');

  const moreDealsText =
    violations.length > 5
      ? `\n\n_...and ${violations.length - 5} more blocked deals_`
      : '';

  const message = `*Recent Blocked Deals:*\n\n${violationDetails}${moreDealsText}`;

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '❌ G1 - Deal Approval Alert',
    message,
    fields,
    color: 'danger',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send G1 Slack notification to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`G1 Slack notification sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  g1DealApprovalAlert()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { g1DealApprovalAlert };
