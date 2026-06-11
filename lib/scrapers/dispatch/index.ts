import type { ScraperAdapter } from "./types";
import { runAcclaimOfficialRecords } from "./acclaim-official-records";
import { runBrowardTaxDelinquent } from "./broward-tax-delinquent";
import { runLandmarkOfficialRecords } from "./landmark-official-records";
import { runDuvalClerk } from "./duval-clerk-recordings";
import { runDuvalTaxDelinquent } from "./duval-tax-delinquent";
import { runHillsboroughOfficialRecords } from "./hillsborough-official-records";
import { runHillsboroughTaxDelinquent } from "./hillsborough-tax-delinquent";
import { runMiamiDadeOfficialRecords } from "./miamidade-official-records";
import { runMiamiDadeTaxDelinquent } from "./miami-dade-tax-delinquent";
import { runOnCoreOfficialRecords } from "./oncore-official-records";
import { runOrangeTaxDelinquent } from "./orange-tax-delinquent";
import { runPalmBeachTaxDelinquent } from "./palm-beach-tax-delinquent";
import { runRealAuction } from "./realauction-fl-foreclosures";
import { runRealTaxDeedFl } from "./realtaxdeed-fl-tax-deeds";
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
  "landmark-official-records":   runLandmarkOfficialRecords, // LANDMARK family: PB+Lee+Levy ORI (incremental-date)
  "duval-clerk-recordings":      runDuvalClerk,           // incremental-date (cursor = last scraped ISO day)
  "realauction-fl-foreclosures": runRealAuction,          // sequential enumerate 16 counties × tracks
  "realtaxdeed-fl-tax-deeds":    runRealTaxDeedFl,        // calendar-first enumerate 29 realtaxdeed counties (M2.2)
  "acclaim-official-records":    runAcclaimOfficialRecords, // ACCLAIM family: Duval+Broward ORI mortgages/liens (M2.1a)
  "oncore-official-records":     runOnCoreOfficialRecords,  // OnCore/Eagle family: Orange ORI (M2.1c — enabled=false until SPA search transport lands)
  "miamidade-official-records":  runMiamiDadeOfficialRecords, // Miami-Dade bespoke SPA+JSON-API ORI (M2.1d, reCAPTCHA v3 gate)
  "hillsborough-official-records": runHillsboroughOfficialRecords, // Hillsborough FREE bulk index-file ingester (M2.1d, 0-scrape)
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
