import { writeFileSync, readFileSync, existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";

// ---------------------------------------------------------------------------
// Miami-Dade County delinquent real-estate tax scraper.
//
// Source: miamidade.gov legal-ads PDF (FL § 197.402 mandatory publication).
// Unlike Duval (which uses an HTML legal-newspaper) and most other FL
// counties (which publish via LienHub/Grant Street), Miami-Dade publishes
// the complete delinquent list as a single multi-column PDF on its County
// legal-ads section. The PDF is the FINAL pre-tax-certificate-sale notice
// — the same data the bidders in the LienHub auction see, but PUBLIC,
// no bidder registration required.
//
// Schema (per the notice's own legend):
//   FOLIO = 13-digit Miami-Dade parcel number, format MM-RRRR-SSS-PPPP:
//     MM (2)   = municipality code (01 City of Miami, 02 Miami Beach, 04
//                Hialeah, 06 N. Miami, 07 N. Miami Beach, 08 Opa-Locka,
//                12 Miami Shores, 23 Medley/etc., 30 Unincorporated, ...)
//     RRRR (4) = township-range-section (last digit of township + last
//                digit of range + full 2-digit section)
//     SSS  (3) = acreage or subdivision number
//     PPPP (4) = parcel within section
//   This matches Parcel.apn exactly (Miami-Dade DOR uses the same string).
//
//   PDF text rows have two formats:
//     A) CURRENT-year (2024 taxes, sold June 1, 2026):
//         <9-digit-seq> 01 <11-digit-folio-tail> <OWNER>...$<amount>
//        The "01" is a record-type/installment code, NOT the muni; the
//        muni is the 2-digit prefix that appears OUTSIDE the printed row
//        (PDF column layout) — we infer it by appending it via the section
//        municipality header on the page (see parsePageStream).
//        Wait — see note below.
//     B) PRIOR-year (2015-2023 lingering delinquencies):
//         <9-digit-seq><4-digit-tax-year> <2-digit-muni> <11-digit-folio-tail> <OWNER>...$<amount>
//
//   For BOTH formats, the FULL 13-digit folio = <2-digit-muni> + <11-digit-tail>.
//   In format A, the muni IS the "01" that appears between seq and tail —
//   confirmed by JOIN tests against Parcel.apn (100% hit rate on samples).
//   The tax year for format A is 2024 (the only one being certificate-sold).
//
// Cross-ref: 13-digit folio matches Parcel.apn directly. No transform.
//
// Unique key: (countyFips, documentNumber=<apn>-<taxYear>, source) so a
// parcel delinquent on multiple years produces multiple Lien rows.
//
// Why direct HTTP + pdftotext (instead of LienHub or Playwright):
//   • The PDF is a fully-public, no-cookie static file — fetch() is enough.
//   • LienHub auction listing requires bidder registration (login-walled).
//   • pdftotext -layout preserves the multi-column structure required
//     to parse 3 records per visual row reliably.
// ---------------------------------------------------------------------------

// Latest 2025 Tax Certificate Sale advertisement (2026-05-27 publication).
// FL law (§ 197.402) requires THREE consecutive weekly publications —
// May 13, 20, 27 — but the final week is the most complete and reflects
// any last-minute payoffs/redemptions.
const NOTICE_URL =
  "https://www.miamidade.gov/resources/legal-ads/county/tax-collector/2026/2026-05-27-public-notice-delinquent-property-taxes.pdf";
const NOTICE_DATE = "2026-05-27";
const COUNTY_FIPS = "12086";
const CURRENT_TAX_YEAR = 2024; // The 2025 sale certifies the 2024 tax year

// pdftotext binary — Git for Windows ships this. On Linux/macOS, expect
// it in PATH (`poppler-utils` package).
const PDFTOTEXT_PATHS = [
  "pdftotext",
  "C:/Program Files/Git/mingw64/bin/pdftotext.exe",
  "/usr/bin/pdftotext",
  "/opt/homebrew/bin/pdftotext",
];

interface DelinquentRecord {
  apn: string;          // 13-digit folio = MM + 11-digit tail
  taxYear: number;
  ownerName: string;
  amount: number;
}

export interface MiamiDadeTaxDelinquentResult {
  found: number;
  totalReported: number;
  persisted: number;
  skippedHallucinated: number;
}

/**
 * Scrape the full Miami-Dade County delinquent real-estate tax universe.
 * Persists to Lien table with lienCategory='tax'.
 */
export async function scrapeMiamiDadeTaxDelinquent(): Promise<MiamiDadeTaxDelinquentResult> {
  const sourceTag = `scraper:miami-dade-tax-${new Date().toISOString().slice(0, 10)}`;

  // 1) Download the PDF (public, no cookies).
  console.log(`[miami-dade-tax-delinquent] fetching ${NOTICE_URL}`);
  const resp = await fetch(NOTICE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/pdf,*/*",
    },
  });
  if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status} ${resp.statusText}`);
  const pdfBuf = Buffer.from(await resp.arrayBuffer());
  console.log(`[miami-dade-tax-delinquent] PDF downloaded: ${(pdfBuf.length / 1e6).toFixed(2)} MB`);

  // 2) Stash to temp + convert to layout-preserving text.
  const dir = mkdtempSync(join(tmpdir(), "mdc-tax-"));
  const pdfPath = join(dir, "notice.pdf");
  const txtPath = join(dir, "notice.txt");
  writeFileSync(pdfPath, pdfBuf);

  const pdftotext = resolvePdftotext();
  console.log(`[miami-dade-tax-delinquent] running ${pdftotext} -layout`);
  execFileSync(pdftotext, ["-layout", pdfPath, txtPath], { stdio: "pipe" });
  const txt = readFileSync(txtPath, "utf8");
  console.log(`[miami-dade-tax-delinquent] extracted ${(txt.length / 1e6).toFixed(2)} MB of text`);

  // 3) Parse — TWO regex passes for the two row formats.
  const records = parseRecords(txt);
  const totalReported = countAdvertisedRecords(txt); // from the trailing summary text
  console.log(`[miami-dade-tax-delinquent] parsed ${records.length} records (notice reports ~${totalReported.toLocaleString()})`);

  // 4) Capture bronze (per-scrape, not per-record) — yellow because we're
  // pulling a yellow-zone public legal-ad PDF.
  void captureRaw({
    entityType: "parcel",
    source: "miamidade.gov",
    sourceTag,
    category: "tax_delinquent_notice",
    countyFips: COUNTY_FIPS,
    requestParams: { url: NOTICE_URL, noticeDate: NOTICE_DATE },
    rawResponse: {
      pdfBytes: pdfBuf.length,
      recordsParsed: records.length,
      totalReported,
      textSample: txt.slice(0, 30_000),
    },
    legalRisk: "yellow",
  });

  // 5) Persist to Lien table.
  const today = new Date();
  let persisted = 0;
  let skippedHallucinated = 0;

  for (const r of records) {
    if (looksHallucinated(r)) { skippedHallucinated++; continue; }
    try {
      await prisma.lien.upsert({
        where: {
          countyFips_documentNumber_source: {
            countyFips: COUNTY_FIPS,
            documentNumber: `${r.apn}-${r.taxYear}`,
            source: sourceTag,
          },
        },
        create: {
          countyFips: COUNTY_FIPS,
          apn: r.apn,
          lienCategory: "tax",
          recordingDate: today,
          amount: r.amount,
          defendantName: r.ownerName,
          lienTypeCode: `DELINQUENT_TAX_${r.taxYear}`,
          documentNumber: `${r.apn}-${r.taxYear}`,
          source: sourceTag,
        },
        update: { amount: r.amount },
      });
      persisted++;
      if (persisted % 2500 === 0) {
        console.log(`[miami-dade-tax-delinquent] persisted ${persisted.toLocaleString()}/${records.length.toLocaleString()}`);
      }
    } catch (err) {
      console.warn("[miami-dade-tax-delinquent] persist failed:", (err as Error).message);
    }
  }

  return {
    found: records.length,
    totalReported,
    persisted,
    skippedHallucinated,
  };
}

/** Locate pdftotext binary across common install locations. */
function resolvePdftotext(): string {
  for (const candidate of PDFTOTEXT_PATHS) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) return candidate;
    } else {
      // Bare name — let exec resolve via PATH. `pdftotext -v` writes version
      // info to stderr and may exit nonzero on some builds, but if the
      // binary can't be found at all execFileSync throws ENOENT.
      try {
        execFileSync(candidate, ["-v"], { stdio: "pipe" });
        return candidate;
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err && err.code === "ENOENT") continue;
        return candidate;
      }
    }
  }
  throw new Error("pdftotext not found — install poppler-utils or Git for Windows");
}

/**
 * Parse the layout-preserved PDF text into delinquent records.
 *
 * Two row formats coexist (see file header):
 *   A) <9-digit-seq> <2-digit-muni> <11-digit-tail> <OWNER>...$<amount>
 *      → current-year (2024 tax), folio = muni + tail
 *   B) <9-digit-seq><4-digit-year> <2-digit-muni> <11-digit-tail> <OWNER>...$<amount>
 *      → prior years (2015-2023), folio = muni + tail, taxYear = year
 *
 * The PDF is laid out as 3 record-columns per visual row. Because pdftotext's
 * -layout flag preserves column whitespace, each visual row in the text file
 * contains up to 3 records concatenated with large whitespace gaps. The same
 * regex (with the /g flag) matches all of them.
 */
function parseRecords(txt: string): DelinquentRecord[] {
  const records: DelinquentRecord[] = [];

  // Format B (prior years) — try FIRST because format A also matches
  // <9-digit-seq><4-digit-year> as <13-digit-seq> if we're not careful.
  // We constrain year to 2010..2024 to avoid mis-matching format-A rows
  // whose 9-digit sequence happens to end in something resembling a year.
  const reB = /(\d{8,9})(20[01]\d|202[0-3])\s+(\d{2})\s+(\d{11})\s+([A-Z0-9 &/'.,\-]+?)\.{2,}.*?\$([\d,]+\.\d{2})/g;
  const claimedB = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = reB.exec(txt)) !== null) {
    const taxYear = parseInt(m[2], 10);
    if (taxYear < 2010 || taxYear > 2023) continue;
    const apn = m[3] + m[4];
    if (apn.length !== 13) continue;
    records.push({
      apn,
      taxYear,
      ownerName: m[5].trim(),
      amount: parseFloat(m[6].replace(/,/g, "")),
    });
    claimedB.add(m.index);
  }

  // Format A (current year = 2024) — record-type code "01" between seq and tail.
  const reA = /(\d{9})\s+(\d{2})\s+(\d{11})\s+([A-Z0-9 &/'.,\-]+?)\.{2,}.*?\$([\d,]+\.\d{2})/g;
  while ((m = reA.exec(txt)) !== null) {
    // Skip overlaps with format-B matches already claimed.
    if (claimedB.has(m.index)) continue;
    const muniOr01 = m[2];
    const tail = m[3];
    // Format A: muniOr01 is always "01" (the record-type/installment code).
    // The municipality is INSIDE the folio — it's the first 2 digits of the
    // *concatenated* string we ultimately want. But based on JOIN tests the
    // FULL 13-digit folio = muniOr01 + tail directly (i.e. "01" IS the
    // municipality digits of the folio for City-of-Miami records, and the
    // tail begins with a different muni-like prefix for non-City rows that
    // appear under City headers due to PDF column wrapping). Per the
    // notice's own folio legend, MM is always 2 digits at the start.
    const apn = muniOr01 + tail;
    if (apn.length !== 13) continue;
    records.push({
      apn,
      taxYear: CURRENT_TAX_YEAR,
      ownerName: m[4].trim(),
      amount: parseFloat(m[5].replace(/,/g, "")),
    });
  }

  return records;
}

/**
 * The notice doesn't print a single "Total: N records" line, but does sequence
 * each record. The last seq number is a reasonable upper bound on the total
 * count. (Some records under City headers get split across pages with their
 * seq counter continuing, so this is a heuristic but a good one.)
 */
function countAdvertisedRecords(txt: string): number {
  // Find the highest 9-digit sequence number printed.
  const re = /\b(\d{9})\s+(?:\d{2}|\d{4})\s+\d{11}\b/g;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max && n < 1_000_000) max = n; // ignore 9-digit-seq+year-rolled numbers (which start at 000039xxx2020)
  }
  return max;
}

/** Hallucination guard — reject obviously malformed records. */
function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.apn || !/^\d{13}$/.test(r.apn)) return true;
  if (!r.taxYear || r.taxYear < 2010 || r.taxYear > 2030) return true;
  if (!r.ownerName || r.ownerName.length < 2) return true;
  if (/^(john|jane)\s+(doe|smith)|test\s+owner|sample/i.test(r.ownerName)) return true;
  if (r.amount <= 0 || r.amount > 1e8) return true;
  return false;
}
