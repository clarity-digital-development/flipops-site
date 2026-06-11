import { ONCORE_COUNTIES, scrapeOnCoreCounty } from "@/lib/scrapers/vendors/oncore-records";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: oncore-official-records (M2.1c / Lane C1)
// Wraps lib/scrapers/vendors/oncore-records.ts across the OnCore/Eagle family
// (Orange 12095 only — the lone OnCore metro). New counties are config rows.
//
// ⚠ SHIPS enabled=false-ready. Orange's OnCore doc search has migrated to
// Tyler's Self-Service SPA (selfservice.or.occompt.com/ssweb); the session mint
// is verified but the SPA search handshake is not yet replicable over plain
// HTTP (probe 2026-06-11: search routes 302→"options have changed" / POST→
// server-error GUID). The integration lane should register this source with
// enabled=false until the SPA transport (or a stealth-chromium fallback) lands.
// The adapter degrades cleanly: a blocked search returns rowCount=0 with a
// bronze RawSnapshot documenting the blocker, never throwing.
//
// Strategy: incremental-date over the RECORDING-date range (same as acclaim).
//   - first run: trailing 30 days; subsequent: from = HWM - OVERLAP_DAYS.
// Egress: per-county config in ONCORE_COUNTIES (Orange DIRECT, verified).
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_DAYS = 30;
const OVERLAP_DAYS = 3;
const BETWEEN_COUNTIES_MS = 4000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export const runOnCoreOfficialRecords: ScraperAdapter = async (
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

  let totalPersisted = 0;
  let totalRejected = 0;
  let counties = 0;
  let blocked = 0;
  const errors: Array<{ county: string; message: string }> = [];

  for (const county of ONCORE_COUNTIES) {
    counties++;
    try {
      const r = await scrapeOnCoreCounty({ countyFips: county.countyFips, from, to });
      totalPersisted += r.persistedMortgages + r.persistedLiens;
      totalRejected += r.rejected;
      if (r.outcome === "search-blocked" || r.outcome === "session-failed") blocked++;
      console.log(
        `[oncore-ori] ${r.county} ${r.from}..${r.to}: outcome=${r.outcome}${r.blocker !== "none" ? `(${r.blocker})` : ""} found=${r.found} mtg=${r.persistedMortgages} lien=${r.persistedLiens} apn(direct=${r.apnJoin.direct} name=${r.apnJoin.uniqueName})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[oncore-ori] county=${county.countyFips} failed: ${message}`);
      errors.push({ county: county.countyFips, message });
      ctx.stats.recordError(err);
    }
    await sleep(BETWEEN_COUNTIES_MS);
  }

  // Total-HARD-failure contract: only throw on real exceptions. A clean
  // "search-blocked" outcome (the current expected state for Orange) is NOT a
  // failure — it returns 0 rows with a documented blocker and keeps the HWM.
  if (totalPersisted === 0 && errors.length === counties && counties > 0) {
    throw new Error(`All ${counties} OnCore counties threw; first error: ${errors[0].message}`);
  }

  // Advance the cursor only when every county both succeeded AND wasn't blocked,
  // so a blocked window is re-attempted next run once the search transport lands.
  const cleanAdvance = errors.length === 0 && blocked === 0;

  return {
    rowCount: totalPersisted,
    rejectCount: totalRejected,
    newHighWaterMark: cleanAdvance ? isoDate(to) : ctx.lastHighWaterMark,
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
