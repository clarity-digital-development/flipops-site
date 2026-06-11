import { ingestHillsboroughRecords } from "@/lib/scrapers/vendors/hillsborough-records";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: hillsborough-official-records (M2.1d, Family D)
//
// FILE-INGESTER (NOT a date-search adapter — note for the integration lane's
// cadence wiring). Wraps lib/scrapers/vendors/hillsborough-records.ts, which
// ingests the FREE public bulk Official-Records index files from
// publicrec.hillsclerk.com/OfficialRecords/DailyIndexes/ (the clerk produces a
// D/P/M file set per business day; ≥2 months online at all times). 0-scrape
// win — no HOVER search, no subscription, no captcha.
//
// Strategy: incremental over the directory's available file DATES.
//   - lastHighWaterMark = YYYYMMDD of the latest vintage ingested.
//   - next run: ingest only vintages with dateKey > HWM (sinceDateKey), capped
//     at MAX_VINTAGES so a backfill doesn't blow the run budget. The stable
//     source string ("bulk:hillsborough-or") makes any overlap re-upsert
//     harmless on @@unique([countyFips, documentNumber, source]).
//   - first run (no HWM): ingest the most-recent FIRST_RUN_VINTAGES days; a
//     full 2-month backfill is a separate operator run via
//     scripts/run-hillsborough-records-local.ts --max-vintages N.
//
// Egress: DIRECT (publicrec.hillsclerk.com is a plain public IIS file server;
// verified 200 from direct egress 2026-06-11).
// ---------------------------------------------------------------------------

const FIRST_RUN_VINTAGES = 10; // ~2 weeks of files on a cold start
const MAX_VINTAGES = 30; // per-run cap on incremental catch-up

export const runHillsboroughOfficialRecords: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  const sinceDateKey = ctx.lastHighWaterMark ?? undefined;
  const maxVintages = ctx.lastHighWaterMark ? MAX_VINTAGES : FIRST_RUN_VINTAGES;

  let rowCount = 0;
  let latest: string | null = ctx.lastHighWaterMark;

  try {
    const { vintages, latestDateKey } = await ingestHillsboroughRecords({
      sinceDateKey,
      maxVintages,
      useProxy: false,
    });
    for (const v of vintages) {
      rowCount += v.persistedMortgages + v.persistedLiens + v.satisfactionsApplied;
      // Advance HWM to the newest vintage actually ingested.
      if (!latest || v.dateKey > latest) latest = v.dateKey;
    }
    // If nothing new was ingested but the directory has a newer floor, keep the
    // existing HWM (don't skip a date we never processed).
    console.log(
      `[hills-or] ingested ${vintages.length} vintage(s); rows=${rowCount}; dir-latest=${latestDateKey}; new HWM=${latest}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[hills-or] run failed: ${message}`);
    ctx.stats.recordError(err);
    throw new Error(`Hillsborough OR ingest failed: ${message}`);
  }

  return {
    rowCount,
    rejectCount: 0,
    newHighWaterMark: latest,
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
