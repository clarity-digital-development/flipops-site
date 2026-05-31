/* eslint-disable no-console */
import { Queue } from "bullmq";
import IORedis from "ioredis";

// ---------------------------------------------------------------------------
// Manually enqueue a one-shot scrape job for verification testing.
// Useful for Phase 2 end-to-end smoke + any time we want to kick a source
// without waiting for its cron tick.
//
// Usage (locally with prod env):
//   railway run --service worker-bullmq -- npx tsx scripts/enqueue-scrape-job.ts <sourceKey>
//
// Or with a one-off public Redis URL set:
//   REDIS_URL=redis://... npx tsx -r dotenv/config scripts/enqueue-scrape-job.ts <sourceKey>
// ---------------------------------------------------------------------------

// Hardcoded sourceKey → queue mapping (mirrors worker-bullmq.ts QUEUE_BY_DOMAIN).
// Avoids needing Prisma access during enqueue (which would require the
// internal DATABASE_URL when run via railway run from local).
const QUEUE_BY_SOURCE: Record<string, string> = {
  "fl-dor-statewide-nal-sdf":    "bulk-ingest",
  "duval-clerk-recordings":      "domain-duvalclerk",
  "realauction-fl-foreclosures": "domain-realauction",
  "duval-tax-delinquent":        "domain-jaxdailyrecord",
  "hillsborough-tax-delinquent": "domain-county-taxes",
  "orange-tax-delinquent":       "domain-lienhub",
  "broward-tax-delinquent":      "domain-lienhub",
  "miami-dade-tax-delinquent":   "domain-miamidade",
  "palm-beach-tax-delinquent":   "domain-flpublicnotices",
};

async function main() {
  const sourceKey = process.argv[2];
  if (!sourceKey) {
    console.error("Usage: enqueue-scrape-job.ts <sourceKey>");
    process.exit(1);
  }

  const queueName = QUEUE_BY_SOURCE[sourceKey];
  if (!queueName) {
    console.error(`Unknown sourceKey "${sourceKey}" — must be one of: ${Object.keys(QUEUE_BY_SOURCE).join(", ")}`);
    process.exit(1);
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("REDIS_URL not set");
    process.exit(1);
  }

  console.log(`Enqueueing sourceKey=${sourceKey} on queue=${queueName}`);

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue(queueName, { connection });
  const job = await queue.add(
    sourceKey,
    // "manual-script" mirrors the admin route's "manual-admin" — analytics
    // queries can match `triggerType LIKE 'manual-%'` for all human-initiated
    // runs regardless of channel.
    { sourceKey, trigger: "manual-script" },
    {
      attempts: 1, // single shot — don't retry-storm during smoke testing
      removeOnComplete: false,
      removeOnFail: false,
    },
  );
  console.log(`✓ Enqueued job id=${job.id} sourceKey=${sourceKey} queue=${queueName}`);

  await queue.close();
  await connection.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
