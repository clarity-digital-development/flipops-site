import {
  CODE_ENFORCEMENT_SOURCES,
  resolveApns,
  persistViolations,
} from "@/lib/data-sources/code-enforcement";
import { refreshCodeViolationSummary } from "@/scripts/rescore-code-violations";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: code-enforcement (M3.2)
//
// Daily/weekly open-data refresh of code-enforcement violations across the
// registered open-data sources (Miami-Dade ArcGIS + Orlando Socrata). For each
// source it runs the full ingest pipeline:
//   source.fetch(openOnly) → resolveApns (Tier-1 folio + Tier-2 address)
//   → persistViolations (typed upsert) → refreshCodeViolationSummary(county)
//
// 100% GREEN open data — both sources fetch with useProxy:false (direct
// egress) inside their adapters. No proxy, no captcha. Polite pacing
// (rateLimitMs:1000) lives in the source fetch loops.
//
// rowCount aggregates persisted rows across all sources. The summary mart is
// rebuilt per-county after each source persists so the scorer's
// CONDITION_FAMILY signals see fresh openCount/hasLien immediately.
//
// Exposed source slugs are taken from CODE_ENFORCEMENT_SOURCES so adding a new
// city (e.g. a future Accela adapter) needs no change here.
// ---------------------------------------------------------------------------

const SOURCE_SLUGS = Object.keys(CODE_ENFORCEMENT_SOURCES);

export const runCodeEnforcement: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  let totalPersisted = 0;
  const countiesTouched = new Set<string>();

  for (const slug of SOURCE_SLUGS) {
    const src = CODE_ENFORCEMENT_SOURCES[slug];
    try {
      // Open-only — we only score live distress; closed cases carry no signal.
      const rows = await src.fetch({ openOnly: true });
      if (rows.length === 0) {
        console.log(`[code-enforcement] ${slug}: no rows`);
        continue;
      }
      const { resolved, stats } = await resolveApns(rows);
      const pstats = await persistViolations(resolved);
      totalPersisted += pstats.written;
      countiesTouched.add(src.countyFips);

      const linked = stats.directFolio + stats.uniqueAddress;
      const joinPct = stats.total ? ((100 * linked) / stats.total).toFixed(1) : "0.0";
      console.log(
        `[code-enforcement] ${slug} (${src.city}/${src.countyFips}): ` +
          `persisted ${pstats.written}/${rows.length} · join ${linked}/${stats.total} = ${joinPct}% ` +
          `(folio ${stats.directFolio} · addr ${stats.uniqueAddress})`,
      );
    } catch (err) {
      // One source failing must not abort the others — record + continue.
      ctx.stats.recordError(err);
      console.error(`[code-enforcement] ${slug} failed:`, err);
    }
  }

  // Refresh the per-parcel summary mart for every county we touched so the
  // scorer's CONDITION_FAMILY signals + UNION ranking pick up new violations.
  for (const countyFips of countiesTouched) {
    try {
      const r = await refreshCodeViolationSummary({ countyFips });
      console.log(
        `[code-enforcement] rescore ${countyFips}: ${r.rowsAffected} summary rows in ${(r.durationMs / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      ctx.stats.recordError(err);
      console.error(`[code-enforcement] rescore ${countyFips} failed:`, err);
    }
  }

  return {
    rowCount: totalPersisted,
    rejectCount: 0,
    // Stamp the run date as the high-water mark (open-data feeds are full
    // re-fetches; the mark is informational for the audit row).
    newHighWaterMark: new Date().toISOString().slice(0, 10),
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
