/**
 * Skip Tracing & Enrichment Cron Job
 *
 * Schedule: Weekly (or as needed)
 * Purpose: Enrich high-scoring properties with contact information using BatchData API
 */

import {
  createLogger,
  prisma,
  closePrismaConnection,
  getActiveUsers,
  sendSlackNotification,
  sleep,
  retry,
} from '../shared';

const logger = createLogger('Skip Tracing & Enrichment');

// BatchData API Configuration
const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY;
const BATCHDATA_API_BASE = 'https://api.batchdata.com/api/v1';

// Cost per property
const COST_PER_PROPERTY = 0.2;

// Batch processing limits
const PROPERTIES_PER_BATCH = 25;
const MIN_SCORE_FOR_SKIP_TRACE = 70;

interface PropertyToEnrich {
  id: string;
  userId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string | null;
  score: number | null;
}

interface BatchDataResponse {
  phones?: string[];
  emails?: string[];
  owner?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  metadata?: any;
}

interface EnrichmentResult {
  success: boolean;
  id: string;
  address: string;
  phonesFound: number;
  emailsFound: number;
  error?: string;
}

interface EnrichmentStats {
  userId: string;
  userName: string;
  processed: number;
  successes: number;
  failures: number;
  totalCost: number;
  results: EnrichmentResult[];
}

/**
 * Main workflow function
 */
async function skipTracingEnrichment() {
  logger.info('Starting skip tracing & enrichment');

  if (!BATCHDATA_API_KEY) {
    logger.error('BATCHDATA_API_KEY environment variable not set');
    throw new Error('BATCHDATA_API_KEY environment variable is required');
  }

  try {
    // Get all active users with Slack webhooks
    const users = await getActiveUsers();
    const usersWithSlack = users.filter((u) => u.slackWebhook);

    logger.info(`Processing skip tracing for ${usersWithSlack.length} users`);

    let totalEnriched = 0;
    let totalNotifications = 0;
    let totalCost = 0;

    // Process each user
    for (const user of usersWithSlack) {
      try {
        logger.debug(`Checking properties for user: ${user.name}`);

        // Get properties that need skip tracing for this user
        const properties = await getPropertiesNeedingSkipTrace(
          user.id,
          PROPERTIES_PER_BATCH
        );

        if (properties.length === 0) {
          logger.debug(`No properties need skip tracing for user: ${user.name}`);
          continue;
        }

        logger.info(
          `Processing ${properties.length} properties for user: ${user.name}`
        );

        // Process each property
        const results: EnrichmentResult[] = [];

        for (const property of properties) {
          try {
            logger.debug(
              `Skip tracing property: ${property.address}, ${property.city}, ${property.state}`
            );

            // Call BatchData API for skip trace
            const skipTraceData = await fetchSkipTraceData(property);

            // Update property with enrichment data
            await updatePropertyWithSkipTrace(
              property.id,
              skipTraceData.phones || [],
              skipTraceData.emails || [],
              skipTraceData.metadata
            );

            results.push({
              success: true,
              id: property.id,
              address: `${property.address}, ${property.city}, ${property.state}`,
              phonesFound: skipTraceData.phones?.length || 0,
              emailsFound: skipTraceData.emails?.length || 0,
            });

            totalEnriched++;

            // Rate limit: 1 second between API calls
            await sleep(1000);
          } catch (propertyError) {
            logger.error(
              `Failed to skip trace property ${property.id}`,
              propertyError
            );

            results.push({
              success: false,
              id: property.id,
              address: `${property.address}, ${property.city}, ${property.state}`,
              phonesFound: 0,
              emailsFound: 0,
              error:
                propertyError instanceof Error
                  ? propertyError.message
                  : 'Unknown error',
            });
          }
        }

        const successes = results.filter((r) => r.success).length;
        const failures = results.filter((r) => !r.success).length;
        const batchCost = properties.length * COST_PER_PROPERTY;
        totalCost += batchCost;

        logger.info(
          `Skip tracing complete for user ${user.name}: ${successes} successes, ${failures} failures, cost: $${batchCost.toFixed(2)}`
        );

        // Send Slack notification
        const stats: EnrichmentStats = {
          userId: user.id,
          userName: user.name,
          processed: properties.length,
          successes,
          failures,
          totalCost: batchCost,
          results,
        };

        const sent = await sendEnrichmentNotification(user.slackWebhook!, stats);

        if (sent) {
          totalNotifications++;
        }
      } catch (error) {
        logger.error(
          `Failed to process skip tracing for user ${user.id}`,
          error
        );
      }
    }

    logger.success(
      `Skip tracing complete: ${totalEnriched} properties enriched, ${totalNotifications} notifications sent, total cost: $${totalCost.toFixed(2)}`
    );
  } catch (error) {
    logger.error('Skip tracing & enrichment workflow failed', error);
    throw error;
  } finally {
    await closePrismaConnection();
  }
}

/**
 * Get properties that need skip tracing for a specific user
 */
async function getPropertiesNeedingSkipTrace(
  userId: string,
  limit: number
): Promise<PropertyToEnrich[]> {
  const properties = await prisma.property.findMany({
    where: {
      userId,
      AND: [
        {
          OR: [
            { score: { gte: MIN_SCORE_FOR_SKIP_TRACE } }, // High score properties
            { score: null }, // Or unscored but potentially valuable
          ],
        },
        { enriched: false }, // Not yet enriched
        {
          OR: [
            { phoneNumbers: null }, // No phone numbers
            { phoneNumbers: '' }, // Or empty phone numbers
            { emails: null }, // No emails
            { emails: '' }, // Or empty emails
          ],
        },
      ],
    },
    orderBy: [
      { score: 'desc' }, // Highest scores first
      { createdAt: 'asc' }, // Oldest first
    ],
    take: limit,
    select: {
      id: true,
      userId: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      ownerName: true,
      score: true,
    },
  });

  return properties;
}

/**
 * Fetch skip trace data from BatchData API
 */
async function fetchSkipTraceData(
  property: PropertyToEnrich
): Promise<BatchDataResponse> {
  const url = `${BATCHDATA_API_BASE}/property/skip-trace`;

  const response = await retry(
    async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${BATCHDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              address: {
                street: property.address,
                city: property.city,
                state: property.state,
                zip: property.zip,
              },
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `BatchData API error: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      const data = await res.json();

      // BatchData returns an array of results, take the first one
      if (data.results && data.results.length > 0) {
        return data.results[0];
      }

      // Fallback if the response format is different
      return data;
    },
    {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
    }
  );

  return response;
}

/**
 * Update property with skip trace data using direct Prisma access
 */
async function updatePropertyWithSkipTrace(
  propertyId: string,
  phoneNumbers: string[],
  emails: string[],
  metadata?: any
): Promise<void> {
  // Get existing property to merge metadata and create task
  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      metadata: true,
      userId: true,
      address: true,
      city: true,
      state: true,
      ownerName: true,
    },
  });

  if (!existing) {
    logger.error(`Property ${propertyId} not found`);
    return;
  }

  const existingMetadata = existing.metadata
    ? JSON.parse(existing.metadata as string)
    : {};

  // Prepare update data
  const updateData: any = {
    enriched: true,
    updatedAt: new Date(),
  };

  if (phoneNumbers.length > 0) {
    updateData.phoneNumbers = JSON.stringify(phoneNumbers);
  }

  if (emails.length > 0) {
    updateData.emails = JSON.stringify(emails);
  }

  // Merge metadata
  updateData.metadata = JSON.stringify({
    ...existingMetadata,
    skipTrace: {
      ...metadata,
      enrichedAt: new Date().toISOString(),
      phonesFound: phoneNumbers.length,
      emailsFound: emails.length,
    },
  });

  // Update the property
  await prisma.property.update({
    where: { id: propertyId },
    data: updateData,
  });

  logger.debug(
    `Updated property ${propertyId} with ${phoneNumbers.length} phones, ${emails.length} emails`
  );

  // Auto-create "Make first contact" task if contact info was found
  if (phoneNumbers.length > 0 || emails.length > 0) {
    try {
      const propertyAddress = `${existing.address}, ${existing.city}, ${existing.state}`;
      const ownerName = existing.ownerName || 'owner';

      // Create task due in 24 hours
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Tomorrow

      await prisma.task.create({
        data: {
          userId: existing.userId,
          propertyId: propertyId,
          type: 'call',
          title: `Make first contact with ${ownerName} - ${propertyAddress}`,
          description: `Property just got skip traced. Contact info: ${phoneNumbers.length} phone(s), ${emails.length} email(s)`,
          dueDate: dueDate,
          priority: 'high', // High priority for fresh leads
        },
      });

      logger.info(`Auto-created first contact task for property ${propertyId}`);
    } catch (taskError) {
      logger.error(`Failed to auto-create task for property ${propertyId}:`, taskError);
      // Don't fail the whole skip trace if task creation fails
    }
  }
}

/**
 * Send Slack notification for enrichment results
 */
async function sendEnrichmentNotification(
  slackWebhook: string,
  stats: EnrichmentStats
): Promise<boolean> {
  logger.info(
    `Sending skip trace notification to ${stats.userName} for ${stats.processed} properties`
  );

  // Get successful enrichments (limit to 5 for notification)
  const successResults = stats.results.filter((r) => r.success).slice(0, 5);

  const propertyList =
    successResults.length > 0
      ? successResults
          .map(
            (r, i) =>
              `${i + 1}. *${r.address}*\n   📞 Phones: ${r.phonesFound} | ✉️ Emails: ${
                r.emailsFound
              }`
          )
          .join('\n')
      : '_No properties successfully enriched_';

  const morePropertiesText =
    stats.successes > 5
      ? `\n\n_...and ${stats.successes - 5} more properties enriched_`
      : '';

  const message =
    `*Summary:*\n` +
    `• Properties Processed: ${stats.processed}\n` +
    `• ✅ Successful: ${stats.successes}\n` +
    `• ❌ Failed: ${stats.failures}\n` +
    `• 💰 Total Cost: $${stats.totalCost.toFixed(2)}\n\n` +
    `*Enriched Properties:*\n${propertyList}${morePropertiesText}`;

  const fields = [
    {
      title: 'Processed',
      value: stats.processed.toString(),
    },
    {
      title: 'Successful',
      value: stats.successes.toString(),
    },
    {
      title: 'Failed',
      value: stats.failures.toString(),
    },
    {
      title: 'Total Cost',
      value: `$${stats.totalCost.toFixed(2)}`,
    },
  ];

  const notification = await sendSlackNotification({
    webhook: slackWebhook,
    title: '🔍 Skip Tracing Batch Complete',
    message,
    fields,
    color: stats.failures > 0 ? 'warning' : 'good',
  });

  if (!notification.success) {
    logger.error(
      `Failed to send skip trace notification to ${stats.userName}`,
      notification.error
    );
    return false;
  }

  logger.info(`Skip trace notification sent to ${stats.userName}`);
  return true;
}

/**
 * Execute the workflow
 */
if (require.main === module) {
  skipTracingEnrichment()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { skipTracingEnrichment };
