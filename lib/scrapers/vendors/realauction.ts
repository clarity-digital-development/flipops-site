import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";

// ---------------------------------------------------------------------------
// RealAuction scraper — Phase F2.2 from FL-COVERAGE-PLAN.md.
//
// RealAuction is THE foreclosure-auction and tax-deed/tax-certificate-sale
// platform for dozens of FL counties. ONE parser handles many counties via
// the subdomain pattern:
//   https://{county}.realforeclose.com/  — judicial foreclosure auctions
//   https://{county}.realtaxdeed.com/    — tax-deed auctions
//   https://{county}.realtaxlien.com/    — tax-certificate sales
//
// Covered FL counties confirmed (subset): Duval, Pinellas, Broward,
// Hillsborough, Orange, Lee, Palm Beach, Brevard, Polk, Volusia, Sarasota,
// Manatee, Pasco, Seminole, Marion, Collier. Many more to add as we verify
// subdomains exist.
//
// Fills the Foreclosure model's auctionDate / openingBid / surplusBid /
// stageCode=SCHEDULED|SOLD plus the related Lien data (tax certificates
// are recorded as tax liens against the parcel until satisfied).
// ---------------------------------------------------------------------------

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

export type RealAuctionTrack = "foreclosure" | "tax-deed" | "tax-lien";

export interface RealAuctionCounty {
  countyFips: string;
  subdomain: string;    // e.g. "duval", used as `${subdomain}.realforeclose.com`
  tracks: RealAuctionTrack[];
}

/**
 * Per-county RealAuction subdomain registry. Add a county here once verified
 * (subdomain resolves + auction calendar is publicly accessible).
 */
export const REALAUCTION_COUNTIES: RealAuctionCounty[] = [
  // Duval (Jacksonville)
  { countyFips: "12031", subdomain: "duval",        tracks: ["foreclosure", "tax-deed"] },
  // Pinellas (St. Pete)
  { countyFips: "12103", subdomain: "pinellas",     tracks: ["foreclosure", "tax-deed", "tax-lien"] },
  // Broward (Fort Lauderdale)
  { countyFips: "12011", subdomain: "broward",      tracks: ["foreclosure", "tax-deed"] },
  // Hillsborough (Tampa)
  { countyFips: "12057", subdomain: "hillsborough", tracks: ["foreclosure", "tax-deed", "tax-lien"] },
  // Orange (Orlando)
  { countyFips: "12095", subdomain: "orange",       tracks: ["foreclosure", "tax-deed"] },
  // Lee (Cape Coral / Fort Myers)
  { countyFips: "12071", subdomain: "lee",          tracks: ["foreclosure", "tax-deed", "tax-lien"] },
  // Palm Beach
  { countyFips: "12099", subdomain: "mypalmbeach",  tracks: ["foreclosure", "tax-deed"] }, // PBC uses mypalmbeach
  // Brevard (Space Coast)
  { countyFips: "12009", subdomain: "brevard",      tracks: ["foreclosure", "tax-deed"] },
  // Polk (Lakeland)
  { countyFips: "12105", subdomain: "polk",         tracks: ["foreclosure", "tax-deed"] },
  // Volusia (Daytona)
  { countyFips: "12127", subdomain: "volusia",      tracks: ["foreclosure", "tax-deed"] },
  // Sarasota
  { countyFips: "12115", subdomain: "sarasota",     tracks: ["foreclosure", "tax-deed"] },
  // Manatee
  { countyFips: "12081", subdomain: "manatee",      tracks: ["foreclosure", "tax-deed"] },
  // Pasco
  { countyFips: "12101", subdomain: "pasco",        tracks: ["foreclosure", "tax-deed"] },
  // Seminole
  { countyFips: "12117", subdomain: "seminole",     tracks: ["foreclosure", "tax-deed"] },
  // Marion (Ocala)
  { countyFips: "12083", subdomain: "marion",       tracks: ["foreclosure", "tax-deed"] },
  // Collier (Naples)
  { countyFips: "12021", subdomain: "collier",      tracks: ["foreclosure", "tax-deed"] },
];

function urlFor(track: RealAuctionTrack, subdomain: string): string {
  const root =
    track === "foreclosure" ? "realforeclose.com" :
    track === "tax-deed"    ? "realtaxdeed.com" :
                              "realtaxlien.com";
  return `https://${subdomain}.${root}/index.cfm`;
}

interface RawAuction {
  caseNumber?: string;
  auctionDate?: string;       // YYYY-MM-DD
  parcelNumber?: string;      // APN if shown
  address?: string;
  plaintiff?: string;
  defendant?: string;
  judgmentAmount?: number;
  openingBid?: number;
  finalBid?: number;
  surplusBid?: number;
  status?: string;            // e.g. "Scheduled", "Sold", "Cancelled", "Postponed"
}

const AUCTION_SCHEMA = {
  type: "object",
  properties: {
    auctions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caseNumber: { type: "string" },
          auctionDate: { type: "string", description: "YYYY-MM-DD" },
          parcelNumber: { type: "string" },
          address: { type: "string" },
          plaintiff: { type: "string" },
          defendant: { type: "string" },
          judgmentAmount: { type: "number" },
          openingBid: { type: "number" },
          finalBid: { type: "number" },
          surplusBid: { type: "number" },
          status: { type: "string" },
        },
      },
    },
  },
} as const;

export interface RealAuctionResult {
  countyFips: string;
  track: RealAuctionTrack;
  foundAuctions: number;
  persistedForeclosures: number;
  persistedLiens: number;
}

/**
 * Scrape upcoming + recently-resolved auctions for one (county, track) pair.
 */
export async function scrapeRealAuctions(opts: {
  countyFips: string;
  track: RealAuctionTrack;
}): Promise<RealAuctionResult | null> {
  const county = REALAUCTION_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!county) return null;
  if (!county.tracks.includes(opts.track)) return null;
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not set");
  }

  const url = urlFor(opts.track, county.subdomain);
  const sourceTag = `scraper:realauction-${opts.countyFips}-${opts.track}`;

  const res = await fetch(FIRECRAWL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      proxy: "auto",
      timeout: 90000,
      formats: [
        {
          type: "json",
          schema: AUCTION_SCHEMA,
          prompt:
            `Extract every auction listed in the calendar (both upcoming and recently completed). For each auction return: ` +
            `caseNumber, auctionDate (YYYY-MM-DD), parcelNumber if shown, property address, plaintiff, defendant, ` +
            `judgmentAmount, openingBid, finalBid, surplusBid, status (Scheduled / Sold / Cancelled / Postponed). ` +
            `Paginate through all date tabs if the calendar has multiple days.`,
        },
      ],
      actions: [
        { type: "wait", milliseconds: 2500 },
        // Many RealAuction calendars need a "Show All" or date-tab click to expand.
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl returned ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  void captureRaw({
    entityType: "parcel",
    source: "firecrawl",
    sourceTag,
    category: "realauction_calendar",
    countyFips: opts.countyFips,
    requestParams: { url, track: opts.track },
    rawResponse: data?.data ?? data,
    legalRisk: "yellow",
  });

  const auctions = (data?.data?.json?.auctions as RawAuction[]) ?? [];

  const result: RealAuctionResult = {
    countyFips: opts.countyFips,
    track: opts.track,
    foundAuctions: auctions.length,
    persistedForeclosures: 0,
    persistedLiens: 0,
  };

  for (const a of auctions) {
    if (opts.track === "foreclosure" || opts.track === "tax-deed") {
      result.persistedForeclosures += await persistAuctionAsForeclosure(opts.countyFips, sourceTag, opts.track, a);
    } else {
      result.persistedLiens += await persistAuctionAsTaxLien(opts.countyFips, sourceTag, a);
    }
  }

  return result;
}

async function persistAuctionAsForeclosure(countyFips: string, source: string, track: RealAuctionTrack, a: RawAuction): Promise<number> {
  if (!a.caseNumber) return 0;
  const stageCode =
    a.status?.toLowerCase().includes("sold") ? "SOLD" :
    a.status?.toLowerCase().includes("cancel") || a.status?.toLowerCase().includes("withdraw") ? "DISMISSED" :
    track === "tax-deed" ? "SCHEDULED" :
    "SCHEDULED";

  try {
    await prisma.foreclosure.upsert({
      where: { countyFips_caseNumber_stageCode_source: { countyFips, caseNumber: a.caseNumber, stageCode, source } },
      create: {
        countyFips,
        apn: a.parcelNumber ?? null,
        stageCode,
        auctionDate: parseDate(a.auctionDate),
        judgmentAmount: a.judgmentAmount ?? null,
        openingBid: a.openingBid ?? null,
        surplusBid: a.surplusBid ?? null,
        plaintiffName: a.plaintiff ?? null,
        caseNumber: a.caseNumber,
        trusteeId: a.caseNumber,
        source,
      },
      update: {
        auctionDate: parseDate(a.auctionDate),
        openingBid: a.openingBid ?? undefined,
        surplusBid: a.surplusBid ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[realauction] foreclosure persist failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

async function persistAuctionAsTaxLien(countyFips: string, source: string, a: RawAuction): Promise<number> {
  if (!a.caseNumber) return 0;
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: a.caseNumber, source } },
      create: {
        countyFips,
        apn: a.parcelNumber ?? null,
        lienCategory: "tax",
        recordingDate: parseDate(a.auctionDate) ?? new Date(),
        amount: a.openingBid ?? null,
        plaintiffName: "(tax certificate buyer — TBD at sale)",
        documentNumber: a.caseNumber,
        source,
      },
      update: { amount: a.openingBid ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[realauction] tax lien persist failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
