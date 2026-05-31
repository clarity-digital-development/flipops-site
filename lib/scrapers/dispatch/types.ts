import type { ScrapeRegistry } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared types for the freshness-layer adapter contract.
//
// Each scraper adapter (in lib/scrapers/dispatch/<name>.ts) implements
//   (ctx: RunContext) => Promise<RunResult>
// wrapping the existing scraper function from lib/scrapers/vendors/<name>.ts.
//
// The worker-bullmq runner constructs RunContext from the ScrapeRegistry row +
// the current job's state, calls the adapter, and persists RunResult to a
// BulkIngestJob audit row.
// ---------------------------------------------------------------------------

/** Per-run context passed to every adapter. */
export interface RunContext {
  /** Stable identifier for this scrape source (matches ScrapeRegistry.sourceKey). */
  sourceKey: string;
  /** Unique run identifier (BulkIngestJob.id). */
  runId: string;
  /** When the previous successful run started (null on first run). */
  lastRunAt: Date | null;
  /** Cursor from the last successful run (null on first run / strategy=full). */
  lastHighWaterMark: string | null;
  /** Registry row snapshot at boot time. */
  registry: Pick<
    ScrapeRegistry,
    | "sourceKey"
    | "domain"
    | "countyFips"
    | "state"
    | "strategy"
    | "rateLimitMs"
    | "proxyMode"
    | "legalRisk"
    | "bootstrapping"
  >;
  /** Optional in-process run-stats collector (lib/scrapers/dispatch/run-stats.ts). */
  stats: RunStatsCollector;
}

/** Counters + samples emitted by an adapter and surfaced to health-check. */
export interface RunStats {
  http4xxCount: number;
  http5xxCount: number;
  cfChallengeCount: number;
  /** Sum of (selectorMisses) / (selectorChecks). null if no selectors used. */
  selectorMissRate: number | null;
  /** Atomic Redis-politeness fail-open events (politeness Redis was unreachable). */
  politenessFailOpenCount: number;
  /** Free-form error messages worth surfacing on the audit row. */
  errors: string[];
}

export interface RunResult {
  /** Total persisted rows (not parsed; PERSISTED — the data that landed in DB). */
  rowCount: number;
  /** Records rejected by hallucination guards. */
  rejectCount: number;
  /** New cursor to stamp on ScrapeRegistry.lastHighWaterMark; null = no advance. */
  newHighWaterMark: string | null;
  /** Run statistics emitted during execution. */
  stats: RunStats;
  /** Wall-clock duration measured by the adapter (the runner also measures). */
  durationMs: number;
}

export type ScraperAdapter = (ctx: RunContext) => Promise<RunResult>;

// Forward-declared to break the circular ref with run-stats.ts.
export interface RunStatsCollector {
  recordHttp4xx(): void;
  recordHttp5xx(): void;
  recordCfChallenge(): void;
  recordSelectorCheck(missed: boolean): void;
  recordPolitenessFailOpen(): void;
  recordError(err: unknown): void;
  snapshot(): RunStats;
}
