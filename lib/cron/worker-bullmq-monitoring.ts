/* eslint-disable no-console */
import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";

import { dataRefreshAndSync }           from "@/lib/cron/monitoring/data-refresh-sync";
import { pipelineMonitoring }           from "@/lib/cron/monitoring/pipeline-monitoring";
import { contractorPerformanceTracking } from "@/lib/cron/monitoring/contractor-performance";
import { attomPropertyDiscovery }       from "@/lib/cron/discovery/attom-property-discovery";
import { skipTracingEnrichment }        from "@/lib/cron/discovery/skip-tracing-enrichment";

// ---------------------------------------------------------------------------
// Phase 6 — migrate 5 monitoring/discovery jobs from legacy execSync to BullMQ.
//
// Strategy C hybrid: G1-G4 STAY on lib/cron/worker.ts (execSync isolation =
// safety guarantee for the guardrails). These 5 jobs migrate because they
// already export function entry points, run daily/weekly (low blast radius
// if one crashes the worker), and benefit from BullMQ's retry/backoff +
// stalled-job reclaim + per-attempt audit.
//
// All scheduled via JobScheduler with the original UTC cron strings to keep
// timing identical to the legacy worker.
//
// See docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Phase 6 = Strategy C".
// ---------------------------------------------------------------------------

const QUEUE_NAME = "internal-monitoring";

interface JobConfig {
  schedulerId: string;
  cron: string;
  fn: () => Promise<unknown>;
  label: string;
}

const JOBS: Record<string, JobConfig> = {
  "data-refresh-sync": {
    schedulerId:  "data-refresh-sync",
    cron:         "0 8 * * *",         // 8:00 AM UTC daily
    fn:           dataRefreshAndSync,
    label:        "Data Refresh & Sync",
  },
  "pipeline-monitoring": {
    schedulerId:  "pipeline-monitoring",
    cron:         "0 9 * * *",         // 9:00 AM UTC daily
    fn:           pipelineMonitoring,
    label:        "Pipeline Monitoring",
  },
  "contractor-performance": {
    schedulerId:  "contractor-performance",
    cron:         "0 10 * * *",        // 10:00 AM UTC daily
    fn:           contractorPerformanceTracking,
    label:        "Contractor Performance Tracking",
  },
  "attom-discovery": {
    schedulerId:  "attom-discovery",
    cron:         "0 6 * * *",         // 6:00 AM UTC daily
    fn:           attomPropertyDiscovery,
    label:        "ATTOM Property Discovery",
  },
  "skip-tracing": {
    schedulerId:  "skip-tracing",
    cron:         "0 7 * * 0",         // 7:00 AM UTC Sundays (weekly)
    fn:           skipTracingEnrichment,
    label:        "Skip Tracing & Enrichment",
  },
};

export async function setupMonitoringJobs(
  connection: Redis,
  queues: Map<string, Queue>,
  workers: Map<string, Worker>,
): Promise<void> {
  // Queue
  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { count: 100, age: 30 * 24 * 60 * 60 },
      removeOnFail: { count: 200 },
    },
  });
  queues.set(QUEUE_NAME, queue);

  // Worker — single concurrency (these are heavy serial jobs; running two of
  // them in the same process risks Prisma connection-pool exhaustion).
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const schedulerId = job.data?.schedulerId as string | undefined;
      if (!schedulerId) {
        console.warn(`[worker-bullmq:monitoring] job ${job.id} missing schedulerId`);
        return;
      }
      const cfg = JOBS[schedulerId];
      if (!cfg) {
        console.warn(`[worker-bullmq:monitoring] no job registered for schedulerId=${schedulerId}`);
        return;
      }
      const start = Date.now();
      console.log(`[worker-bullmq:monitoring] ▶ ${cfg.label}…`);
      try {
        await cfg.fn();
        const ms = Date.now() - start;
        console.log(`[worker-bullmq:monitoring] ✓ ${cfg.label} (${ms}ms)`);
      } catch (err) {
        const ms = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[worker-bullmq:monitoring] ✗ ${cfg.label} failed after ${ms}ms: ${msg}`);
        throw err; // BullMQ retry
      }
    },
    {
      connection,
      concurrency: 1, // single concurrency — see note above
      stalledInterval: 60_000,
      // Some discovery jobs run for 30+ min (ATTOM discovery, skip-tracing
      // with 1s sleeps). Set lockDuration well above any expected wall-clock
      // to avoid spurious stalled-job reclaim.
      lockDuration: 60 * 60_000, // 1 hour
    },
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[worker-bullmq:monitoring] failed schedulerId=${job?.data?.schedulerId} attempt=${job?.attemptsMade}/${job?.opts?.attempts}: ${err.message}`,
    );
  });
  workers.set(QUEUE_NAME, worker);

  // Schedule each job via BullMQ JobScheduler. tz=UTC matches the legacy
  // worker's `cron.schedule(..., {timezone: 'UTC'})`.
  for (const cfg of Object.values(JOBS)) {
    await queue.upsertJobScheduler(
      cfg.schedulerId,
      { pattern: cfg.cron, tz: "UTC" },
      {
        name: cfg.schedulerId,
        data: { schedulerId: cfg.schedulerId, kind: "monitoring" },
      },
    );
  }
  console.log(
    `[worker-bullmq:monitoring] scheduled ${Object.keys(JOBS).length} monitoring jobs: ${Object.keys(JOBS).join(", ")}`,
  );
}
