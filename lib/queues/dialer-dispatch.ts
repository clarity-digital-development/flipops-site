/* eslint-disable no-console */
import { Queue } from "bullmq";
import type IORedis from "ioredis";

import type { StateCode } from "@/lib/dialer/quiet-hours";

// ---------------------------------------------------------------------------
// dialer-dispatch — TCPA-safe outbound queue.
//
// Producers (lead-action endpoints, Sprint 2 dialer UI, Sprint 3 Telnyx
// webhook callbacks) enqueue jobs onto this queue with `enqueueDialerDispatch`.
// The worker (lib/queues/workers/dialer-dispatch-worker.ts) gates every job
// against the recipient state's quiet-hours window before calling Telnyx.
//
// Why a dedicated queue instead of piggybacking on `internal-monitoring`:
//   1. Outbound voice / SMS has a fundamentally different SLA shape than
//      cron-style monitoring jobs — single-job latency matters.
//   2. Rate-limit + concurrency must be tuned for Telnyx-side quotas, not
//      scraper-side politeness budgets.
//   3. Auditability: every dispatch attempt needs its own BulkIngestJob row
//      with `sourceTag=dialer-dispatch:<jobType>` for compliance review.
//
// Telnyx call/SMS dispatch is NOT implemented yet. The worker calls a
// placeholder `dispatchToTelnyx()` that throws — proves the safety gating
// works and surfaces a clear error if anything tries to send before Sprint 3.
// ---------------------------------------------------------------------------

export const DIALER_DISPATCH_QUEUE_NAME = "dialer-dispatch";

export type DialerJobType = "sms" | "voice" | "voicemail";

export interface DialerDispatchJob {
  /**
   * Outbound channel. Determines which Telnyx surface the worker will
   * eventually invoke (Messaging API for sms, Call Control for voice,
   * Voicemail Drop for voicemail).
   */
  jobType: DialerJobType;
  /**
   * Tenant making the outbound contact. Required for the consent + DNC
   * gates — consent is per (userId, phoneNumber), not global. Optional in
   * the type for backward compatibility with legacy producers; the worker
   * fails closed (refuses dispatch) when missing.
   */
  userId?: string;
  /** Recipient phone in E.164 format, e.g. "+19045551234". */
  toNumber: string;
  /** Origination phone (one of our Telnyx numbers) in E.164 format. */
  fromNumber: string;
  /**
   * Two-letter state code for the recipient's property, if known from a
   * Property record. Preferred over area-code lookup because Property.state
   * is canonical; phone area codes are best-effort.
   */
  propertyState?: StateCode;
  /** SMS body or voicemail script. Optional for voice (live-dial) jobs. */
  body?: string;
  /**
   * Optional ISO timestamp. If set and in the future, the job is delayed
   * until that time. Producers use this for "call me back at 2pm Tuesday"
   * flows; otherwise the worker schedules immediately and the quiet-hours
   * gate decides whether to dispatch or re-enqueue.
   */
  scheduledFor?: string;
  /**
   * Free-form correlation handle for audit + retry-storm debugging.
   * Typically a Lead.id or Property.id. Surfaced in BulkIngestJob.sourceTag.
   */
  correlationId?: string;
  /**
   * Optional Campaign.id when this dispatch belongs to a buyer-blast or
   * deferred-followup campaign. When set, the worker upserts a
   * CampaignRecipient row keyed by (campaignId + toPhoneNumber) on dispatch
   * success/failure and bumps Campaign.sentCount / failedCount accordingly.
   * Webhook handlers then resolve telnyxMessageId → CampaignRecipient to
   * bump deliveredCount on `message.finalized` / `message.delivery_failed`.
   */
  campaignId?: string;
}

export const dialerQueueDefaultJobOptions = {
  attempts: 3,
  // Network blip vs Telnyx 5xx — exponential with a 30s floor so we never
  // hammer Telnyx on transient failures. Quiet-hours re-enqueues use
  // explicit `delay`, not attempts, so they don't burn retry budget.
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: 500, age: 30 * 24 * 60 * 60 },
  removeOnFail: { count: 1000 },
};

/**
 * Lazy queue singleton. Created on first call so import-side modules
 * (e.g. type-only consumers) don't require Redis to be reachable.
 */
let queueSingleton: Queue<DialerDispatchJob> | null = null;

export function getDialerDispatchQueue(
  connection: IORedis,
): Queue<DialerDispatchJob> {
  if (queueSingleton) return queueSingleton;
  queueSingleton = new Queue<DialerDispatchJob>(DIALER_DISPATCH_QUEUE_NAME, {
    connection,
    defaultJobOptions: dialerQueueDefaultJobOptions,
  });
  return queueSingleton;
}

/**
 * Enqueue an outbound dispatch. Producers (API routes, lead-action handlers)
 * call this; the worker handles quiet-hours gating + Telnyx dispatch.
 *
 * If `scheduledFor` is in the future, the job is delayed until that time.
 * Otherwise it runs ASAP — the worker still enforces the recipient-state
 * quiet-hours window before any send.
 */
export async function enqueueDialerDispatch(
  connection: IORedis,
  job: DialerDispatchJob,
): Promise<string> {
  const queue = getDialerDispatchQueue(connection);
  const opts: { delay?: number; jobId?: string } = {};
  if (job.scheduledFor) {
    const when = new Date(job.scheduledFor).getTime();
    const delay = when - Date.now();
    if (delay > 0) opts.delay = delay;
  }
  const bullJob = await queue.add(job.jobType, job, opts);
  return bullJob.id ?? "";
}
