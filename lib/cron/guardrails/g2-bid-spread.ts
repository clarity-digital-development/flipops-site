/**
 * G2 - Bid Spread Alert Guardrail
 *
 * Schedule: Every 15 minutes
 * Purpose: Monitor for deals where bid spread exceeds 15% threshold
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

const logger = createLogger('G2 - Bid Spread');

const BID_SPREAD_THRESHOLD = 0.15; // 15%

interface G2Violation {
  dealId: string;
  address: string;
  bidSpread: number;
  lowestBid: number;
  highestBid: number;
  totalBids: number;
  blockedAt: Date;
}

/**
 * Main workflow function
 */
async function g2BidSpreadAlert() {
  logger.info('Starting G2 guardrail checks');

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Checking G2 violations for ${usersWithSlack.length} users`);

    let totalViolations = 0;
    let totalNotifications = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking G2 violations for user: ${user.name}`);

        // Get recent BLOCK events from G2 for this user's deals
        const violations = await getRecentG2Violations(user.id);

        if (violations.length === 0) {
          logger.debug(`No G2 violations for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Found ${violations.length} G2 violations for user: ${user.name}`
        );

        totalViolations += violations.length;

        // Send Slack notification
        const sent = await sendG2Alert(user.slackWebhook!, violations, user.name ?? 'Unknown');

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process G2 for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `G2 guardrail complete: ${totalViolations} violations found, ${totalNotifications} notifications sent`
    );
  } catch (error) {
    logger.error('G2 guardrail workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get recent G2 BLOCK events for a user
 */
async function getRecentG2Violations(
  userId: string
): Promise<G2Violation[]> {
  // Check events from the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get BLOCK events from G2
  const blockEvents = await prisma.event.findMany({
    where: {
      actor: 'system:G2',
      action: 'BLOCK',
      artifact: 'Bid',
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

  // Parse event metadata to get bid spread details
  const violations: G2Violation[] = userBlockEvents
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
          bidSpread: metadata.bidSpread || 0,
          lowestBid: metadata.lowestBid || 0,
          highestBid: metadata.highestBid || 0,
          totalBids: metadata.totalBids || 0,
          blockedAt: event.ts,
        };
      } catch (error) {
        logger.error(`Failed to parse event ${event.id}`, error);
        return null;
      }
    })
    .filter((v): v is G2Violation => v !== null);

  return violations;
}

/**
 * Send Slack alert for G2 violations
 */
async function sendG2Alert(
  slackWebhook: string,
  violations: G2Violation[],
  userName: string
): Promise<boolean> {
  logger.info(
    `Sending G2 alert to ${userName} for ${violations.length} violations`
  );

  // Calculate average bid spread
  const avgBidSpread =
    violations.reduce((sum, v) => sum + v.bidSpread, 0) / violations.length;

  // Build Slack message
  const fields = [
    {
      title: 'Deals with High Bid Spread',
      value: violations.length.toString(),
    },
    {
      title: 'Avg Bid Spread',
      value: formatPercent(avgBidSpread),
    },
    {
      title: 'Threshold',
      value: formatPercent(BID_SPREAD_THRESHOLD),
    },
  ];

  // Build violation details (limit to 5)
  const violationDetails = violations
    .slice(0, 5)
    .map(
      (v, index) =>
        `${index + 1}. *${v.address}*\n` +
        `   Bid Spread: ${formatPercent(v.bidSpread)} (${v.totalBids} bids)\n` +
        `   Range: ${formatCurrency(v.lowestBid)} - ${formatCurrency(v.highestBid)}\n` +
        `   Blocked: ${v.blockedAt.toLocaleString()}`
    )
    .join('\n\n');

  const moreDealsText =
    violations.length > 5
      ? `\n\n_...and ${violations.length - 5} more deals with high bid spread_`
      : '';

  const message = `*Recent High Bid Spread Alerts:*\n\n${violationDetails}${moreDealsText}`;

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '⚠️ G2 - Bid Spread Alert',
    message,
    fields,
    color: 'warning',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send G2 Slack notification to ${userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`G2 Slack notification sent to ${userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  g2BidSpreadAlert()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { g2BidSpreadAlert };
