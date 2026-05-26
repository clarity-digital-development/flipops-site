// ---------------------------------------------------------------------------
// ZIP → county FIPS resolver.
//
// When a user searches a ZIP on the Leads map, we need to know which county
// scraper to invoke. This maps ZIP codes to the 5-digit county FIPS code that
// `SCRAPER_FACTORIES` (in ./index.ts) is keyed on.
//
// Seeded with the FL demo markets for now. The full national crosswalk
// (~41k ZIPs → ~3,100 counties) comes from the HUD USPS ZIP-COUNTY crosswalk
// file — load it into a `ZipCountyCrosswalk` table in Phase 2B rather than
// hardcoding. For beta, the markets users actually operate in are enough.
// ---------------------------------------------------------------------------

export interface CountyRef {
  fips: string;
  county: string;
  state: string;
}

// FIPS reference for FL demo-market counties. A single ZIP can technically
// span two counties; we map to the dominant county.
const FL_COUNTIES: Record<string, CountyRef> = {
  duval: { fips: "12031", county: "Duval", state: "FL" },
  orange: { fips: "12095", county: "Orange", state: "FL" },
  hillsborough: { fips: "12057", county: "Hillsborough", state: "FL" },
  miamidade: { fips: "12086", county: "Miami-Dade", state: "FL" },
  pinellas: { fips: "12103", county: "Pinellas", state: "FL" },
  broward: { fips: "12011", county: "Broward", state: "FL" },
  alachua: { fips: "12001", county: "Alachua", state: "FL" },
  leon: { fips: "12073", county: "Leon", state: "FL" },
  escambia: { fips: "12033", county: "Escambia", state: "FL" },
  collier: { fips: "12021", county: "Collier", state: "FL" },
  sarasota: { fips: "12115", county: "Sarasota", state: "FL" },
  palmbeach: { fips: "12099", county: "Palm Beach", state: "FL" },
  volusia: { fips: "12127", county: "Volusia", state: "FL" },
  marion: { fips: "12083", county: "Marion", state: "FL" },
};

// ZIP prefixes → county. Maps the demo-data ZIPs (seed-data.ts) to their county.
const ZIP_TO_COUNTY: Record<string, CountyRef> = {
  // Jacksonville / Duval
  "32099": FL_COUNTIES.duval,
  "32202": FL_COUNTIES.duval,
  "32205": FL_COUNTIES.duval,
  "32208": FL_COUNTIES.duval,
  "32210": FL_COUNTIES.duval,
  "32218": FL_COUNTIES.duval,
  // Orlando / Orange
  "32801": FL_COUNTIES.orange,
  "32803": FL_COUNTIES.orange,
  "32805": FL_COUNTIES.orange,
  // Tampa / Hillsborough
  "33602": FL_COUNTIES.hillsborough,
  "33603": FL_COUNTIES.hillsborough,
  "33610": FL_COUNTIES.hillsborough,
  // Miami / Miami-Dade
  "33101": FL_COUNTIES.miamidade,
  "33125": FL_COUNTIES.miamidade,
  "33142": FL_COUNTIES.miamidade,
  // St. Petersburg + Clearwater / Pinellas
  "33701": FL_COUNTIES.pinellas,
  "33755": FL_COUNTIES.pinellas,
  // Fort Lauderdale / Broward
  "33301": FL_COUNTIES.broward,
  // Gainesville / Alachua
  "32601": FL_COUNTIES.alachua,
  // Tallahassee / Leon
  "32301": FL_COUNTIES.leon,
  // Pensacola / Escambia
  "32501": FL_COUNTIES.escambia,
  // Naples / Collier
  "34102": FL_COUNTIES.collier,
  // Sarasota
  "34236": FL_COUNTIES.sarasota,
  // West Palm Beach / Palm Beach
  "33401": FL_COUNTIES.palmbeach,
  // Daytona Beach / Volusia
  "32118": FL_COUNTIES.volusia,
  // Ocala / Marion
  "34470": FL_COUNTIES.marion,
};

/** Resolve a 5-digit ZIP to its county. Returns null if we don't have a
 * mapping yet (caller falls back to API providers). */
export function resolveCountyFromZip(zip: string): CountyRef | null {
  const clean = zip.trim().slice(0, 5);
  return ZIP_TO_COUNTY[clean] ?? null;
}

/** Is this ZIP in a market we can currently scrape? (i.e. has a registered
 * scraper factory). Used by the Leads UI to decide whether to show "Pull from
 * county records" vs "Pull from data provider". */
export function isZipScrapeable(
  zip: string,
  scrapeableFips: string[],
): boolean {
  const county = resolveCountyFromZip(zip);
  return county ? scrapeableFips.includes(county.fips) : false;
}
