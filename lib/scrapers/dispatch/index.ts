import type { ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter dispatch map — keyed by ScrapeRegistry.sourceKey.
//
// Phase 1 ships this scaffolding with NO adapters registered yet. The worker
// boots, reads registry rows, schedules them via BullMQ JobScheduler, but
// when a job fires the worker logs "no adapter registered for <sourceKey>"
// and marks the run as failed-with-known-reason (no crash, no retry storm).
//
// Phase 2 fills this map. Each entry imports a `runFoo(ctx) → RunResult`
// function from lib/scrapers/dispatch/<sourceKey>.ts that wraps the existing
// scraper in lib/scrapers/vendors/<name>.ts.
//
// See docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Adapter layer".
// ---------------------------------------------------------------------------

export const DISPATCH: Record<string, ScraperAdapter> = {
  // Phase 2 adapters land here. Each is ~60-100 LOC, wraps the existing
  // vendor scraper, and projects its result into RunResult.
  //
  // "fl-dor-statewide-nal-sdf":   ingestFlDorStatewide,
  // "duval-clerk-recordings":     runDuvalClerk,
  // "realauction-fl-foreclosures": runRealAuction,
  // "duval-tax-delinquent":       runDuvalTaxDelinquent,
  // "hillsborough-tax-delinquent": runHillsboroughTaxDelinquent,
  // "orange-tax-delinquent":      runOrangeTaxDelinquent,
  // "broward-tax-delinquent":     runBrowardTaxDelinquent,
  // "miami-dade-tax-delinquent":  runMiamiDadeTaxDelinquent,
  // "palm-beach-tax-delinquent":  runPalmBeachTaxDelinquent,
};

export function resolveAdapter(sourceKey: string): ScraperAdapter | null {
  return DISPATCH[sourceKey] ?? null;
}

/** Sources the dispatch map has adapters for (Phase 1 = none, growing in Phase 2). */
export function registeredSourceKeys(): string[] {
  return Object.keys(DISPATCH);
}
