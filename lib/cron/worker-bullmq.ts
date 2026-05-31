/* eslint-disable no-console */
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { parseExpression } from "cron-parser";
import { prisma } from "@/lib/prisma";
import { resolveAdapter, registeredSourceKeys } from "@/lib/scrapers/dispatch";
import { createRunStatsCollector } from "@/lib/scrapers/dispatch/run-stats";
import type { RunContext } from "@/lib/scrapers/dispatch/types";
import { runScraperHealthCheck } from "@/lib/cron/monitoring/scraper-health";
import { setupMonitoringJobs } from "@/lib/cron/worker-bullmq-monitoring";

// ---------------------------------------------------------------------------
// worker-bullmq — the BullMQ-driven freshness scheduler.
//
// Separate Railway service from the legacy `worker` (G1-G4 + execSync). See
// docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Phase 6 = Strategy C (Hybrid)"
// for why we keep them in different processes.
//
// On boot:
//   1. Connect to Redis (BullMQ requires maxRetriesPerRequest: null)
//   2. Load all ScrapeRegistry rows where enabled=true
//   3. Validate cronExpr; skip+log invalid rows (no crash)
//   4. Per-domain Queues with concurrency caps (sum = 15 = connection_limit)
//   5. Per-row JobScheduler.upsertJobScheduler on the appropriate domain queue
//   6. Spawn one Worker per queue with attempts/backoff/stalled-job reclaim
//   7. Re-sync registry every 60s to pick up new/edited rows
//
// Each fired job:
//   - Re-reads the registry row (live config, not boot-time snapshot)
//   - Skips if disabled or out-of-season
//   - Resolves adapter from dispatch map (Phase 2 fills this)
//   - If no adapter: log + return cleanly (NOT an error — Phase 1 ships empty)
//   - If adapter: create BulkIngestJob audit row, call adapter, update registry
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[worker-bullmq] REDIS_URL is required");
  process.exit(1);
}

// BullMQ requires this exact ioredis config — see https://docs.bullmq.io
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on("error", (err) => {
  console.error("[worker-bullmq] redis error:", err.message);
});

// ---------------------------------------------------------------------------
// Per-domain queue config. Sum of concurrency = 15 (matches connection_limit).
// New domains fall through to the "default" queue.
// ---------------------------------------------------------------------------

interface QueueConfig {
  queueName: string;
  concurrency: number;
  /** BullMQ per-queue rate limiter: max <max> jobs every <duration> ms. */
  limiter: { max: number; duration: number };
}

const QUEUE_BY_DOMAIN: Record<string, QueueConfig> = {
  "jaxdailyrecord.com":      { queueName: "domain-jaxdailyrecord", concurrency: 1, limiter: { max: 30, duration: 60_000 } },
  "lienhub.com":             { queueName: "domain-lienhub",        concurrency: 2, limiter: { max: 40, duration: 60_000 } },
  "realauction.com":         { queueName: "domain-realauction",    concurrency: 2, limiter: { max: 40, duration: 60_000 } },
  "miamidade.gov":           { queueName: "domain-miamidade",      concurrency: 1, limiter: { max: 20, duration: 60_000 } },
  "county-taxes.net":        { queueName: "domain-county-taxes",   concurrency: 1, limiter: { max: 20, duration: 60_000 } },
  "floridapublicnotices.com":{ queueName: "domain-flpublicnotices",concurrency: 2, limiter: { max: 60, duration: 60_000 } },
  "duvalclerk.com":          { queueName: "domain-duvalclerk",     concurrency: 1, limiter: { max: 30, duration: 60_000 } },
  "floridarevenue.com":      { queueName: "bulk-ingest",           concurrency: 1, limiter: { max: 5,  duration: 60_000 } },
};

const DEFAULT_QUEUE: QueueConfig = {
  queueName: "domain-default",
  concurrency: 4,
  limiter: { max: 60, duration: 60_000 },
};

function configForDomain(domain: string): QueueConfig {
  return QUEUE_BY_DOMAIN[domain] ?? DEFAULT_QUEUE;
}

// Track instantiated queues + workers so we don't double-create.
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

function getQueue(qcfg: QueueConfig): Queue {
  const existing = queues.get(qcfg.queueName);
  if (existing) return existing;
  const q = new Queue(qcfg.queueName, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 200, age: 30 * 24 * 60 * 60 },
      removeOnFail: { count: 500 },
    },
  });
  queues.set(qcfg.queueName, q);
  return q;
}

function ensureWorker(qcfg: QueueConfig): void {
  if (workers.has(qcfg.queueName)) return;
  const w = new Worker(qcfg.queueName, processJob, {
    connection,
    concurrency: qcfg.concurrency,
    limiter: qcfg.limiter,
    stalledInterval: 60_000,
    lockDuration: 5 * 60_000, // 5 min — longer than any expected scrape
  });
  w.on("failed", (job, err) => {
    console.error(
      `[worker-bullmq] job failed: queue=${qcfg.queueName} sourceKey=${job?.data?.sourceKey} attempts=${job?.attemptsMade}/${job?.opts?.attempts} err=${err.message}`,
    );
  });
  w.on("error", (err) => {
    console.error(`[worker-bullmq] worker error queue=${qcfg.queueName}:`, err.message);
  });
  workers.set(qcfg.queueName, w);
  console.log(
    `[worker-bullmq] spawned worker queue=${qcfg.queueName} concurrency=${qcfg.concurrency} limit=${qcfg.limiter.max}/${qcfg.limiter.duration}ms`,
  );
}

// ---------------------------------------------------------------------------
// Boot-time + every-60s registry sync. Reads ScrapeRegistry, validates
// cronExpr, schedules each enabled row via JobScheduler on its domain queue.
// Skips invalid cron expressions with a warning (no crash).
// ---------------------------------------------------------------------------

interface ScheduledState {
  /** Cron expression we last upserted for this sourceKey. */
  cronExpr: string;
  /** Queue we scheduled it on. */
  queueName: string;
}

const scheduled = new Map<string, ScheduledState>();

async function syncRegistry(): Promise<void> {
  const rows = await prisma.scrapeRegistry.findMany({ where: { enabled: true } });
  let synced = 0;
  let skipped = 0;
  let unscheduled = 0;

  // Track which sourceKeys we saw this pass — disabled or removed rows get
  // explicitly unscheduled.
  const seenThisPass = new Set<string>();

  for (const row of rows) {
    seenThisPass.add(row.sourceKey);
    // Validate cron expression.
    try {
      parseExpression(row.cronExpr, { tz: row.timezone ?? "America/New_York" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[worker-bullmq] invalid cronExpr for sourceKey=${row.sourceKey}: ${msg}`);
      await prisma.scrapeRegistry.update({
        where: { id: row.id },
        data: { pausedReason: `invalid cronExpr: ${msg}` },
      });
      skipped++;
      continue;
    }

    const qcfg = configForDomain(row.domain);
    const queue = getQueue(qcfg);
    ensureWorker(qcfg);

    const prev = scheduled.get(row.sourceKey);
    if (prev && prev.cronExpr === row.cronExpr && prev.queueName === qcfg.queueName) {
      // Unchanged — JobScheduler is idempotent but skip the call to save round-trips.
      continue;
    }

    await queue.upsertJobScheduler(
      row.sourceKey,
      { pattern: row.cronExpr, tz: row.timezone ?? "America/New_York" },
      {
        name: row.sourceKey,
        data: { sourceKey: row.sourceKey },
      },
    );
    scheduled.set(row.sourceKey, { cronExpr: row.cronExpr, queueName: qcfg.queueName });
    synced++;
  }

  // Unschedule rows that were previously scheduled but are no longer enabled.
  for (const [sourceKey, state] of scheduled.entries()) {
    if (seenThisPass.has(sourceKey)) continue;
    const queue = queues.get(state.queueName);
    if (queue) {
      await queue.removeJobScheduler(sourceKey).catch(() => {});
    }
    scheduled.delete(sourceKey);
    unscheduled++;
  }

  console.log(
    `[worker-bullmq] registry sync — ${synced} new/changed, ${scheduled.size} active, ${skipped} invalid, ${unscheduled} unscheduled`,
  );
}

// ---------------------------------------------------------------------------
// Job processor — called by BullMQ Workers. One per scheduled tick of any
// registry row.
// ---------------------------------------------------------------------------

async function processJob(job: Job): Promise<void> {
  const sourceKey: string = job.data?.sourceKey;
  if (!sourceKey) {
    console.warn("[worker-bullmq] job missing sourceKey:", job.id);
    return;
  }

  const row = await prisma.scrapeRegistry.findUnique({ where: { sourceKey } });
  if (!row) {
    console.warn(`[worker-bullmq] no registry row for sourceKey=${sourceKey} — skipping`);
    return;
  }
  if (!row.enabled) {
    console.log(`[worker-bullmq] sourceKey=${sourceKey} disabled — skipping`);
    return;
  }

  // Season filter.
  if (row.seasonStartMonth != null && row.seasonEndMonth != null) {
    const month = new Date().getMonth() + 1;
    const inSeason =
      row.seasonStartMonth <= row.seasonEndMonth
        ? month >= row.seasonStartMonth && month <= row.seasonEndMonth
        : month >= row.seasonStartMonth || month <= row.seasonEndMonth; // wraps year-end
    if (!inSeason) {
      console.log(
        `[worker-bullmq] sourceKey=${sourceKey} out-of-season (month=${month}, range=${row.seasonStartMonth}-${row.seasonEndMonth}) — skipping`,
      );
      return;
    }
  }

  const adapter = resolveAdapter(sourceKey);
  if (!adapter) {
    // Phase 1 ships with empty DISPATCH; this is the expected state for all
    // 9 registry rows until Phase 2 fills in the adapters. NOT an error —
    // return cleanly so BullMQ doesn't retry-storm.
    console.log(`[worker-bullmq] no adapter registered for sourceKey=${sourceKey} (Phase 2 will add)`);
    return;
  }

  // Create audit row.
  const audit = await prisma.bulkIngestJob.create({
    data: {
      sourceTag: `scraper:${sourceKey}-${new Date().toISOString().slice(0, 10)}`,
      sourceKey,
      scope: row.countyFips ?? row.state ?? "unknown",
      status: "running",
      triggerType: "cron",
    },
  });

  const stats = createRunStatsCollector();
  const ctx: RunContext = {
    sourceKey,
    runId: audit.id,
    lastRunAt: row.lastRunAt,
    lastHighWaterMark: row.lastHighWaterMark,
    registry: {
      sourceKey: row.sourceKey,
      domain: row.domain,
      countyFips: row.countyFips,
      state: row.state,
      strategy: row.strategy,
      rateLimitMs: row.rateLimitMs,
      proxyMode: row.proxyMode,
      legalRisk: row.legalRisk,
      bootstrapping: row.bootstrapping,
    },
    stats,
  };

  const start = Date.now();
  try {
    const result = await adapter(ctx);
    const durationMs = Date.now() - start;
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "succeeded",
        recordsFetched: result.rowCount,
        recordsUpserted: result.rowCount,
        rejectCount: result.rejectCount,
        http4xxCount: result.stats.http4xxCount,
        http5xxCount: result.stats.http5xxCount,
        cfChallengeCount: result.stats.cfChallengeCount,
        selectorMissRate: result.stats.selectorMissRate,
        runStatsJson: result.stats as unknown as object,
        finishedAt: new Date(),
        durationMs,
      },
    });
    await prisma.scrapeRegistry.update({
      where: { sourceKey },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        lastRowCount: result.rowCount,
        lastHighWaterMark: result.newHighWaterMark ?? row.lastHighWaterMark,
        consecutiveFails: 0,
      },
    });
    console.log(
      `[worker-bullmq] succeeded sourceKey=${sourceKey} rows=${result.rowCount} rejects=${result.rejectCount} ${durationMs}ms`,
    );
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "failed",
        errorMessage: msg,
        finishedAt: new Date(),
        durationMs,
        runStatsJson: stats.snapshot() as unknown as object,
      },
    });
    await prisma.scrapeRegistry.update({
      where: { sourceKey },
      data: {
        lastRunAt: new Date(),
        lastFailureAt: new Date(),
        lastFailureReason: msg,
        consecutiveFails: { increment: 1 },
      },
    });
    throw err; // surface to BullMQ for retry/backoff
  }
}

// ---------------------------------------------------------------------------
// Boot + graceful shutdown
// ---------------------------------------------------------------------------

let resyncTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// Internal queue: scraper-health.
// Runs lib/cron/monitoring/scraper-health.ts every 15 minutes. Not a registry
// row — wired directly here so it's always armed regardless of registry state.
// ---------------------------------------------------------------------------

const HEALTH_QUEUE_NAME = "internal-health";
const HEALTH_SCHEDULER_ID = "scraper-health";
const HEALTH_CRON = "*/15 * * * *";

async function ensureHealthCheckScheduler(): Promise<void> {
  const queue = new Queue(HEALTH_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 1, // health check is idempotent; don't retry-storm
      removeOnComplete: { count: 100, age: 7 * 24 * 60 * 60 },
      removeOnFail: { count: 100 },
    },
  });
  queues.set(HEALTH_QUEUE_NAME, queue);

  const worker = new Worker(
    HEALTH_QUEUE_NAME,
    async () => {
      try {
        await runScraperHealthCheck(connection);
      } catch (err) {
        console.error("[scraper-health] check failed:", err instanceof Error ? err.message : err);
        throw err;
      }
    },
    {
      connection,
      concurrency: 1,
      stalledInterval: 60_000,
      lockDuration: 5 * 60_000,
    },
  );
  worker.on("failed", (job, err) => {
    console.error(`[scraper-health] job failed attempts=${job?.attemptsMade}: ${err.message}`);
  });
  workers.set(HEALTH_QUEUE_NAME, worker);

  await queue.upsertJobScheduler(
    HEALTH_SCHEDULER_ID,
    { pattern: HEALTH_CRON, tz: "America/New_York" },
    { name: HEALTH_SCHEDULER_ID, data: { kind: "scraper-health" } },
  );
  console.log(`[worker-bullmq] scraper-health scheduled (${HEALTH_CRON})`);
}

async function main(): Promise<void> {
  console.log("[worker-bullmq] booting…");
  console.log(`[worker-bullmq] registered adapter source keys: ${registeredSourceKeys().length === 0 ? "(none — Phase 1)" : registeredSourceKeys().join(", ")}`);

  // Wait for Redis to be ready (3-5s on Railway cold start).
  await new Promise<void>((resolve, reject) => {
    if (connection.status === "ready") return resolve();
    const onReady = () => {
      connection.off("error", onErr);
      resolve();
    };
    const onErr = (err: Error) => {
      connection.off("ready", onReady);
      reject(err);
    };
    connection.once("ready", onReady);
    connection.once("error", onErr);
  });
  console.log("[worker-bullmq] redis ready");

  // Internal health-check scheduler (Phase 3).
  await ensureHealthCheckScheduler();

  // Phase 6: 5 monitoring/discovery jobs migrated from legacy execSync.
  await setupMonitoringJobs(connection, queues, workers);

  // Initial registry sync.
  await syncRegistry();

  // Re-sync every 60s.
  resyncTimer = setInterval(() => {
    syncRegistry().catch((err) => {
      console.error("[worker-bullmq] registry sync failed:", err.message);
    });
  }, 60_000);

  console.log("[worker-bullmq] running");
}

async function shutdown(reason: string): Promise<void> {
  console.log(`[worker-bullmq] shutdown (${reason})…`);
  if (resyncTimer) clearInterval(resyncTimer);
  // Stop all workers first (drains in-flight jobs).
  await Promise.all(
    Array.from(workers.values()).map((w) =>
      w.close().catch((e) => console.error("[worker-bullmq] worker close:", e.message)),
    ),
  );
  // Then close queues + connection.
  await Promise.all(
    Array.from(queues.values()).map((q) =>
      q.close().catch((e) => console.error("[worker-bullmq] queue close:", e.message)),
    ),
  );
  await connection.quit().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  console.log("[worker-bullmq] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((err) => {
  console.error("[worker-bullmq] fatal boot error:", err);
  process.exit(1);
});
