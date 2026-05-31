import type { ScraperAdapter } from "./types";
import { runBrowardTaxDelinquent } from "./broward-tax-delinquent";
import { runDuvalClerk } from "./duval-clerk-recordings";
import { runDuvalTaxDelinquent } from "./duval-tax-delinquent";
import { runHillsboroughTaxDelinquent } from "./hillsborough-tax-delinquent";
import { runMiamiDadeTaxDelinquent } from "./miami-dade-tax-delinquent";
import { runOrangeTaxDelinquent } from "./orange-tax-delinquent";
import { runPalmBeachTaxDelinquent } from "./palm-beach-tax-delinquent";
import { runRealAuction } from "./realauction-fl-foreclosures";
import { ingestFlDorStatewide } from "./fl-dor-statewide-nal-sdf";

// ---------------------------------------------------------------------------
// Adapter dispatch map — keyed by ScrapeRegistry.sourceKey.
//
// Each entry wraps the existing scraper in lib/scrapers/vendors/<name>.ts
// (or lib/data-sources/bulk/<name>.ts for FL DOR) and projects its
// idiosyncratic result shape into the unified RunResult.
//
// See docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Adapter layer".
// ---------------------------------------------------------------------------

export const DISPATCH: Record<string, ScraperAdapter> = {
  "fl-dor-statewide-nal-sdf":    ingestFlDorStatewide,   // Phase 2 = no-op stub; Phase 4 = HEAD-check + ingest
  "duval-clerk-recordings":      runDuvalClerk,           // incremental-date (cursor = last scraped ISO day)
  "realauction-fl-foreclosures": runRealAuction,          // sequential enumerate 16 counties × tracks
  "duval-tax-delinquent":        runDuvalTaxDelinquent,
  "hillsborough-tax-delinquent": runHillsboroughTaxDelinquent, // Phase 4 swaps HTML walk for CSV export
  "orange-tax-delinquent":       runOrangeTaxDelinquent,  // seasonal: April-July only (registry-enforced)
  "broward-tax-delinquent":      runBrowardTaxDelinquent,
  "miami-dade-tax-delinquent":   runMiamiDadeTaxDelinquent, // Phase 4 adds HEAD-check on PDF Last-Modified
  "palm-beach-tax-delinquent":   runPalmBeachTaxDelinquent, // incremental-date via FPN date-range params
};

export function resolveAdapter(sourceKey: string): ScraperAdapter | null {
  return DISPATCH[sourceKey] ?? null;
}

/** Sources the dispatch map has adapters for (Phase 1 = none, growing in Phase 2). */
export function registeredSourceKeys(): string[] {
  return Object.keys(DISPATCH);
}
