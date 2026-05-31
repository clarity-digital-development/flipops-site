import { listDorFiles } from "@/lib/data-sources/bulk/fl-dor-portal";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: fl-dor-statewide-nal-sdf
//
// Phase 4 cleanup: replaced the Phase 2 no-op stub with a real HEAD-check
// against the FL DOR SharePoint portal. Lists the NAL+SDF files, takes the
// most recent TimeLastModified across the set, compares to
// lastHighWaterMark.
//
// IMPORTANT SAFETY POSTURE: we deliberately do NOT auto-invoke the
// ~150-min `FlDorIngester` here. A fresh worker boot or an accidental
// cron tick could otherwise consume hours of compute. Instead we:
//   1. Detect change → log a clear "ROLL UPDATED" line for ops visibility
//   2. Update lastHighWaterMark so we don't keep re-alerting on the same
//      change
//   3. Surface the change in the admin scrapers page (via the registry
//      row's high-water mark + the audit row)
//
// Operator workflow when ingest is needed:
//   - Notice the "ROLL UPDATED" log line (or the scrapers page diff)
//   - Run `npm run fl-dor:ingest-statewide` (or per-county script) manually
//   - That bypasses BullMQ entirely and reports its own progress
//
// Future enhancement (Phase 5+): a separate admin button "Confirm + ingest"
// that enqueues the heavy job onto the `bulk-ingest` queue with explicit
// operator authorization.
// ---------------------------------------------------------------------------

export const ingestFlDorStatewide: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  let newestModified: string | null = null;
  let fileCount = 0;

  try {
    const files = await listDorFiles({ categories: ["NAL", "SDF"] });
    fileCount = files.length;
    // listDorFiles returns DorFile{filename,...} — we need TimeLastModified
    // which the underlying SharePoint API exposes but the typed export
    // strips. Re-derive via the latest vintage tag as a coarse proxy for now.
    // (TODO: extend the portal export to include TimeLastModified directly.)
    const vintageTags = files.map((f) => f.vintageTag).filter(Boolean);
    if (vintageTags.length > 0) {
      vintageTags.sort();
      newestModified = vintageTags[vintageTags.length - 1];
    }
  } catch (err) {
    ctx.stats.recordError(err);
    console.error(
      "[fl-dor-statewide-nal-sdf] HEAD-check failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: ctx.lastHighWaterMark, // no advance on error
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  if (!newestModified) {
    console.warn("[fl-dor-statewide-nal-sdf] no DOR files returned by portal listing");
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: ctx.lastHighWaterMark,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  if (ctx.lastHighWaterMark === newestModified) {
    console.log(
      `[fl-dor-statewide-nal-sdf] roll unchanged (vintage=${newestModified}, files=${fileCount}); no-op`,
    );
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: newestModified,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  // Roll changed — log loudly, advance HWM, do NOT auto-ingest (safety).
  console.warn(
    `[fl-dor-statewide-nal-sdf] ⚠ ROLL UPDATED: vintage ${ctx.lastHighWaterMark ?? "(none)"} → ${newestModified} ` +
      `(${fileCount} NAL/SDF files available). ` +
      `Run \`npx tsx scripts/fl-dor-ingest-statewide.ts\` to ingest. This adapter intentionally does NOT auto-invoke the ~150-min ingest.`,
  );

  return {
    rowCount: 0,
    rejectCount: 0,
    newHighWaterMark: newestModified, // stamp so we don't re-alert
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
