/* eslint-disable no-console */
import { Queue, Worker, type Job } from "bullmq";
import type IORedis from "ioredis";

import { prisma } from "@/lib/prisma";
import {
  isWithinQuietHours,
  nextPermittedTime,
  resolveStateFromPhone,
  type StateCode,
} from "@/lib/dialer/quiet-hours";
import {
  DIALER_DISPATCH_QUEUE_NAME,
  dialerQueueDefaultJobOptions,
  type DialerDispatchJob,
} from "@/lib/queues/dialer-dispatch";

// ---------------------------------------------------------------------------
// dialer-dispatch worker — TCPA safety wrapper for outbound voice/SMS.
//
// Flow per job:
//   1. Resolve recipient state from `propertyState` (canonical) or
//      `resolveStateFromPhone(toNumber)` (best-effort fallback).
//   2. If state cannot be resolved → write `tcpa-unknown-state` audit row
//      and throw. Better to fail loud than risk a TCPA violation on a
//      phone whose state we can't determine. Producers should attach
//      `propertyState` whenever possible.
//   3. If we are inside the permitted window for that state → call the
//      placeholder `dispatchToTelnyx()` which throws "not implemented".
//      This proves the safety gate is reachable and that any code path
//      attempting dispatch before Sprint 3 will surface a clear error.
//   4. If we are outside the window → compute `nextPermittedTime()` and
//      re-enqueue with `delay`. Write a `tcpa-deferred` BulkIngestJob audit
//      row recording the original target time and the deferred-until time.
//
// This worker is the single chokepoint for outbound dispatch. The contract
// is: no Telnyx call/SMS goes out except through this worker. Sprint 3 will
// replace the placeholder with the real Telnyx client; the gating logic
// above MUST NOT change.
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;

// Modest rate limiter: 60 jobs / 60s. Real Telnyx-tuned values come in
// Sprint 3 once we have account-specific quotas. Keeping it conservative
// here means we never accidentally fan out a backlog drain at full speed.
const LIMITER = { max: 60, duration: 60_000 };

/**
 * Placeholder dispatch — intentionally throws. Sprint 3 replaces this with
 * the real Telnyx Messaging / Call Control / Voicemail Drop integration.
 *
 * The reason this throws instead of returning silently: a silent no-op here
 * would hide every quiet-hours gating bug behind a fake success. Throwing
 * means an accidental pre-Sprint-3 producer trips a loud failed-job + retry
 * + alert chain, and we find out immediately.
 */
async function dispatchToTelnyx(job: DialerDispatchJob): Promise<void> {
  throw new Error(
    `Telnyx dispatch not implemented (Sprint 3). Quiet-hours gate passed for jobType=${job.jobType} to=${job.toNumber} from=${job.fromNumber}.`,
  );
}

function resolveRecipientState(
  job: DialerDispatchJob,
): StateCode | null {
  if (job.propertyState) return job.propertyState;
  return resolveStateFromPhone(job.toNumber);
}

async function writeDispatchAudit(opts: {
  job: DialerDispatchJob;
  status:
    | "tcpa-deferred"
    | "tcpa-unknown-state"
    | "dispatched"
    | "dispatch-failed";
  state: StateCode | null;
  errorMessage?: string;
  deferredUntil?: Date;
  durationMs?: number;
}): Promise<void> {
  try {
    await prisma.bulkIngestJob.create({
      data: {
        sourceTag: `dialer-dispatch:${opts.job.jobType}${opts.job.correlationId ? `:${opts.job.correlationId}` : ""}`,
        // `sourceKey` is FK-constrained to ScrapeRegistry; dispatch jobs
        // have no registry row so we must leave it null.
        sourceKey: null,
        scope: opts.state ?? "unknown-state",
        status: opts.status,
        triggerType: "dialer-dispatch",
        errorMessage: opts.errorMessage,
        recordsFetched: 0,
        recordsUpserted: 0,
        durationMs: opts.durationMs ?? 0,
        finishedAt: new Date(),
        runStatsJson: {
          jobType:        opts.job.jobType,
          toNumber:       opts.job.toNumber,
          fromNumber:     opts.job.fromNumber,
          propertyState:  opts.job.propertyState ?? null,
          deferredUntil:  opts.deferredUntil?.toISOString() ?? null,
          correlationId:  opts.job.correlationId ?? null,
        } as unknown as object,
      },
    });
  } catch (err) {
    // Best-effort: never let an audit-row write failure mask the dispatch
    // result itself. Mirrors the pattern in worker-bullmq.ts writeSkipRow.
    console.error(
      `[dialer-dispatch] failed to write audit row status=${opts.status}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export async function processDialerDispatchJob(
  job: Job<DialerDispatchJob>,
  connection: IORedis,
): Promise<void> {
  const data = job.data;
  const state = resolveRecipientState(data);

  // Unknown state → fail loud. We refuse to dispatch without TCPA gating.
  if (!state) {
    const msg = `Cannot resolve recipient state for to=${data.toNumber} (no propertyState, area-code lookup miss). Refusing dispatch to avoid TCPA violation.`;
    console.warn(`[dialer-dispatch] ${msg}`);
    await writeDispatchAudit({
      job: data,
      status: "tcpa-unknown-state",
      state: null,
      errorMessage: msg,
    });
    throw new Error(msg);
  }

  const now = new Date();
  const withinWindow = isWithinQuietHours(state, now);

  if (!withinWindow) {
    // Re-enqueue with delay until next permitted time. This branch is the
    // expected behavior for any job that arrives outside the recipient
    // state's calling window — not an error.
    const deferredUntil = nextPermittedTime(state, now);
    const delay = Math.max(0, deferredUntil.getTime() - now.getTime());

    // Use a separate one-off Queue handle to enqueue the deferred job so
    // we don't have to plumb the singleton through the worker constructor.
    // BullMQ allows multiple Queue handles on the same name.
    const queue = new Queue<DialerDispatchJob>(DIALER_DISPATCH_QUEUE_NAME, {
      connection,
      defaultJobOptions: dialerQueueDefaultJobOptions,
    });
    try {
      await queue.add(data.jobType, data, { delay });
    } finally {
      await queue.close().catch(() => {});
    }

    await writeDispatchAudit({
      job: data,
      status: "tcpa-deferred",
      state,
      deferredUntil,
      errorMessage: `Outside quiet-hours window for ${state}; re-enqueued for ${deferredUntil.toISOString()}`,
    });
    console.log(
      `[dialer-dispatch] deferred jobType=${data.jobType} to=${data.toNumber} state=${state} until=${deferredUntil.toISOString()} (delay=${Math.round(delay / 1000)}s)`,
    );
    return;
  }

  // Inside window — attempt dispatch. Sprint 3 wires the real Telnyx call;
  // until then `dispatchToTelnyx` throws so any premature producer surfaces
  // a loud error in the BullMQ failed-jobs panel.
  const start = Date.now();
  try {
    await dispatchToTelnyx(data);
    const durationMs = Date.now() - start;
    await writeDispatchAudit({
      job: data,
      status: "dispatched",
      state,
      durationMs,
    });
    console.log(
      `[dialer-dispatch] dispatched jobType=${data.jobType} to=${data.toNumber} state=${state} ${durationMs}ms`,
    );
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await writeDispatchAudit({
      job: data,
      status: "dispatch-failed",
      state,
      durationMs,
      errorMessage: msg,
    });
    throw err; // surface to BullMQ for retry/backoff
  }
}

/**
 * Register the dialer-dispatch queue + worker on the shared BullMQ
 * infrastructure. Called from `lib/cron/worker-bullmq.ts` at boot.
 */
export async function setupDialerDispatchJobs(
  connection: IORedis,
  queues: Map<string, Queue>,
  workers: Map<string, Worker>,
): Promise<void> {
  const queue = new Queue<DialerDispatchJob>(DIALER_DISPATCH_QUEUE_NAME, {
    connection,
    defaultJobOptions: dialerQueueDefaultJobOptions,
  });
  queues.set(DIALER_DISPATCH_QUEUE_NAME, queue);

  const worker = new Worker<DialerDispatchJob>(
    DIALER_DISPATCH_QUEUE_NAME,
    (job) => processDialerDispatchJob(job, connection),
    {
      connection,
      concurrency: CONCURRENCY,
      limiter: LIMITER,
      stalledInterval: 60_000,
      lockDuration: 2 * 60_000, // 2 min — voice/SMS dispatch is fast
    },
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[dialer-dispatch] job failed jobType=${job?.data?.jobType} to=${job?.data?.toNumber} attempts=${job?.attemptsMade}/${job?.opts?.attempts} err=${err.message}`,
    );
  });
  worker.on("error", (err) => {
    console.error(`[dialer-dispatch] worker error: ${err.message}`);
  });
  workers.set(DIALER_DISPATCH_QUEUE_NAME, worker);

  console.log(
    `[dialer-dispatch] queue + worker ready (concurrency=${CONCURRENCY}, limit=${LIMITER.max}/${LIMITER.duration}ms) — TCPA gate active, Telnyx dispatch placeholder`,
  );
}
