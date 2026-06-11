import { politeFetch } from "@/lib/scrapers/base/http-client";
import {
  type CodeEnforcementSource,
  type NormalizedViolation,
  classifyCategory,
  normalizeStatus,
} from "../types";

// ---------------------------------------------------------------------------
// Orlando (Orange County) — Socrata SoQL open data. 100% GREEN open data.
//
// Portal:  https://data.cityoforlando.net  (Socrata / Tyler Data & Insights)
// Dataset: "Code Enforcement Cases" — resource id k6e8-nw6w (252,796 rows,
//          refreshed; verified live 2026-06-11).
// SoQL:    GET /resource/k6e8-nw6w.json?$where=...&$select=...&$limit&$offset
//          (anonymous, no app token needed for modest volume; a token raises
//          the rate cap — add via X-App-Token if SODA throttles a full sweep).
//
// Field map (verified live):
//   apno              -> sourceCaseId (e.g. "2023-14508TKT")
//   caseinfostatus    -> status      ("Open" | "Closed")
//   casedt            -> openedAt     (ISO date "2023-07-31T00:00:00.000")
//   resdt             -> closedAt
//   parcel_id         -> rawParcelId  (15-digit Orange folio, e.g. "292231247401000")
//   case_comments /
//   case_type         -> violationType
//   derived_address /
//   location_notes    -> address
//
// JOIN REALITY (measured 2026-06-11): parcel_id direct-joins to Parcel(12095)
// at only ~3.8% (open cases). The city parcel_id diverges from the DOR
// PARCEL_ID for most Orlando cases, AND the dataset is dominated by
// non-property cases (vehicles, ROW, business-tax). Orlando therefore persists
// address-first and relies on the address→situsAddress fuzzy resolver
// (spec §Join Strategy). Contrast Miami-Dade FOLIO @ 99.6%.
// ---------------------------------------------------------------------------

const DOMAIN = "https://data.cityoforlando.net";
const RESOURCE = "k6e8-nw6w";
const PAGE = 1000; // SODA default max page; $limit can go higher with a token

interface OrlandoRow {
  apno?: string;
  caseinfostatus?: string;
  casedt?: string;
  resdt?: string;
  parcel_id?: string;
  case_type?: string;
  casetype?: string;
  case_comments?: string;
  casename?: string;
  derived_address?: string;
  location_notes?: string;
}

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cleanFolio(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = raw.replace(/\D/g, "");
  return n.length >= 10 ? n : null;
}

export class OrlandoSocrataSource implements CodeEnforcementSource {
  readonly source = "opendata:orlando-ce";
  readonly countyFips = "12095";
  readonly city = "Orlando";
  readonly format = "socrata" as const;

  async fetch(opts: { openOnly?: boolean; limit?: number } = {}): Promise<NormalizedViolation[]> {
    const openOnly = opts.openOnly ?? true;
    const where = openOnly ? `caseinfostatus='Open'` : `1=1`;
    const select = [
      "apno",
      "caseinfostatus",
      "casedt",
      "resdt",
      "parcel_id",
      "case_type",
      "casetype",
      "case_comments",
      "casename",
      "derived_address",
      "location_notes",
    ].join(",");

    const out: NormalizedViolation[] = [];
    let offset = 0;
    for (;;) {
      const pageSize = opts.limit ? Math.min(PAGE, opts.limit - out.length) : PAGE;
      if (pageSize <= 0) break;
      const url =
        `${DOMAIN}/resource/${RESOURCE}.json` +
        `?$where=${encodeURIComponent(where)}` +
        `&$select=${encodeURIComponent(select)}` +
        `&$order=${encodeURIComponent(":id")}` +
        `&$limit=${pageSize}&$offset=${offset}`;

      const res = await politeFetch(url, {
        headers: { Accept: "application/json" },
        useProxy: false, // green open data — direct egress
        rateLimitMs: 1000,
        timeoutMs: 45_000,
      });
      if (!res.ok) {
        throw new Error(`[orlando-ce] SODA HTTP ${res.status} at offset=${offset}`);
      }
      const rows = (await res.json()) as OrlandoRow[];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        if (!r.apno) continue;
        const desc = r.case_comments || r.casename || r.case_type || r.casetype || null;
        out.push({
          countyFips: this.countyFips,
          sourceCaseId: r.apno,
          source: this.source,
          rawParcelId: cleanFolio(r.parcel_id),
          address: (r.derived_address || r.location_notes || "").trim() || null,
          city: this.city,
          zip: null,
          violationType: desc ? desc.trim() : null,
          category: classifyCategory(desc),
          status: normalizeStatus(r.caseinfostatus),
          rawStatus: r.caseinfostatus ?? null,
          openedAt: toDate(r.casedt),
          closedAt: toDate(r.resdt),
          isLien: false, // Orlando feed exposes no lien flag (Phase-2 enrich)
          lienRecordedAt: null,
          lienBook: null,
          lienPage: null,
          latitude: null,
          longitude: null,
        });
      }

      offset += rows.length;
      if (rows.length < pageSize) break;
      if (opts.limit && out.length >= opts.limit) break;
    }
    return out;
  }
}
