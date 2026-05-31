import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Palm Beach County delinquent real-estate tax scraper.
//
// Source: floridapublicnotices.com — the Florida Press Association's
// statewide aggregator of legal notices published under FL § 197.402. The
// Clerk of the Circuit Court & Comptroller for Palm Beach County (Joseph
// Abruzzo) files a `NOTICE OF APPLICATION FOR TAX DEED` for every parcel
// where a tax-certificate holder has applied for a deed. Each notice
// contains: certificate#, PCN (Parcel Control Number), owner name,
// redemption amount, scheduled auction date, and legal description.
//
// Palm Beach actually publishes these notices in TWO papers:
//   • Palm Beach Post (paper=67) — primary
//   • South Florida Sun-Sentinel (Ft. Lauderdale) — Palm Beach-county notices
// Both are searchable via the same county filter (50 = Palm Beach).
//
// Search strategy:
//   POST https://floridapublicnotices.com/search/archived-notices
//   Body: {"counties":["50"],"keywords":"PCN","offset":N,"limit":50}
// The keyword "PCN" finds every notice mentioning Property Control Number.
// We then client-side filter to only `NOTICE OF APPLICATION FOR TAX DEED`
// to reject HECM-foreclosures + other PCN-bearing notice types.
//
// Schema:
//   Notice text format (one notice per row, multi-line):
//     NOTICE OF APPLICATION FOR TAX DEED
//     Certificate Number: 7842-2022    PCN: 04-37-43-41-08-012-0010
//     Notice is hereby given that: MIKON FINANCIAL SERVICES INC, the
//     holder of certificate 7842-2022, has filed said certificate ...
//     Description of Property: REPL OF 3RD HOLLOWAY ADD ...
//     Name in which assessed: POOLE WILLIAM S
//     ... DATED: May 27, 2025 ...
//     REDEMPTION AMOUNT: $9,074.44 ...
//
// Cross-ref: each notice's PCN, stripped of dashes, matches our
// `Parcel.apn` for Palm Beach (FIPS 12099), enabling JOIN to current
// parcel state (owner / value / address).
//
// PCN → APN transform:
//   `04-37-43-41-08-012-0010` (7 segments, dashes) → `04374341080120010`
//   (17 digits) — strip the dashes, no suffix needed. Matches PBC's
//   Parcel Identification format on the FL DOR roll.
//
// Unique key in Lien: (countyFips, documentNumber=<PCN>-<taxYear>, source)
// So a parcel delinquent on multiple tax years produces multiple rows.
// ---------------------------------------------------------------------------

const SEARCH_URL = "https://floridapublicnotices.com/search/archived-notices";
const COUNTY_FIPS = "12099";
const COUNTY_ID = "50";          // FPN's Palm Beach county ID
const PAGE_SIZE = 50;            // FPN max per request (server enforces 50)
const MAX_PAGES = 1000;          // safety cap (50k notices ceiling, far more than expected)

interface DelinquentRecord {
  apn: string;          // 17-digit PCN with dashes stripped
  taxYear: number;      // year on the certificate
  certificateNumber: string; // e.g. "7842-2022"
  ownerName: string;
  legalDescription: string;
  amount: number;
  auctionDate?: Date;
}

export interface PalmBeachTaxDelinquentResult {
  found: number;
  totalReported: number;
  filteredTaxDeed: number;
  persisted: number;
  skippedHallucinated: number;
}

/**
 * Scrape the Palm Beach delinquent real-estate tax universe.
 *
 * Optional `dateFrom`/`dateTo` (ISO YYYY-MM-DD) narrow the FPN search to a
 * window — the FPN API key names are `date-range--start-date` / `date-range--end-date`
 * (kebab w/ double hyphen). Probe confirmed inclusive bounds. Used by the
 * Phase 2 incremental-date adapter at lib/scrapers/dispatch/palm-beach-tax-delinquent.ts.
 *
 * Returns counts; data persists to Lien table with lienCategory='tax'.
 */
export async function scrapePalmBeachTaxDelinquent(
  opts: { maxPages?: number; dateFrom?: string; dateTo?: string } = {},
): Promise<PalmBeachTaxDelinquentResult> {
  const sourceTag = `scraper:palm-beach-tax-${new Date().toISOString().slice(0, 10)}`;
  const today = new Date();
  const maxPages = opts.maxPages ?? MAX_PAGES;

  // Date-window params (Phase 0 probe verified these key names + ISO format)
  const dateParams: Record<string, string> = {};
  if (opts.dateFrom) dateParams["date-range--start-date"] = opts.dateFrom;
  if (opts.dateTo) dateParams["date-range--end-date"] = opts.dateTo;

  // 1) First page to discover total count
  const firstPayload = {
    counties: [COUNTY_ID],
    keywords: "PCN",
    offset: 0,
    limit: PAGE_SIZE,
    ...dateParams,
  };
  const firstResp = await postJson(SEARCH_URL, firstPayload);
  const totalReported = firstResp.totalCount ?? 0;
  console.log(`[palm-beach-tax-delinquent] total PCN-bearing notices reported: ${totalReported.toLocaleString()}${opts.dateFrom ? ` (window ${opts.dateFrom}…${opts.dateTo ?? "now"})` : ""}`);

  // 2) One bronze snapshot per scrape (the rendered first page sample)
  void captureRaw({
    entityType: "parcel",
    source: "floridapublicnotices",
    sourceTag,
    category: "tax_delinquent_notice",
    countyFips: COUNTY_FIPS,
    requestParams: { url: SEARCH_URL, payload: firstPayload, totalReported },
    rawResponse: { totalReported, firstPageSample: firstResp._embedded?.notices?.slice(0, 5) ?? [] },
    legalRisk: "yellow",
  });

  // 3) Paginate and collect
  const allRecords: DelinquentRecord[] = [];
  let filteredTaxDeed = 0;
  let pageIdx = 0;

  const acceptPage = (page: { _embedded?: { notices?: unknown[] } }) => {
    const notices = (page._embedded?.notices ?? []) as Array<{ notice?: string; date?: string }>;
    for (const n of notices) {
      const text = (n.notice ?? "").replace(/<br>/gi, "\n").replace(/&amp;/g, "&");
      if (!/NOTICE OF APPLICATION FOR TAX DEED/i.test(text)) continue;
      filteredTaxDeed++;
      const rec = parseNotice(text);
      if (rec) allRecords.push(rec);
    }
  };

  acceptPage(firstResp);
  pageIdx++;

  for (let offset = PAGE_SIZE; offset < totalReported && pageIdx < maxPages; offset += PAGE_SIZE) {
    try {
      const resp = await postJson(SEARCH_URL, {
        counties: [COUNTY_ID],
        keywords: "PCN",
        offset,
        limit: PAGE_SIZE,
        ...dateParams,
      });
      acceptPage(resp);
      pageIdx++;
      if (pageIdx % 10 === 0) {
        console.log(`[palm-beach-tax-delinquent] paginated ${pageIdx} pages, ${allRecords.length} tax-deed records parsed, ${filteredTaxDeed} tax-deed notices seen`);
      }
    } catch (err) {
      console.warn(`[palm-beach-tax-delinquent] page offset=${offset} failed: ${(err as Error).message}`);
      // continue with what we have
    }
  }

  console.log(`[palm-beach-tax-delinquent] paginated total: ${allRecords.length} parsed records (${filteredTaxDeed} tax-deed matches)`);

  // 4) Persist via bulk-upsert
  let skippedHallucinated = 0;
  const upsertRows: LienUpsertInput[] = [];
  for (const r of allRecords) {
    if (looksHallucinated(r)) { skippedHallucinated++; continue; }
    upsertRows.push({
      countyFips:       COUNTY_FIPS,
      apn:              r.apn,
      documentNumber:   `${r.apn}-${r.taxYear}`,
      source:           sourceTag,
      lienCategory:     "tax",
      lienTypeCode:     `DELINQUENT_TAX_${r.taxYear}`,
      recordingDate:    today,
      amount:           r.amount,
      defendantName:    r.ownerName,
      plaintiffAddress: null,
    });
  }
  const bulkResult = await bulkUpsertLiens(upsertRows);
  const persisted = bulkResult.persisted;

  return {
    found: allRecords.length,
    totalReported,
    filteredTaxDeed,
    persisted,
    skippedHallucinated,
  };
}

/** POST JSON to the FPN search endpoint. */
async function postJson(url: string, body: unknown): Promise<{
  totalCount?: number;
  _embedded?: { notices?: unknown[] };
}> {
  // 30s per-request timeout so a hung FPN response can't pin the BullMQ worker
  // for 5+ min (lockDuration) before stalled-job reclaim kicks in. Phase 4
  // defensive hardening per the debug-palm-beach-stall workflow recommendation.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://floridapublicnotices.com",
        Referer: "https://floridapublicnotices.com/search/archived-notices",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { totalCount?: number; _embedded?: { notices?: unknown[] } };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse one tax-deed application notice into a structured record. */
function parseNotice(text: string): DelinquentRecord | null {
  // Certificate Number: "1234-2022" or "1234 - 2022"
  const certMatch = text.match(/Certificate\s*Number:?\s*([0-9]+)\s*-\s*(20\d{2})/i);
  if (!certMatch) return null;
  const certificateNumber = `${certMatch[1]}-${certMatch[2]}`;
  const taxYear = parseInt(certMatch[2], 10);

  // PCN: "00-42-46-14-04-008-0190" — Palm Beach uses 7-segment format
  //   XX-XX-XX-XX-XX-XXX-XXXX (2-2-2-2-2-3-4 = 17 digits).
  // Match with flexible whitespace (some notices wrap PCN across lines).
  const pcnMatch = text.match(
    /PCN:?\s*(\d{2}[-\s]\d{2}[-\s]\d{2}[-\s]\d{2}[-\s]\d{2}[-\s]\d{3}[-\s]\d{4})/i,
  );
  if (!pcnMatch) return null;
  const apnRaw = pcnMatch[1].replace(/[-\s]/g, "");
  if (apnRaw.length !== 17) return null; // strict — reject malformed PCNs
  const apn = apnRaw;

  // Owner: "Name in which assessed: XYZ"
  // The notice continues "All of said property being in..." or similar
  const ownerMatch = text.match(
    /Name(?:\(s\))?\s*in\s*which\s*assessed:?\s*([^\n]+?)(?:\s*All of said property|\s*All of the said property|\s*$)/i,
  );
  let ownerName = (ownerMatch?.[1] ?? "").trim();
  // Strip trailing punctuation and excess whitespace
  ownerName = ownerName.replace(/\s+/g, " ").replace(/[.;,]+$/g, "").trim();

  // Legal description: "Description of Property: XYZ"
  const legalMatch = text.match(
    /Description\s*of\s*Property:?\s*([^\n]+?)(?:\s*Name(?:\(s\))?\s*in\s*which\s*assessed|\s*$)/i,
  );
  const legalDescription = (legalMatch?.[1] ?? "").replace(/\s+/g, " ").trim();

  // Redemption amount: "REDEMPTION AMOUNT: $9,074.44"
  const amountMatch = text.match(/REDEMPTION\s*AMOUNT:?\s*\$?([0-9,]+\.?[0-9]*)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  // Auction date: "will be sold ... on 7/16/2025"
  const auctionMatch = text.match(/will be sold[^.]*?on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  let auctionDate: Date | undefined;
  if (auctionMatch) {
    const parsed = new Date(auctionMatch[1]);
    if (!isNaN(parsed.getTime())) auctionDate = parsed;
  }

  return {
    apn,
    taxYear,
    certificateNumber,
    ownerName,
    legalDescription,
    amount: Number.isFinite(amount) ? amount : 0,
    auctionDate,
  };
}

// Hallucination guard — defense layer even though parsing is deterministic.
function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.apn || !/^\d{17}$/.test(r.apn)) return true; // malformed PCN
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true; // unreasonable year
  if (!r.ownerName) return true;
  if (/^(john|jane)\s+(doe|smith)|test\s+test|sample\s+name|placeholder/i.test(r.ownerName)) return true;
  if (r.amount < 0 || r.amount > 1e8) return true; // impossible amounts
  // Redemption < $50 is suspect (typical floor is $200+ on FL tax certificates)
  if (r.amount > 0 && r.amount < 50) return true;
  return false;
}
