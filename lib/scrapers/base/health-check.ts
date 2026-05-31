import { parseExpression } from "cron-parser";

// ---------------------------------------------------------------------------
// Pure health-check evaluators (no I/O).
//
// Given a recent run + historical baseline + registry config, decides whether
// the run is OK / P2 (queue for review) / P1 (alert + maybe auto-pause).
//
// The orchestrator at lib/cron/monitoring/scraper-health.ts handles DB reads,
// Slack alerts, cooldowns, and pausing. This file is testable in isolation.
//
// Thresholds match docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Health-check"
// — calibrated per-source via baseline ratios (not global percentages) so a
// tax-delinquent scraper that rejects 0% baseline doesn't auto-pause on the
// first 5% reject day.
// ---------------------------------------------------------------------------

export interface RunSnapshot {
  rowCount: number;
  rejectCount: number;
  http4xxCount: number;
  http5xxCount: number;
  cfChallengeCount: number;
  selectorMissRate: number | null;
  durationMs: number;
  /** "succeeded" | "failed" — failed runs surface tier=P1 by default. */
  status: string;
  finishedAt: Date | null;
}

export interface Baseline {
  sampleCount: number;
  medianRowCount: number;
  stddevRowCount: number;
  medianRejectRate: number; // rejects / (rows + rejects)
  median4xxRate: number;
  median5xxRate: number;
  p95DurationMs: number;
}

export type Tier = "OK" | "P2" | "P1";

export interface Signal {
  key: string;
  tier: Exclude<Tier, "OK">;
  detail: string;
  /** The numeric value that triggered the threshold (for the alert payload). */
  value: number;
  threshold: number;
}

export interface EvalResult {
  tier: Tier;
  signals: Signal[];
}

const MIN_SAMPLES_FOR_ZSCORE = 10;

/**
 * Compute baseline statistics from historical runs (typically last 30 successful).
 * Returns null when fewer than 4 succeeded runs are available.
 */
export function computeBaseline(history: RunSnapshot[]): Baseline | null {
  const ok = history.filter((r) => r.status === "succeeded");
  if (ok.length < 4) return null;

  const rowCounts = ok.map((r) => r.rowCount).sort((a, b) => a - b);
  const rejectRates = ok.map((r) => safeRate(r.rejectCount, r.rowCount + r.rejectCount));
  const rate4xx = ok.map((r) => safeRate(r.http4xxCount, totalHits(r)));
  const rate5xx = ok.map((r) => safeRate(r.http5xxCount, totalHits(r)));
  const durations = ok.map((r) => r.durationMs).sort((a, b) => a - b);

  return {
    sampleCount: ok.length,
    medianRowCount: median(rowCounts),
    stddevRowCount: stddev(rowCounts),
    medianRejectRate: median(rejectRates),
    median4xxRate: median(rate4xx),
    median5xxRate: median(rate5xx),
    p95DurationMs: percentile(durations, 0.95),
  };
}

/**
 * Evaluate the most recent run against baseline + registry config.
 *
 * `bootstrapping=true` downgrades row-count + reject-rate signals to digest-only
 * (they remain in the result with tier=P2 but the orchestrator skips auto-pause).
 * HTTP/CF/freshness signals still auto-pause during bootstrapping.
 *
 * If `lastSuccessAt` is older than 2× `expectedIntervalMs`, freshness P1 fires
 * regardless of the current run (the run might not have been observed yet).
 */
export function evaluateRun(
  run: RunSnapshot,
  baseline: Baseline | null,
  expectedIntervalMs: number | null,
  lastSuccessAt: Date | null,
  now: Date,
): EvalResult {
  const signals: Signal[] = [];

  // ---- Freshness (independent of run; can fire on missed schedules)
  if (expectedIntervalMs != null && lastSuccessAt != null) {
    const ageMs = now.getTime() - lastSuccessAt.getTime();
    if (ageMs > 2 * expectedIntervalMs) {
      signals.push({
        key: "freshness",
        tier: "P1",
        detail: `no successful run in ${Math.round(ageMs / 60_000)} min (>2× expected interval ${Math.round(expectedIntervalMs / 60_000)} min)`,
        value: ageMs,
        threshold: 2 * expectedIntervalMs,
      });
    }
  }

  // ---- Run failed outright → P1 from job status alone
  if (run.status === "failed") {
    signals.push({
      key: "run-failed",
      tier: "P1",
      detail: "BulkIngestJob status=failed",
      value: 1,
      threshold: 0,
    });
    return tieredResult(signals);
  }

  const hits = totalHits(run);
  const totalRowsAndRejects = run.rowCount + run.rejectCount;

  // ---- HTTP 5xx (absolute thresholds — origin down)
  const rate5xx = safeRate(run.http5xxCount, hits);
  if (rate5xx >= 0.20) push(signals, "http-5xx", "P1", `5xx rate ${(rate5xx * 100).toFixed(1)}%`, rate5xx, 0.20);
  else if (rate5xx >= 0.05) push(signals, "http-5xx", "P2", `5xx rate ${(rate5xx * 100).toFixed(1)}%`, rate5xx, 0.05);

  // ---- Cloudflare challenges (absolute thresholds — bot wall hitting us)
  const rateCf = safeRate(run.cfChallengeCount, hits);
  if (rateCf >= 0.10) push(signals, "cf-challenges", "P1", `CF challenge rate ${(rateCf * 100).toFixed(1)}%`, rateCf, 0.10);
  else if (rateCf >= 0.03) push(signals, "cf-challenges", "P2", `CF challenge rate ${(rateCf * 100).toFixed(1)}%`, rateCf, 0.03);

  // ---- HTTP 4xx (mixed: absolute floor + baseline ratio)
  const rate4xx = safeRate(run.http4xxCount, hits);
  if (rate4xx >= 0.10) push(signals, "http-4xx", "P1", `4xx rate ${(rate4xx * 100).toFixed(1)}%`, rate4xx, 0.10);
  else if (baseline && rate4xx >= 2 * baseline.median4xxRate + 0.01) {
    push(signals, "http-4xx", "P2", `4xx rate ${(rate4xx * 100).toFixed(1)}% vs baseline ${(baseline.median4xxRate * 100).toFixed(1)}%`, rate4xx, 2 * baseline.median4xxRate + 0.01);
  }

  // ---- Schema drift (single absolute threshold)
  if (run.selectorMissRate != null && run.selectorMissRate > 0.20) {
    push(signals, "schema-drift", "P1", `${(run.selectorMissRate * 100).toFixed(0)}% of selectors returned 0 results`, run.selectorMissRate, 0.20);
  }

  // ---- Reject rate (baseline ratio + absolute floor for P1)
  const rejectRate = safeRate(run.rejectCount, totalRowsAndRejects);
  if (rejectRate > 0.20) {
    push(signals, "reject-rate", "P1", `reject rate ${(rejectRate * 100).toFixed(1)}% (absolute floor)`, rejectRate, 0.20);
  } else if (baseline && rejectRate > 5 * baseline.medianRejectRate && rejectRate > 0.02) {
    push(signals, "reject-rate", "P1", `reject rate ${(rejectRate * 100).toFixed(1)}% vs baseline ${(baseline.medianRejectRate * 100).toFixed(1)}%`, rejectRate, 5 * baseline.medianRejectRate);
  } else if (baseline && rejectRate > 2 * baseline.medianRejectRate && rejectRate > 0.01) {
    push(signals, "reject-rate", "P2", `reject rate ${(rejectRate * 100).toFixed(1)}% vs baseline ${(baseline.medianRejectRate * 100).toFixed(1)}%`, rejectRate, 2 * baseline.medianRejectRate);
  }

  // ---- Row count (ratio + z-score when ≥10 samples)
  if (baseline) {
    const ratio = baseline.medianRowCount > 0 ? run.rowCount / baseline.medianRowCount : 1;
    if (ratio < 0.4) {
      push(signals, "row-count", "P1", `rowCount ${run.rowCount} is ${(ratio * 100).toFixed(0)}% of median ${baseline.medianRowCount}`, ratio, 0.4);
    } else if (ratio < 0.6) {
      push(signals, "row-count", "P2", `rowCount ${run.rowCount} is ${(ratio * 100).toFixed(0)}% of median ${baseline.medianRowCount}`, ratio, 0.6);
    }
    if (baseline.sampleCount >= MIN_SAMPLES_FOR_ZSCORE && baseline.stddevRowCount > 0) {
      const z = (baseline.medianRowCount - run.rowCount) / baseline.stddevRowCount;
      if (z >= 4) push(signals, "row-count-z", "P1", `z-score ${z.toFixed(2)} vs median ${baseline.medianRowCount}±${baseline.stddevRowCount.toFixed(0)}`, z, 4);
      else if (z >= 2.5) push(signals, "row-count-z", "P2", `z-score ${z.toFixed(2)} vs median ${baseline.medianRowCount}±${baseline.stddevRowCount.toFixed(0)}`, z, 2.5);
    }
  }

  // ---- Duration drift
  if (baseline && baseline.p95DurationMs > 0 && run.durationMs > 3 * baseline.p95DurationMs) {
    push(signals, "duration", "P2", `${run.durationMs}ms vs 3× p95 ${baseline.p95DurationMs}ms`, run.durationMs, 3 * baseline.p95DurationMs);
  }

  return tieredResult(signals);
}

/**
 * The required number of successful runs before bootstrapping=false can be set.
 * Cadence-aware so monthly sources don't wait 4 months.
 */
export function requiredBootstrapRuns(expectedIntervalMs: number | null): number {
  if (!expectedIntervalMs || expectedIntervalMs <= 0) return 4;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Math.max(4, Math.ceil(thirtyDays / expectedIntervalMs));
}

/**
 * Compute expected ms between two consecutive cron firings (interval). Returns
 * null on invalid cronExpr.
 */
export function expectedIntervalMs(
  cronExpr: string,
  timezone: string = "America/New_York",
): number | null {
  try {
    const it = parseExpression(cronExpr, { tz: timezone });
    const a = it.next().getTime();
    const b = it.next().getTime();
    return b - a;
  } catch {
    return null;
  }
}

/**
 * Signals that should NOT auto-pause during bootstrapping (only digest log).
 * HTTP/CF/freshness are always actionable.
 */
export function isSuppressedDuringBootstrapping(signalKey: string): boolean {
  return signalKey === "row-count" || signalKey === "row-count-z" || signalKey === "reject-rate" || signalKey === "duration";
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function tieredResult(signals: Signal[]): EvalResult {
  if (signals.some((s) => s.tier === "P1")) return { tier: "P1", signals };
  if (signals.some((s) => s.tier === "P2")) return { tier: "P2", signals };
  return { tier: "OK", signals: [] };
}

function push(arr: Signal[], key: string, tier: "P1" | "P2", detail: string, value: number, threshold: number) {
  arr.push({ key, tier, detail, value, threshold });
}

function totalHits(r: RunSnapshot): number {
  return r.http4xxCount + r.http5xxCount + Math.max(1, r.rowCount); // dummy floor avoids div-by-zero
}

function safeRate(num: number, denom: number): number {
  if (!denom || denom <= 0) return 0;
  return num / denom;
}

function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const m = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 ? sortedAsc[m] : (sortedAsc[m - 1] + sortedAsc[m]) / 2;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}
