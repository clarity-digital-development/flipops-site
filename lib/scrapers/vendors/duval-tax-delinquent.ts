import * as cheerio from "cheerio";
import { ClerkSession } from "../base/session-fetch";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Duval County delinquent real-estate tax scraper.
//
// Source: legals.jaxdailyrecord.com/re_tax/retax_search.php (Jacksonville
// Daily Record's mandatory legal-notice publication per FL § 197.402).
//
// Same data LienHub aggregates, but PUBLIC — no bidder registration
// required. Returns the full Duval delinquent universe (~26.7k records
// as of 2026-05-30 covering 2017-2024 tax years).
//
// Schema:
//   Row format: [Acct Number, Description, Dollars]
//     Acct: "R.E.# 133729-0000" → strip prefix → 133729-0000 (matches FL DOR APN)
//     Description: "2024\nOWNER NAME\nLegal Description"
//     Dollars: "$3,045.26"
//   Pagination: ?start_round=N&incrementby=50&total_found=26779
//
// Cross-ref: each record's APN matches our `Parcel.apn` for Duval (FIPS
// 12031), enabling JOIN to current parcel state (owner / value / address).
//
// Unique key in Lien: (countyFips, documentNumber=<RE#>-<year>, source)
// So a parcel delinquent on multiple tax years produces multiple Lien rows.
// ---------------------------------------------------------------------------

const SEARCH_URL = "https://legals.jaxdailyrecord.com/re_tax/retax.php";
const SEARCH_LANDING = "https://legals.jaxdailyrecord.com/re_tax/retax_search.php";
const COUNTY_FIPS = "12031";
const PAGE_SIZE = 500; // bump from 50 default for fewer round-trips

interface DelinquentRecord {
  apn: string;          // RE# without prefix
  taxYear: number;      // year the tax was due
  ownerName: string;    // current owner per the notice
  legalDescription: string;
  amount: number;       // dollar amount due
}

export interface DuvalTaxDelinquentResult {
  found: number;
  totalReported: number;
  persisted: number;
  skippedHallucinated: number;
}

/**
 * Scrape the full delinquent real-estate tax universe for Duval County.
 * Returns counts; data persists to Lien table with lienCategory='tax'.
 */
export async function scrapeDuvalTaxDelinquent(): Promise<DuvalTaxDelinquentResult> {
  const sess = new ClerkSession();
  const sourceTag = `scraper:jaxdailyrecord-duval-tax-${new Date().toISOString().slice(0, 10)}`;

  // 1) Establish session by visiting the search-form page
  await sess.get(SEARCH_LANDING);

  // 2) First page to discover total count
  const firstResp = await sess.get(`${SEARCH_URL}?mode=search&REnumber=&PropDesc=&Name=&incrementby=${PAGE_SIZE}&sort=SeqNo&start_round=0&submit=Search+RE`);
  const totalReported = extractTotal(firstResp.html);
  console.log(`[duval-tax-delinquent] total records reported: ${totalReported.toLocaleString()}`);

  // Capture bronze of the first page so we have a sample of the rendered structure
  void captureRaw({
    entityType: "parcel",
    source: "jaxdailyrecord",
    sourceTag,
    category: "tax_delinquent_notice",
    countyFips: COUNTY_FIPS,
    requestParams: { url: SEARCH_URL, pageSize: PAGE_SIZE },
    rawResponse: { totalReported, firstPageHtmlSample: firstResp.html.slice(0, 30_000) },
    legalRisk: "yellow",
  });

  let allRecords: DelinquentRecord[] = parseRecords(firstResp.html);

  // 3) Iterate through remaining pages
  for (let offset = PAGE_SIZE; offset < totalReported; offset += PAGE_SIZE) {
    const url = `${SEARCH_URL}?mode=search&sort=SeqNo&incrementby=${PAGE_SIZE}&start_round=${offset}&total_found=${totalReported}&REnumber=&PropDesc=&Name=`;
    try {
      const resp = await sess.get(url);
      const records = parseRecords(resp.html);
      allRecords.push(...records);
      if (offset % (PAGE_SIZE * 5) === 0) {
        console.log(`[duval-tax-delinquent] paginated ${allRecords.length}/${totalReported}`);
      }
    } catch (err) {
      console.warn(`[duval-tax-delinquent] page at offset=${offset} failed: ${(err as Error).message}`);
      // continue with what we have — better than aborting the whole run
    }
  }
  console.log(`[duval-tax-delinquent] paginated total: ${allRecords.length}`);

  // 4) Persist via bulk-upsert (single PG round-trip per batch of 2000)
  const today = new Date();
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
  console.log(`[duval-tax-delinquent] bulk-upserting ${upsertRows.length} rows…`);
  const bulkResult = await bulkUpsertLiens(upsertRows);
  console.log(
    `[duval-tax-delinquent] bulk-upsert done: persisted=${bulkResult.persisted} batches=${bulkResult.batches} in ${(bulkResult.durationMs / 1000).toFixed(1)}s`,
  );

  return {
    found: allRecords.length,
    totalReported,
    persisted: bulkResult.persisted,
    skippedHallucinated,
  };
}

/** Extract total record count from "Found N Records" text. */
function extractTotal(html: string): number {
  const m = html.match(/Found\s+([\d,]+)\s+Records/i);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

/** Parse one page's delinquent-tax table. */
function parseRecords(html: string): DelinquentRecord[] {
  const $ = cheerio.load(html);
  const records: DelinquentRecord[] = [];

  // Find the data table — it has 50+ rows and a "Acct Number" header row.
  // The actual delinquent table is typically the second one on the page.
  const tables = $("table").toArray();
  for (const table of tables) {
    const $table = $(table);
    const rows = $table.find("tr").toArray();
    if (rows.length < 10) continue; // skip nav / header-only tables

    // Verify it's the data table by checking the first row mentions Acct Number
    const headerText = $(rows[0]).text();
    if (!/Acct\s*Number/i.test(headerText)) continue;

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const cells = $(rows[i]).find("td").toArray();
      if (cells.length < 3) continue;
      const acctText = $(cells[0]).text().trim();
      // Description cell: parse INNER HTML (not text) because the rows use
      // <br/> to separate year / owner / legal — cheerio's .text() collapses
      // those to spaces, destroying the structure.
      const descHtml = $(cells[1]).html() ?? "";
      const dollarText = $(cells[2]).text().trim();

      const apnMatch = acctText.match(/R\.E\.#\s*([\d-]+)/i);
      if (!apnMatch) continue;
      // Transform RE# (181780-1056) → Parcel.apn format (1817801056R) so
      // JOINs to Parcel work directly. Duval DOR uses "R" suffix to mark
      // Real Estate parcels (vs Personal Property which uses "P").
      const apn = apnMatch[1].replace("-", "") + "R";

      // Description HTML format: "2024<br/><b>OWNER NAME</b><br/>LEGAL DESC<br/>..."
      const descParts = descHtml
        .replace(/<\/?(p|b|strong|i|em)\b[^>]*>/gi, "") // strip inline formatting
        .split(/<br\s*\/?>/i)
        .map((s) => s.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const yearMatch = descParts[0]?.match(/^(20\d{2})$/);
      if (!yearMatch) continue;
      const taxYear = parseInt(yearMatch[1], 10);
      const ownerName = descParts[1] ?? "";
      const legalDescription = descParts.slice(2).join(" ");

      const amount = parseFloat(dollarText.replace(/[^\d.]/g, ""));

      records.push({ apn, taxYear, ownerName, legalDescription, amount: Number.isFinite(amount) ? amount : 0 });
    }
    break; // we found the data table — stop scanning
  }
  return records;
}

// Hallucination guard — even though this is direct HTML parsing (no LLM),
// we still reject obviously-bogus records as a defense layer.
function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.apn || !/^\d{10}R$/.test(r.apn)) return true; // malformed (expect 10 digits + R)
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true; // unreasonable year
  if (/^(john|jane)\s+(doe|smith)|test|sample/i.test(r.ownerName)) return true;
  if (r.amount < 0 || r.amount > 1e8) return true; // impossible amounts
  return false;
}
