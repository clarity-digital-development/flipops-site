import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: fl-dor-statewide-nal-sdf
// Wraps the FL DOR statewide NAL+SDF bulk ingest (lib/data-sources/bulk/fl-dor.ts).
//
// Phase 2 ships a SKIP-ONLY stub: the FL DOR roll is annual (per Phase 0
// cadence research), and a full statewide ingest is ~150 minutes. We don't
// want a fresh `worker-bullmq` to accidentally kick off a 2.5-hour job on
// its first quarterly tick.
//
// The proper "head-check on file mtime" implementation belongs in Phase 4:
//   1. HEAD-request the floridarevenue.com NAL/SDF zip URLs
//   2. Compare Last-Modified header to ctx.lastHighWaterMark
//   3. If unchanged, no-op (rowCount=0)
//   4. If changed, invoke BulkIngester to ingest all 67 counties (~150 min)
//
// For now the adapter returns a no-op with a log line so the audit row
// reflects "we checked and there's nothing to do."
// ---------------------------------------------------------------------------

export const ingestFlDorStatewide: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  console.log(
    `[fl-dor-statewide-nal-sdf] Phase 2 stub — head-check not yet implemented. ` +
      `Last successful run: ${ctx.lastRunAt?.toISOString() ?? "never"}. ` +
      `Phase 4 will add Last-Modified check + 67-county BulkIngester invocation.`,
  );
  return {
    rowCount: 0,
    rejectCount: 0,
    newHighWaterMark: ctx.lastHighWaterMark, // no advance until Phase 4
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
