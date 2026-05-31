import type { RunStats, RunStatsCollector } from "./types";

// ---------------------------------------------------------------------------
// Pure in-process counter for one adapter run. Adapters call recordX() during
// the scrape; the runner calls snapshot() at the end to populate the
// BulkIngestJob audit row's run-stats columns (see schema.prisma extensions
// in Phase 0).
// ---------------------------------------------------------------------------

export function createRunStatsCollector(): RunStatsCollector {
  let http4xx = 0;
  let http5xx = 0;
  let cfChallenges = 0;
  let selectorMisses = 0;
  let selectorChecks = 0;
  let politenessFailOpen = 0;
  const errors: string[] = [];

  return {
    recordHttp4xx() {
      http4xx++;
    },
    recordHttp5xx() {
      http5xx++;
    },
    recordCfChallenge() {
      cfChallenges++;
    },
    recordSelectorCheck(missed: boolean) {
      selectorChecks++;
      if (missed) selectorMisses++;
    },
    recordPolitenessFailOpen() {
      politenessFailOpen++;
    },
    recordError(err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Cap at 20 errors per run to avoid unbounded growth on cascading failures.
      if (errors.length < 20) errors.push(msg);
    },
    snapshot(): RunStats {
      return {
        http4xxCount: http4xx,
        http5xxCount: http5xx,
        cfChallengeCount: cfChallenges,
        selectorMissRate:
          selectorChecks > 0 ? selectorMisses / selectorChecks : null,
        politenessFailOpenCount: politenessFailOpen,
        errors: [...errors],
      };
    },
  };
}
