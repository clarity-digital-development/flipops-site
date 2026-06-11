import {
  LANDMARK_COUNTIES,
  mintLandmarkSession,
  searchLandmarkByRecordDate,
  type LandmarkScrapeResult,
} from "@/lib/scrapers/vendors/landmark-records";
import { getCaptchaSolver } from "@/lib/scrapers/base/captcha-solver";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: landmark-official-records
// Wraps lib/scrapers/vendors/landmark-records.ts for the LANDMARK family
// (Palm Beach + Lee + Levy). Sister adapter to duval-clerk-recordings (Acclaim).
//
// Strategy: incremental-date. One target day per run, swept across ALL Landmark
// counties (begin=end=target). Cursor protocol identical to Duval:
//   - lastHighWaterMark = ISO date of the last scraped day
//   - first run = today-5 (catch late-posted recordings)
//   - advance only when at least one county returned a usable (non-blocked,
//     non-captcha) outcome, so a captcha wall doesn't silently burn dates.
//
// reCAPTCHA reality (verified 2026-06-10): PB + Levy gate search behind
// reCAPTCHA v2. Until a token source (recaptchaToken / solveRecaptcha hook) is
// wired via env, runs persist 0 rows and report outcome=captcha-required per
// county. The adapter records this cleanly rather than throwing. Lee uses the
// residential proxy (datacenter-direct times out) but Cloudflare may still 403.
//
// A solver hook is read from env at call time so production can flip it on
// without a code change:
//   LANDMARK_RECAPTCHA_TOKEN  — a single pre-solved token (manual/admin runs)
// (A streaming solver service would be injected here too; left as a TODO so
//  this lane ships without taking a dependency the repo doesn't yet have.)
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDateAfter(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const runLandmarkOfficialRecords: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  // Compute target date.
  let target: Date;
  if (ctx.lastHighWaterMark) {
    target = nextDateAfter(ctx.lastHighWaterMark);
  } else {
    target = new Date();
    target.setUTCDate(target.getUTCDate() - 5);
  }

  // Don't scrape "today" — clerks post with a lag.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (target > yesterday) {
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: ctx.lastHighWaterMark,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  const recaptchaToken = process.env.LANDMARK_RECAPTCHA_TOKEN || undefined;
  // Streaming solver (2captcha-class) when TWOCAPTCHA_API_KEY is configured;
  // undefined otherwise → vendor reports captcha-required and persists 0.
  const solveRecaptcha = getCaptchaSolver();

  let persisted = 0;
  let anyUsable = false;

  for (const county of LANDMARK_COUNTIES) {
    try {
      const sess = await mintLandmarkSession(county);
      if (!sess) {
        ctx.stats.recordError(new Error(`landmark ${county.county}: session mint failed (egress block)`));
        continue;
      }
      const res: LandmarkScrapeResult = await searchLandmarkByRecordDate(
        sess,
        county,
        target,
        target,
        { recaptchaToken, solveRecaptcha },
      );
      persisted += res.persistedMortgages + res.persistedLiens;
      if (res.outcome === "ok" || res.outcome === "empty") anyUsable = true;
      if (res.outcome === "captcha-required") {
        ctx.stats.recordCfChallenge();
        ctx.stats.recordError(new Error(`landmark ${county.county}: reCAPTCHA required (no token)`));
      } else if (res.outcome === "session-expired" || res.outcome === "blocked") {
        ctx.stats.recordError(new Error(`landmark ${county.county}: ${res.outcome}`));
      }
    } catch (err) {
      ctx.stats.recordError(err);
    }
  }

  return {
    rowCount: persisted,
    rejectCount: 0,
    // Advance the cursor only when at least one county actually completed a
    // search (avoids burning through dates while the captcha wall is up).
    newHighWaterMark: anyUsable ? isoDate(target) : ctx.lastHighWaterMark,
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
