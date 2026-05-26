// ---------------------------------------------------------------------------
// Per-county distress source config for the clerk + tax-collector enrichers.
// These are the URLs the live-distress Firecrawl enrichers point at. Wired
// per county as we verify them; an unconfigured county degrades gracefully
// (enricher returns null, orchestrator continues with what it has).
//
// Duval verified sources (2026-05): the Clerk Official Records search + the
// Tax Collector delinquent real-estate notices.
// ---------------------------------------------------------------------------

export interface DistressSources {
  /** Clerk Official Records search (lis pendens / liens). */
  clerkRecordsUrl?: string;
  /** How the clerk search is parameterized (by owner name vs address). */
  clerkSearchBy?: "owner_name" | "address";
  /** Tax Collector / certificate-sale delinquency list or per-parcel page. */
  taxDelinquencyUrl?: string;
}

export const DISTRESS_SOURCES: Record<string, DistressSources> = {
  // Duval FL (FIPS 12031)
  "12031": {
    clerkRecordsUrl: "https://or.duvalclerk.com/",
    clerkSearchBy: "owner_name",
    // Duval delinquent real-estate tax notices (public legal notices)
    taxDelinquencyUrl: "https://legals.jaxdailyrecord.com/re_tax/retax_search.php",
  },
};

export function distressSourcesFor(countyFips: string): DistressSources | null {
  return DISTRESS_SOURCES[countyFips] ?? null;
}
