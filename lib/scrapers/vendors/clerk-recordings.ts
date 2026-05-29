import { randomUUID, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";

// ---------------------------------------------------------------------------
// Bulk clerk-of-court recordings scraper.
//
// THIS is the Phase F2.1 build. Per FL-COVERAGE-PLAN.md, the county-clerk
// recording stream is the single highest-ROI scrape in the entire FL plan
// (~300 of 981 Cotality fields covered: mortgage history, lien recordings,
// lis pendens, deed transfers). One scraper, near-statewide coverage via
// per-county config — exactly the pattern that lets us scale FL → national
// without per-county artisanal work.
//
// Operates differently from the per-property `clerk-records.ts` enricher:
//   • enricher: "tell me what's recorded against THIS owner/address"
//   • bulk scraper (this file): "tell me EVERY recording in THIS county
//     during this date range" — for the nightly ingest stream that
//     feeds Mortgage/Lien/Foreclosure tables.
//
// Built on Firecrawl AI extraction for HTML variability across counties.
// Per-county quirks live in CLERK_RECORDING_SOURCES (URL + form schema).
// ---------------------------------------------------------------------------

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

export interface ClerkRecordingSource {
  /** Search URL of the county clerk's Official Records portal. */
  searchUrl: string;
  /** "search-form" = Firecrawl drives the form; "date-list" = direct URL with date in path/query. */
  pattern: "search-form" | "date-list";
  /** For date-list pattern: function building the per-day URL. */
  dateListUrl?: (date: Date) => string;
  /** For search-form: Firecrawl actions to fill + submit the search. */
  searchActions?: Array<{ type: string; selector?: string; text?: string; key?: string; milliseconds?: number }>;
  /** Optional notes about the platform vendor (Civitek, Tyler, custom, etc.). */
  platform?: string;
}

/**
 * Per-county clerk recording sources. Start with Duval; add counties as URLs
 * are verified. The fallback is no-op (returns empty rather than fail).
 */
export const CLERK_RECORDING_SOURCES: Record<string, ClerkRecordingSource> = {
  // Duval (Jacksonville) — verified 2026-05
  "12031": {
    searchUrl: "https://or.duvalclerk.com/",
    pattern: "search-form",
    platform: "duval-custom",
    searchActions: [
      { type: "wait", milliseconds: 2000 },
      // Defer per-county form quirks to Firecrawl prompt — the AI handles
      // "find the document-type and date-range fields, fill them, submit".
    ],
  },
};

/** Output of a single recording extraction. Maps to Mortgage / Lien /
 *  Foreclosure depending on classification of `documentType`. */
export interface RawClerkRecording {
  documentType: string;            // raw from clerk: "Mortgage", "Lis Pendens", "Mechanics Lien", etc.
  recordingDate?: string;          // YYYY-MM-DD ideally
  documentNumber?: string;         // clerk's OR doc number
  orBook?: string;
  orPage?: string;
  amount?: number;                 // loan amount / lien amount when present
  parties?: string;                // "Grantor: X — Grantee: Y" or "Plaintiff: X vs Defendant: Y"
  grantor?: string;                // pre-split if available
  grantee?: string;
  plaintiff?: string;
  defendant?: string;
  legalDescription?: string;
}

const RECORDING_SCHEMA = {
  type: "object",
  properties: {
    recordings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          documentType: { type: "string", description: "e.g. Mortgage, Lis Pendens, Mechanics Lien, HOA Lien, Tax Lien, Judgment, Deed, Satisfaction" },
          recordingDate: { type: "string", description: "YYYY-MM-DD if possible" },
          documentNumber: { type: "string", description: "Clerk Official Record document number / instrument number" },
          orBook: { type: "string" },
          orPage: { type: "string" },
          amount: { type: "number", description: "Loan amount or lien amount in USD" },
          parties: { type: "string", description: "Raw party list from the recording" },
          grantor: { type: "string", description: "Property owner / borrower / defendant being recorded against" },
          grantee: { type: "string", description: "Lender / lienholder / plaintiff" },
          plaintiff: { type: "string", description: "For lis pendens / liens — who filed it" },
          defendant: { type: "string", description: "For lis pendens / liens — property owner being recorded against" },
          legalDescription: { type: "string", description: "Property legal description if shown" },
        },
      },
    },
  },
} as const;

export interface ClerkRecordingsResult {
  countyFips: string;
  fromDate: Date;
  toDate: Date;
  found: number;
  persistedMortgages: number;
  persistedLiens: number;
  persistedForeclosures: number;
}

/**
 * Scrape recent recordings for a county and persist them to the appropriate
 * domain tables (Mortgage / Lien / Foreclosure). The clerk source mapping
 * determines URL + interaction pattern per county.
 */
export async function scrapeRecentRecordings(opts: {
  countyFips: string;
  fromDate: Date;
  toDate: Date;
}): Promise<ClerkRecordingsResult | null> {
  const source = CLERK_RECORDING_SOURCES[opts.countyFips];
  if (!source) return null;
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not set — required for clerk-recordings scrape");
  }

  const sourceTag = `scraper:clerk-recordings-${opts.countyFips}`;
  const fromStr = opts.fromDate.toISOString().slice(0, 10);
  const toStr = opts.toDate.toISOString().slice(0, 10);

  const res = await fetch(FIRECRAWL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: source.searchUrl,
      onlyMainContent: true,
      proxy: "auto",
      timeout: 90000,
      formats: [
        {
          type: "json",
          schema: RECORDING_SCHEMA,
          prompt:
            `Search the county Clerk of Court Official Records for ALL document types ` +
            `recorded between ${fromStr} and ${toStr}. Extract EVERY recording found, ` +
            `paginating through results. For each: documentType (be specific: Mortgage, ` +
            `Lis Pendens, Mechanics Lien, HOA Lien, Tax Lien, Judgment, Deed, ` +
            `Satisfaction of Mortgage, etc.), recordingDate, documentNumber, parties, ` +
            `and amount when shown. If the page requires submitting a search form with ` +
            `date range, fill it first.`,
        },
      ],
      actions: source.searchActions,
    }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl returned ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  // BRONZE — preserve the full Firecrawl response before parsing/normalization.
  void captureRaw({
    entityType: "parcel",
    source: "firecrawl",
    sourceTag,
    category: "clerk_recordings_bulk",
    countyFips: opts.countyFips,
    requestParams: { url: source.searchUrl, fromDate: fromStr, toDate: toStr },
    rawResponse: data?.data ?? data,
    legalRisk: "yellow",
  });

  const recordings = (data?.data?.json?.recordings as RawClerkRecording[]) ?? [];

  // Classify + persist
  const result: ClerkRecordingsResult = {
    countyFips: opts.countyFips,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    found: recordings.length,
    persistedMortgages: 0,
    persistedLiens: 0,
    persistedForeclosures: 0,
  };

  for (const r of recordings) {
    const classification = classifyDocument(r.documentType);
    const recordingDate = parseDate(r.recordingDate) ?? new Date();

    if (classification === "mortgage") {
      result.persistedMortgages += await persistMortgage(opts.countyFips, sourceTag, r, recordingDate);
    } else if (classification === "lien") {
      result.persistedLiens += await persistLien(opts.countyFips, sourceTag, r, recordingDate);
    } else if (classification === "foreclosure") {
      result.persistedForeclosures += await persistForeclosure(opts.countyFips, sourceTag, r, recordingDate);
    }
    // Deeds + satisfactions handled separately (deed → ParcelSale; satisfaction → Mortgage.releasedAt). v2.
  }

  return result;
}

// ---------------------------------------------------------------------------
// Classification + persistence helpers
// ---------------------------------------------------------------------------

function classifyDocument(type: string | undefined): "mortgage" | "lien" | "foreclosure" | "deed" | "satisfaction" | "other" {
  if (!type) return "other";
  const t = type.toLowerCase();
  if (/lis\s*pendens|notice\s*of\s*default|foreclosure/.test(t)) return "foreclosure";
  if (/mortgage|deed\s*of\s*trust|loan/.test(t) && !/satisfaction|release/.test(t)) return "mortgage";
  if (/satisfaction|release\s*of\s*mortgage/.test(t)) return "satisfaction";
  if (/lien|judgment|claim/.test(t)) return "lien";
  if (/deed|warranty|quit\s*claim|tax\s*deed/.test(t) && !/of\s*trust/.test(t)) return "deed";
  return "other";
}

function classifyLienCategory(type: string | undefined): string {
  const t = (type ?? "").toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax/.test(t)) return "tax";
  if (/judgment/.test(t)) return "judgment";
  if (/lis\s*pendens/.test(t)) return "lis_pendens";
  return "other";
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function persistMortgage(countyFips: string, source: string, r: RawClerkRecording, recordingDate: Date): Promise<number> {
  if (!r.documentNumber) return 0; // can't dedup without it
  try {
    await prisma.mortgage.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.documentNumber, source } },
      create: {
        countyFips,
        recordingDate,
        loanAmount: r.amount ?? null,
        lenderName: r.grantee ?? null,
        borrowerName: r.grantor ?? null,
        documentNumber: r.documentNumber,
        orBook: r.orBook ?? null,
        orPage: r.orPage ?? null,
        source,
      },
      update: { loanAmount: r.amount ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[clerk-recordings] mortgage persist failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

async function persistLien(countyFips: string, source: string, r: RawClerkRecording, recordingDate: Date): Promise<number> {
  if (!r.documentNumber) return 0;
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.documentNumber, source } },
      create: {
        countyFips,
        lienCategory: classifyLienCategory(r.documentType),
        recordingDate,
        amount: r.amount ?? null,
        plaintiffName: r.plaintiff ?? r.grantee ?? null,
        defendantName: r.defendant ?? r.grantor ?? null,
        lienTypeCode: r.documentType ?? null,
        documentNumber: r.documentNumber,
        orBook: r.orBook ?? null,
        orPage: r.orPage ?? null,
        source,
      },
      update: { amount: r.amount ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[clerk-recordings] lien persist failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

async function persistForeclosure(countyFips: string, source: string, r: RawClerkRecording, recordingDate: Date): Promise<number> {
  const stageCode = inferForeclosureStage(r.documentType);
  const caseNumber = r.documentNumber ?? `${countyFips}-${stageCode}-${recordingDate.toISOString().slice(0, 10)}-${createHash("md5").update(r.parties ?? "").digest("hex").slice(0, 8)}`;
  try {
    await prisma.foreclosure.upsert({
      where: { countyFips_caseNumber_stageCode_source: { countyFips, caseNumber, stageCode, source } },
      create: {
        countyFips,
        stageCode,
        filingDate: recordingDate,
        judgmentAmount: r.amount ?? null,
        plaintiffName: r.plaintiff ?? null,
        caseNumber,
        source,
      },
      update: {},
    });
    return 1;
  } catch (err) {
    console.warn("[clerk-recordings] foreclosure persist failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

function inferForeclosureStage(type: string | undefined): string {
  const t = (type ?? "").toLowerCase();
  if (/notice\s*of\s*sale|nts/.test(t)) return "NTS";
  if (/notice\s*of\s*default|nod/.test(t)) return "NOD";
  if (/lis\s*pendens/.test(t)) return "LP";
  if (/auction|scheduled/.test(t)) return "SCHEDULED";
  if (/sold|sale\s*confirmed/.test(t)) return "SOLD";
  if (/reo|deed\s*in\s*lieu/.test(t)) return "REO";
  if (/dismiss|cancel|withdraw/.test(t)) return "DISMISSED";
  return "LP"; // safe default — lis pendens is the earliest stage
}

// avoid unused-import warning while keeping randomUUID handy for future use
void randomUUID;
