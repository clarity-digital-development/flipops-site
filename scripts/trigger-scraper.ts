/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// trigger-scraper.ts — manually enqueue a BullMQ job for a scraper sourceKey
// and (optionally) poll the BulkIngestJob audit table until it completes.
//
// Use when you want immediate verification a scraper works after an env-var
// change or code deploy, without waiting for the next natural cron tick.
//
// Usage:
//   REDIS_URL=... DATABASE_URL=... npx tsx scripts/trigger-scraper.ts \
//       <sourceKey> [--wait]
//
// Examples:
//   npx tsx scripts/trigger-scraper.ts duval-clerk-recordings --wait
//   npx tsx scripts/trigger-scraper.ts realauction-fl-foreclosures
//
// Env vars:
//   REDIS_URL     — Required. Railway's Redis URL (Variables tab).
//   DATABASE_URL  — Required if --wait. Railway's PG URL.
//
// What it does:
//   1. Looks up the sourceKey in ScrapeRegistry → resolves the domain queue.
//   2. Adds a BullMQ job with `trigger: 'manual-script'` (this taxonomy is
//      what shows up in BulkIngestJob.triggerType for audit clarity).
//   3. If --wait, polls BulkIngestJob every 5s for up to 10 min looking for
//      the row whose jobId matches; reports rowCount + errorMessage when done.
// ---------------------------------------------------------------------------

import IORedis from "ioredis";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";

const QUEUE_BY_DOMAIN: Record<string, string> = {
  "jaxdailyrecord.com":       "domain-jaxdailyrecord",
  "lienhub.com":              "domain-lienhub",
  "realauction.com":          "domain-realauction",
  "miamidade.gov":            "domain-miamidade",
  "county-taxes.net":         "domain-county-taxes",
  "floridapublicnotices.com": "domain-flpublicnotices",
  "duvalclerk.com":           "domain-duvalclerk",
  "floridarevenue.com":       "bulk-ingest",
};

function maskUrl(u: string | undefined): string {
  if (!u) return "(unset)";
  return u.replace(/:[^@/]+@/, ":***@");
}

async function pollForCompletion(sourceKey: string, enqueuedAt: Date): Promise<void> {
  // The BulkIngestJob schema doesn't carry the BullMQ jobId — poll for the
  // LATEST manual-script row for this sourceKey. We previously filtered on
  // `startedAt >= enqueuedAt - 5s` to disambiguate from prior runs, but the
  // worker writes startedAt on a slightly skewed clock and yesterday's runs
  // (jobIds 28, 53) showed startedAt landing ~9s BEFORE the enqueue
  // timestamp, which the floor filtered out → 10-min false timeout while the
  // work actually finished in ~116s. Latest-row semantics is simpler and
  // correct for an operator-only path; the race with another concurrent
  // manual trigger within the poll window is acceptable.
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastSeen = "";

  while (Date.now() < deadline) {
    const row = await prisma.bulkIngestJob.findFirst({
      where: {
        sourceKey,
        triggerType: "manual-script",
      },
      orderBy: { startedAt: "desc" },
    });

    if (row && row.finishedAt) {
      const ok = row.status === "succeeded" && !row.errorMessage && row.recordsFetched > 0;
      console.log("");
      console.log("=".repeat(78));
      console.log("AUDIT ROW (finished)");
      console.log("=".repeat(78));
      console.log(`  id:               ${row.id}`);
      console.log(`  sourceKey:        ${row.sourceKey}`);
      console.log(`  sourceTag:        ${row.sourceTag}`);
      console.log(`  triggerType:      ${row.triggerType}`);
      console.log(`  status:           ${row.status}`);
      console.log(`  startedAt:        ${row.startedAt.toISOString()}`);
      console.log(`  finishedAt:       ${row.finishedAt.toISOString()}`);
      console.log(`  durationMs:       ${row.durationMs ?? "?"}`);
      console.log(`  recordsFetched:   ${row.recordsFetched}`);
      console.log(`  recordsUpserted:  ${row.recordsUpserted}`);
      console.log(`  rejectCount:      ${row.rejectCount}`);
      console.log(`  http4xx/5xx/cf:   ${row.http4xxCount} / ${row.http5xxCount} / ${row.cfChallengeCount}`);
      if (row.errorMessage) console.log(`  errorMessage:     ${row.errorMessage.slice(0, 400)}`);
      console.log("");
      console.log(ok ? "✓ Verified — proxy + scraper work in Railway." : "⚠ Job finished but recordsFetched=0 or status=failed. See above.");
      return;
    }

    const status = row
      ? `claimed by worker, running (started ${Math.round((Date.now() - row.startedAt.getTime()) / 1000)}s ago)`
      : "not yet claimed by worker — should be picked up within seconds. If this stays >2 min, the worker process likely isn't running on Railway.";
    if (status !== lastSeen) {
      const elapsedS = Math.round((Date.now() - enqueuedAt.getTime()) / 1000);
      console.log(`  [poll +${elapsedS}s] ${status}`);
      lastSeen = status;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("");
  console.log("⚠ Timed out after 10 min. Check Railway logs for worker-bullmq, and re-query:");
  console.log(`  SELECT * FROM flipops."BulkIngestJob" WHERE "sourceKey"='${sourceKey}' AND "triggerType"='manual-script' ORDER BY "startedAt" DESC LIMIT 1;`);
}

async function main() {
  const args = process.argv.slice(2);
  const sourceKey = args.find((a) => !a.startsWith("--"));
  const wait = args.includes("--wait");

  if (!sourceKey) {
    console.error("USAGE: npx tsx scripts/trigger-scraper.ts <sourceKey> [--wait]");
    console.error("");
    console.error("Examples:");
    console.error("  npx tsx scripts/trigger-scraper.ts duval-clerk-recordings --wait");
    console.error("  npx tsx scripts/trigger-scraper.ts realauction-fl-foreclosures");
    process.exit(2);
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("FATAL: REDIS_URL is not set.");
    console.error("");
    console.error("Get it from Railway → your-project → worker-bullmq → Variables → REDIS_URL");
    console.error("Then run with:");
    console.error(`  REDIS_URL='<paste>' DATABASE_URL='<paste>' npx tsx scripts/trigger-scraper.ts ${sourceKey}${wait ? " --wait" : ""}`);
    process.exit(2);
  }

  console.log(`Redis URL:     ${maskUrl(redisUrl)}`);
  console.log(`DATABASE_URL:  ${maskUrl(process.env.DATABASE_URL)}`);
  console.log(`Source key:    ${sourceKey}`);
  console.log(`Wait for done: ${wait}`);
  console.log("");

  // Resolve the queue.
  const registry = await prisma.scrapeRegistry.findUnique({ where: { sourceKey } });
  if (!registry) {
    console.error(`FATAL: Unknown sourceKey '${sourceKey}' (not in ScrapeRegistry).`);
    console.error("Known keys:");
    const all = await prisma.scrapeRegistry.findMany({ select: { sourceKey: true, domain: true, enabled: true } });
    for (const r of all) {
      console.error(`  ${r.enabled ? "✓" : " "} ${r.sourceKey.padEnd(40)} (${r.domain})`);
    }
    process.exit(2);
  }

  const queueName = QUEUE_BY_DOMAIN[registry.domain] ?? "domain-default";
  console.log(`Resolved queue: ${queueName} (domain=${registry.domain}, enabled=${registry.enabled})`);

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  const queue = new Queue(queueName, { connection });

  try {
    const enqueuedAt = new Date();
    const job = await queue.add(
      sourceKey,
      { sourceKey, trigger: "manual-script" },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    console.log(`\nEnqueued: BullMQ jobId=${job.id} on ${queueName} at ${enqueuedAt.toISOString()}`);

    if (!wait) {
      console.log("\nNot waiting (--wait not specified). Check Railway worker logs or run:");
      console.log(`  SELECT * FROM flipops."BulkIngestJob" WHERE "sourceKey"='${sourceKey}' AND "triggerType"='manual-script' ORDER BY "startedAt" DESC LIMIT 1;`);
      return;
    }

    if (!process.env.DATABASE_URL) {
      console.error("\nWARN: --wait passed but DATABASE_URL not set; cannot poll audit table.");
      return;
    }

    console.log("\nPolling BulkIngestJob audit table every 5s (max 10 min) for latest manual-script row...");
    await pollForCompletion(sourceKey, enqueuedAt);
  } finally {
    await queue.close().catch(() => {});
    await connection.quit().catch(() => {});
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
