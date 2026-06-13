import {
  PROBATE_MVC_COUNTIES,
  mintProbateSession,
  searchProbateByDateRange,
  type ProbateScrapeResult,
} from "@/lib/scrapers/vendors/probate-mvc";
import { getCaptchaSolver } from "@/lib/scrapers/base/captcha-solver";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: probate-official-records
// Wraps lib/scrapers/vendors/probate-mvc.ts for the P-MVC family (Orange +
// Broward — Pinellas now served free by pinellas-probate-csv). Sister adapter
// to landmark-official-records (records family) — same incremental-date cursor
// + reCAPTCHA-gated persistence shape.
//
// Strategy: incremental-date. One target day per run, swept across both
// P-MVC counties (begin=end=target). Cursor protocol:
//   - lastHighWaterMark = ISO date of the last scraped day
//   - first run = today-7 (probate filings post with a multi-day lag)
//   - advance only when at least one county returned a usable (non-blocked,
//     non-captcha) outcome, so a captcha wall doesn't silently burn dates.
//
// reCAPTCHA reality (PROBATE-BUILD-SPEC §2-3): all three P-MVC portals gate the
// SEARCH SUBMIT behind reCAPTCHA v2 (the form/case-type INDEX is listable, only
// the submit needs a token). Until a token source is wired the run persists 0
// and reports outcome=captcha-required per county — recorded cleanly, never
// thrown. Token sources, read from env at call time so production flips on with
// no code change:
//   PROBATE_RECAPTCHA_TOKEN — a single pre-solved token (manual/admin runs)
//   TWOCAPTCHA_API_KEY      — streaming 2captcha-class solver (getCaptchaSolver)
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDateAfter(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const runProbateOfficialRecords: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  // Compute target date.
  let target: Date;
  if (ctx.lastHighWaterMark) {
    target = nextDateAfter(ctx.lastHighWaterMark);
  } else {
    target = new Date();
    target.setUTCDate(target.getUTCDate() - 7);
  }

  // Don't scrape "today" — clerks post probate filings with a lag.
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

  const recaptchaToken = process.env.PROBATE_RECAPTCHA_TOKEN || undefined;
  // Streaming solver (2captcha-class) when TWOCAPTCHA_API_KEY is configured;
  // undefined otherwise → vendor reports captcha-required and persists 0.
  const solveRecaptcha = getCaptchaSolver();

  let persisted = 0;
  let anyUsable = false;

  for (const county of PROBATE_MVC_COUNTIES) {
    try {
      const sess = await mintProbateSession(county);
      if (!sess) {
        ctx.stats.recordError(new Error(`probate ${county.county}: session mint failed (egress block)`));
        continue;
      }
      const res: ProbateScrapeResult = await searchProbateByDateRange(
        sess,
        county,
        target,
        target,
        { recaptchaToken, solveRecaptcha },
      );
      persisted += res.persisted;
      if (res.outcome === "ok" || res.outcome === "empty") anyUsable = true;
      if (res.outcome === "captcha-required") {
        ctx.stats.recordCfChallenge();
        ctx.stats.recordError(new Error(`probate ${county.county}: reCAPTCHA required (no token)`));
      } else if (res.outcome === "session-expired" || res.outcome === "blocked") {
        ctx.stats.recordError(new Error(`probate ${county.county}: ${res.outcome}`));
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
