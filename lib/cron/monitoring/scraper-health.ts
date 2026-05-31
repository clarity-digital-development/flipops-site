/* eslint-disable no-console */
import type { Redis } from "ioredis";
import { prisma } from "@/lib/prisma";
import {
  computeBaseline,
  evaluateRun,
  expectedIntervalMs,
  isSuppressedDuringBootstrapping,
  requiredBootstrapRuns,
  type RunSnapshot,
  type Signal,
  type Tier,
} from "@/lib/scrapers/base/health-check";

// ---------------------------------------------------------------------------
// Scraper health orchestrator. Runs every 15 minutes inside worker-bullmq.
//
// For each enabled ScrapeRegistry row:
//   1. Read last 30 BulkIngestJob runs
//   2. Compute baseline from successful subset
//   3. Evaluate the most recent run against baseline + freshness
//   4. Apply cooldown (8h per source+signal via Redis)
//   5. Slack alert on P1/P2 (modulo cooldown)
//   6. Bootstrapping clearance check
//   7. Auto-pause if 2 consecutive P1s within 4h
//   8. @channel escalation: 3+ consecutive P1s within 24h → DM only
//
// Slack routing reads SLACK_WEBHOOK_URL (existing G1-G4 setup) and
// SLACK_ESCALATION_DM_USER_ID (set during Phase 0 provisioning).
// ---------------------------------------------------------------------------

const COOLDOWN_HOURS = 8;
const AUTO_PAUSE_WINDOW_HOURS = 4;
const ESCALATION_WINDOW_HOURS = 24;
const ESCALATION_THRESHOLD = 3;
const HISTORY_LOOKBACK = 30;

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const ESCALATION_DM_USER = process.env.SLACK_ESCALATION_DM_USER_ID;

interface HealthCheckSummary {
  evaluated: number;
  ok: number;
  p2: number;
  p1: number;
  autoPaused: number;
  bootstrappingCleared: number;
  alertsSuppressed: number;
}

export async function runScraperHealthCheck(redis: Redis): Promise<HealthCheckSummary> {
  const now = new Date();
  const summary: HealthCheckSummary = {
    evaluated: 0,
    ok: 0,
    p2: 0,
    p1: 0,
    autoPaused: 0,
    bootstrappingCleared: 0,
    alertsSuppressed: 0,
  };

  const rows = await prisma.scrapeRegistry.findMany({ where: { enabled: true } });
  for (const row of rows) {
    summary.evaluated++;
    try {
      await evaluateOne(row, now, redis, summary);
    } catch (err) {
      console.error(
        `[scraper-health] error evaluating sourceKey=${row.sourceKey}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[scraper-health] ${summary.evaluated} evaluated — OK=${summary.ok}, P2=${summary.p2}, P1=${summary.p1}, paused=${summary.autoPaused}, bootstrap-cleared=${summary.bootstrappingCleared}, suppressed=${summary.alertsSuppressed}`,
  );
  return summary;
}

async function evaluateOne(
  row: Awaited<ReturnType<typeof prisma.scrapeRegistry.findMany>>[number],
  now: Date,
  redis: Redis,
  summary: HealthCheckSummary,
): Promise<void> {
  // Load last 30 runs ordered newest-first.
  const history = await prisma.bulkIngestJob.findMany({
    where: { sourceKey: row.sourceKey },
    orderBy: { startedAt: "desc" },
    take: HISTORY_LOOKBACK,
    select: SNAPSHOT_SELECT,
  });

  const snapshots: RunSnapshot[] = history.map(toRunSnapshot);
  const baseline = computeBaseline(snapshots);
  const intervalMs = expectedIntervalMs(row.cronExpr, row.timezone);

  // If we have no run history at all, skip — nothing to evaluate yet.
  // Freshness check requires at least one prior success.
  if (snapshots.length === 0 && !row.lastSuccessAt) return;

  const latest = snapshots[0];
  const evaluation = evaluateRun(
    latest ?? emptySnapshot(),
    baseline,
    intervalMs,
    row.lastSuccessAt,
    now,
  );

  // Tally
  if (evaluation.tier === "OK") summary.ok++;
  else if (evaluation.tier === "P2") summary.p2++;
  else summary.p1++;

  // Stamp the audit row with computed tier (so dashboards can read it).
  if (latest && latest.finishedAt) {
    await prisma.bulkIngestJob.updateMany({
      where: { sourceKey: row.sourceKey, finishedAt: latest.finishedAt, tier: null },
      data: { tier: evaluation.tier },
    });
  }

  // Bootstrapping clearance — needs N successful runs per cadence-aware rule.
  await maybeClearBootstrapping(row, snapshots, intervalMs, summary);

  if (evaluation.tier === "OK") return;

  // Filter signals suppressed during bootstrapping.
  const actionable = row.bootstrapping
    ? evaluation.signals.filter((s) => !isSuppressedDuringBootstrapping(s.key))
    : evaluation.signals;
  if (actionable.length === 0) {
    summary.alertsSuppressed++;
    return; // signal exists but bootstrapping suppresses it
  }

  // Cooldown filtering — at most one alert per (sourceKey, signalKey) per COOLDOWN_HOURS.
  const freshSignals: Signal[] = [];
  for (const sig of actionable) {
    if (await isCoolingDown(redis, row.sourceKey, sig.key)) {
      summary.alertsSuppressed++;
      continue;
    }
    freshSignals.push(sig);
  }
  if (freshSignals.length === 0) return;

  // Determine highest tier across surviving signals.
  const effectiveTier: Tier = freshSignals.some((s) => s.tier === "P1") ? "P1" : "P2";

  // Send alert + mark cooldown for each signal that fired.
  await sendAlert(row, effectiveTier, freshSignals);
  for (const sig of freshSignals) {
    await markCooldown(redis, row.sourceKey, sig.key);
  }

  // P1-specific consequences: track + auto-pause + escalation.
  if (effectiveTier === "P1") {
    await prisma.scrapeRegistry.update({
      where: { id: row.id },
      data: { consecutiveP1Alerts: { increment: 1 } },
    });

    // Auto-pause if 2 P1 alerts within 4h.
    const recentP1 = await prisma.bulkIngestJob.count({
      where: {
        sourceKey: row.sourceKey,
        tier: "P1",
        finishedAt: { gte: new Date(now.getTime() - AUTO_PAUSE_WINDOW_HOURS * 60 * 60 * 1000) },
      },
    });
    if (recentP1 >= 2 && row.enabled) {
      await prisma.scrapeRegistry.update({
        where: { id: row.id },
        data: {
          enabled: false,
          pausedReason: `auto-paused: ${recentP1} P1 alerts within ${AUTO_PAUSE_WINDOW_HOURS}h. Latest signals: ${freshSignals.map((s) => s.key).join(", ")}`,
        },
      });
      summary.autoPaused++;
      console.log(
        `[scraper-health] AUTO-PAUSED sourceKey=${row.sourceKey} after ${recentP1} P1 alerts in ${AUTO_PAUSE_WINDOW_HOURS}h window`,
      );
    }
  } else if (isStalePastEscalationWindow(row, now)) {
    // P2 only: clear the consecutive counter if it's stale.
    await prisma.scrapeRegistry.update({
      where: { id: row.id },
      data: { consecutiveP1Alerts: 0 },
    });
  }
}

async function maybeClearBootstrapping(
  row: Awaited<ReturnType<typeof prisma.scrapeRegistry.findMany>>[number],
  snapshots: RunSnapshot[],
  intervalMs: number | null,
  summary: HealthCheckSummary,
): Promise<void> {
  if (!row.bootstrapping) return;
  const succeeded = snapshots.filter((s) => s.status === "succeeded").length;
  const required = requiredBootstrapRuns(intervalMs);
  if (succeeded < required) return;
  await prisma.scrapeRegistry.update({
    where: { id: row.id },
    data: { bootstrapping: false },
  });
  summary.bootstrappingCleared++;
  console.log(
    `[scraper-health] bootstrapping cleared for sourceKey=${row.sourceKey} after ${succeeded} successes (required: ${required})`,
  );
}

async function sendAlert(
  row: Awaited<ReturnType<typeof prisma.scrapeRegistry.findMany>>[number],
  tier: Tier,
  signals: Signal[],
): Promise<void> {
  if (!SLACK_WEBHOOK) {
    console.warn(`[scraper-health] SLACK_WEBHOOK_URL not set — skipping ${tier} alert for ${row.sourceKey}`);
    return;
  }

  const shouldEscalateToDm = await shouldRouteToDm(row);
  const headerEmoji = tier === "P1" ? "🚨" : "⚠️";
  const channelTag = tier === "P1" && !shouldEscalateToDm ? "<!channel> " : "";
  const dmTag = shouldEscalateToDm && ESCALATION_DM_USER ? `<@${ESCALATION_DM_USER}> ` : "";

  const title = `${headerEmoji} ${tier} ${row.sourceKey}`;
  const message = `${channelTag}${dmTag}${signals.length} signal(s) triggered\n` +
    signals.map((s) => `• *${s.key}* — ${s.detail}`).join("\n");

  const payload = {
    text: title,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      { type: "section", text: { type: "mrkdwn", text: message } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `domain: \`${row.domain}\` • bootstrapping: ${row.bootstrapping ? "yes" : "no"} • consecutiveP1: ${row.consecutiveP1Alerts} • ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[scraper-health] Slack webhook ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[scraper-health] Slack post failed:`, err instanceof Error ? err.message : err);
  }
}

async function shouldRouteToDm(
  row: Awaited<ReturnType<typeof prisma.scrapeRegistry.findMany>>[number],
): Promise<boolean> {
  if (!ESCALATION_DM_USER) return false;
  if (row.consecutiveP1Alerts < ESCALATION_THRESHOLD) return false;
  // Check if the consecutive count was incremented within the escalation window.
  const recentP1 = await prisma.bulkIngestJob.count({
    where: {
      sourceKey: row.sourceKey,
      tier: "P1",
      finishedAt: { gte: new Date(Date.now() - ESCALATION_WINDOW_HOURS * 60 * 60 * 1000) },
    },
  });
  return recentP1 >= ESCALATION_THRESHOLD;
}

async function isCoolingDown(redis: Redis, sourceKey: string, signalKey: string): Promise<boolean> {
  const exists = await redis.exists(coolDownKey(sourceKey, signalKey)).catch(() => 0);
  return exists === 1;
}

async function markCooldown(redis: Redis, sourceKey: string, signalKey: string): Promise<void> {
  await redis
    .set(coolDownKey(sourceKey, signalKey), "1", "EX", COOLDOWN_HOURS * 60 * 60)
    .catch(() => undefined);
}

function coolDownKey(sourceKey: string, signalKey: string): string {
  return `alert-cooldown:${sourceKey}:${signalKey}`;
}

const SNAPSHOT_SELECT = {
  recordsUpserted: true,
  rejectCount: true,
  http4xxCount: true,
  http5xxCount: true,
  cfChallengeCount: true,
  selectorMissRate: true,
  durationMs: true,
  status: true,
  finishedAt: true,
} as const;

function toRunSnapshot(j: {
  recordsUpserted: number;
  rejectCount: number;
  http4xxCount: number;
  http5xxCount: number;
  cfChallengeCount: number;
  selectorMissRate: number | null;
  durationMs: number | null;
  status: string;
  finishedAt: Date | null;
}): RunSnapshot {
  return {
    rowCount: j.recordsUpserted,
    rejectCount: j.rejectCount,
    http4xxCount: j.http4xxCount,
    http5xxCount: j.http5xxCount,
    cfChallengeCount: j.cfChallengeCount,
    selectorMissRate: j.selectorMissRate,
    durationMs: j.durationMs ?? 0,
    status: j.status,
    finishedAt: j.finishedAt,
  };
}

function emptySnapshot(): RunSnapshot {
  return {
    rowCount: 0,
    rejectCount: 0,
    http4xxCount: 0,
    http5xxCount: 0,
    cfChallengeCount: 0,
    selectorMissRate: null,
    durationMs: 0,
    status: "succeeded",
    finishedAt: null,
  };
}

/**
 * Returns true if the consecutiveP1Alerts counter is stale — meaning no P1
 * activity has updated the row inside the escalation window, so we can safely
 * reset it to zero.
 */
function isStalePastEscalationWindow(
  row: { consecutiveP1Alerts: number; updatedAt: Date },
  now: Date,
): boolean {
  if (row.consecutiveP1Alerts <= 0) return false;
  const ageMs = now.getTime() - row.updatedAt.getTime();
  return ageMs > ESCALATION_WINDOW_HOURS * 60 * 60 * 1000;
}
