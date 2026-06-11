import {
  scrapeMiamiDadeCounty,
  type MdTokenSource,
} from "@/lib/scrapers/vendors/miamidade-records";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: miamidade-official-records (M2.1d — Family D bespoke)
// Wraps lib/scrapers/vendors/miamidade-records.ts (Miami-Dade 12086 only).
//
// Strategy: incremental-date over the RECORDING-date range (mirrors the
// Acclaim/Landmark adapters).
//   - lastHighWaterMark = ISO date the prior window ran THROUGH (`to`)
//   - next run: from = HWM - OVERLAP_DAYS (clerks post with lag; the stable
//     source key makes the overlap re-upsert harmless), to = today
//   - first run: trailing 30 days (deeper backfill via scripts/run-miamidade-local.ts)
//
// reCAPTCHA v3 GATE: standardsearch requires a valid `x-recaptcha-token`. The
// adapter self-mints one via stealth-chromium grecaptcha.execute (default
// path), which only succeeds where the egress can load the SPA — verify on
// Railway. A token source can be injected via env (MIAMIDADE_RECAPTCHA_TOKEN
// one-shot, or a solver wired by the operator) for the cheaper http path.
//
// Egress: direct (NetScaler blocks the residential proxy pool; the headless
// chromium TLS is dropped from datacenter egress on this dev machine — Railway
// egress is a different IP class and is the place to confirm the browser path).
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_DAYS = 30;
const OVERLAP_DAYS = 3;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const runMiamiDadeOfficialRecords: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  const to = new Date();
  let from: Date;
  if (ctx.lastHighWaterMark) {
    from = new Date(`${ctx.lastHighWaterMark}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - OVERLAP_DAYS);
  } else {
    from = new Date();
    from.setUTCDate(from.getUTCDate() - DEFAULT_WINDOW_DAYS);
  }

  // Optional injected one-shot token (operator-supplied); else self-mint via
  // the stealth-chromium grecaptcha path.
  const tokenSource: MdTokenSource = {};
  if (process.env.MIAMIDADE_RECAPTCHA_TOKEN) {
    tokenSource.recaptchaToken = process.env.MIAMIDADE_RECAPTCHA_TOKEN;
  }

  try {
    const r = await scrapeMiamiDadeCounty({ from, to, tokenSource });
    const persisted =
      r.persistedMortgages + r.persistedLiens + r.satisfactionsApplied;

    console.log(
      `[miamidade-ori] ${r.from}..${r.to}: outcome=${r.outcome} found=${r.found} mtg=${r.persistedMortgages} lien=${r.persistedLiens} sat=${r.satisfactionsApplied} apn(folio=${r.apnJoin.directFolio} name=${r.apnJoin.uniqueName})`,
    );

    // The reCAPTCHA gate is a real blocker, not a silent success — surface it
    // on the audit row so health-check sees WHY a run produced 0 rows.
    if (persisted === 0 && r.outcome === "captcha-required") {
      ctx.stats.recordError(
        new Error(
          "Miami-Dade standardsearch rejected the reCAPTCHA v3 token (no valid token minted). Configure MIAMIDADE_RECAPTCHA_TOKEN/solver or run from egress that can load the SPA.",
        ),
      );
    }
    if (persisted === 0 && r.outcome === "blocked") {
      ctx.stats.recordError(
        new Error("Miami-Dade portal blocked the request (HTTP 4xx/5xx or NetScaler drop)."),
      );
    }

    return {
      rowCount: persisted,
      rejectCount: r.rejected,
      // Only advance the cursor on a genuinely successful sweep — keep the old
      // HWM when gated/blocked so the window is retried next run.
      newHighWaterMark: r.outcome === "ok" ? isoDate(to) : ctx.lastHighWaterMark,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[miamidade-ori] failed: ${message}`);
    ctx.stats.recordError(err);
    throw new Error(`Miami-Dade official-records run failed: ${message}`);
  }
};
