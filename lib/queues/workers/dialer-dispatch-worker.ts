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
import { hasConsent } from "@/lib/consent/check";
import { checkDNC } from "@/lib/consent/dnc";

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
 * Real Telnyx dispatch (Sprint 3). Routes by jobType:
 *   - sms       → lib/telnyx/sms.ts sendSMS (10DLC Messaging API)
 *   - voicemail → lib/telnyx/voicemail.ts sendRinglessVoicemail (Call Control)
 *   - voice     → not supported from the worker. Live voice is the Flip Phone
 *                 WebRTC path; the worker only does async SMS + VM. Throwing
 *                 here keeps the BullMQ failed-jobs panel loud if a producer
 *                 ever enqueues a 'voice' job by mistake.
 *
 * Quiet-hours gating has already passed at this point — this function is
 * the actual carrier handoff, not the safety gate.
 */
async function dispatchToTelnyx(job: DialerDispatchJob): Promise<void> {
  if (job.jobType === "voice") {
    throw new Error(
      `voice from worker not supported, use WebRTC (to=${job.toNumber})`,
    );
  }

  if (job.jobType === "sms") {
    const body = job.body;
    if (!body || body.trim().length === 0) {
      throw new Error(
        `dispatchToTelnyx: jobType=sms requires non-empty body (to=${job.toNumber}, correlationId=${job.correlationId ?? "none"})`,
      );
    }
    const { sendSMS } = await import("@/lib/telnyx/sms");
    const msgId = await sendSMS({
      from: job.fromNumber,
      to: job.toNumber,
      body,
    });
    console.log(
      `[dialer-dispatch] sms sent to=${job.toNumber} from=${job.fromNumber} telnyxMessageId=${msgId}`,
    );
    return;
  }

  if (job.jobType === "voicemail") {
    // Body field is repurposed as the media URL for ringless voicemail —
    // producers pass a pre-recorded MP3/WAV URL (Cloudflare R2 / S3) and the
    // Telnyx Call Control playback flow drops it straight into the
    // recipient's voicemail box without ringing the handset.
    const mediaUrl = job.body;
    if (!mediaUrl || mediaUrl.trim().length === 0) {
      throw new Error(
        `dispatchToTelnyx: jobType=voicemail requires body=mediaUrl (to=${job.toNumber}, correlationId=${job.correlationId ?? "none"})`,
      );
    }
    const { sendRinglessVoicemail } = await import("@/lib/telnyx/voicemail");
    const callId = await sendRinglessVoicemail({
      from: job.fromNumber,
      to: job.toNumber,
      mediaUrl,
    });
    console.log(
      `[dialer-dispatch] rvm sent to=${job.toNumber} from=${job.fromNumber} telnyxCallControlId=${callId}`,
    );
    return;
  }

  // Exhaustiveness check — DialerJobType is a string union, so the compiler
  // will warn if a new variant lands without a handler above.
  const _exhaustive: never = job.jobType;
  throw new Error(`dispatchToTelnyx: unknown jobType=${String(_exhaustive)}`);
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
    | "tcpa-no-consent"
    | "tcpa-on-dnc"
    | "tcpa-missing-tenant"
    | "dispatched"
    | "dispatch-failed";
  state: StateCode | null;
  errorMessage?: string;
  deferredUntil?: Date;
  durationMs?: number;
  consentRecordId?: string | null;
  dncCheckedAt?: string | null;
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
          jobType:          opts.job.jobType,
          toNumber:         opts.job.toNumber,
          fromNumber:       opts.job.fromNumber,
          propertyState:    opts.job.propertyState ?? null,
          deferredUntil:    opts.deferredUntil?.toISOString() ?? null,
          correlationId:    opts.job.correlationId ?? null,
          userId:           opts.job.userId ?? null,
          consentRecordId:  opts.consentRecordId ?? null,
          dncCheckedAt:     opts.dncCheckedAt ?? null,
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

  // -------------------------------------------------------------------------
  // TCPA gate 0a — tenant identity required.
  //
  // Consent is per (userId, phoneNumber). A job without a userId cannot be
  // consent-checked, so we refuse dispatch. Producers should ALWAYS attach
  // userId from the authenticated request context. This branch exists to
  // catch legacy / test producers and fail closed.
  // -------------------------------------------------------------------------
  if (!data.userId) {
    const msg = `dialer-dispatch job missing userId — cannot perform TCPA consent check. Refusing dispatch. jobType=${data.jobType} to=${data.toNumber}`;
    console.warn(`[dialer-dispatch] ${msg}`);
    await writeDispatchAudit({
      job: data,
      status: "tcpa-missing-tenant",
      state: null,
      errorMessage: msg,
    });
    throw new Error(msg);
  }

  // -------------------------------------------------------------------------
  // TCPA gate 0b — express/implied consent required.
  //
  // Runs BEFORE the quiet-hours check because consent is a hard pre-condition;
  // there is no "defer until later" recovery from missing consent the way
  // there is for an out-of-window dispatch. If the consent record is missing
  // or revoked we must throw and never re-enqueue.
  // -------------------------------------------------------------------------
  const consent = await hasConsent({
    userId: data.userId,
    phoneNumber: data.toNumber,
    // Marketing autodial (SMS / voicemail-drop) requires express consent
    // under the FCC 2024 one-to-one rule. Live voice callbacks can ride on
    // implied consent for transactional business relationships.
    requireExpress: data.jobType !== "voice",
  });
  if (!consent.hasConsent) {
    const msg = `No valid consent record for userId=${data.userId} to=${data.toNumber} jobType=${data.jobType}. Refusing dispatch.`;
    console.warn(`[dialer-dispatch] ${msg}`);
    await writeDispatchAudit({
      job: data,
      status: "tcpa-no-consent",
      state: null,
      errorMessage: "no_consent",
    });
    // Do NOT throw — this is an expected business outcome, not a system
    // error. Throwing would burn retry budget and noise up the failed-jobs
    // panel for a known-bad recipient. Worker exits cleanly; audit row
    // captures the refusal.
    return;
  }

  // -------------------------------------------------------------------------
  // TCPA gate 0c — Do-Not-Call list scrub.
  //
  // Currently a stub that always returns onDNC:false. Once a real DNC vendor
  // is wired in (FreeDNC / Newkleus / etc.), this branch starts blocking
  // numbers on the federal + state + internal DNC lists.
  // -------------------------------------------------------------------------
  const dnc = await checkDNC(data.toNumber);
  if (dnc.onDNC) {
    const msg = `Phone ${data.toNumber} is on DNC (flags=${JSON.stringify(dnc.flags)}). Refusing dispatch.`;
    console.warn(`[dialer-dispatch] ${msg}`);
    await writeDispatchAudit({
      job: data,
      status: "tcpa-on-dnc",
      state: null,
      errorMessage: "on_dnc",
      consentRecordId: consent.recordId,
      dncCheckedAt: dnc.checkedAt,
    });
    return;
  }

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
      consentRecordId: consent.recordId,
      dncCheckedAt: dnc.checkedAt,
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
      consentRecordId: consent.recordId,
      dncCheckedAt: dnc.checkedAt,
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
      consentRecordId: consent.recordId,
      dncCheckedAt: dnc.checkedAt,
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
