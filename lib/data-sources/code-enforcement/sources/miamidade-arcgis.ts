import { politeFetch } from "@/lib/scrapers/base/http-client";
import {
  type CodeEnforcementSource,
  type NormalizedViolation,
  classifyCategory,
  normalizeStatus,
} from "../types";

// ---------------------------------------------------------------------------
// Miami-Dade — ArcGIS FeatureServer open data. 100% GREEN open data.
//
// Org:     MDPublisher on services.arcgis.com/8Pc9XBTAsYuxx9Ny
// Layer:   CodeComplianceViolation_Open_View/FeatureServer/0 ("CCVIOL")
//          8,517 OPEN violations (verified live 2026-06-11).
//          (The full civil view CodeComplianceViolation_Civil_View carries the
//          historical + lien-recorded universe — swap LAYER if a full backfill
//          is wanted; the Open view is the live-distress slice we score.)
//
// ArcGIS query (anonymous, no token):
//   GET <layer>/query?where=...&outFields=...&resultOffset=N&resultRecordCount=K
//       &orderByFields=OBJECTID&returnGeometry=false&f=json
//   Pagination via resultOffset/resultRecordCount; exceededTransferLimit flags
//   more pages. maxRecordCount is typically 1000–2000 per layer.
//
// Field map (verified live):
//   CASE_NUM     -> sourceCaseId  (e.g. "202502006959")
//   CASE_DATE    -> openedAt      (epoch ms)
//   CASE_STATUS  -> rawStatus     ("1" = open) ; STAT_DESC = "Open"/"Closed"
//   ADDRESS      -> address
//   FOLIO        -> rawParcelId   (13-digit, space-padded — DIRECT Parcel join)
//   PROBLEM_DESC -> violationType
//   LN_RFRL / LN_RFRLTYP / LN_RECDATE -> isLien + lien metadata  (CODE_LIEN)
//   X_COORD / Y_COORD -> (state-plane; not lat/lng — left null, geometry off)
//
// JOIN REALITY (measured 2026-06-11): FOLIO direct-joins to Parcel(12086) at
// 99.6% (270/271 sampled). Miami-Dade is the production-grade source — folio
// is the canonical statewide key here. This is the city smoked live by the
// ingester.
// ---------------------------------------------------------------------------

const LAYER =
  "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/CodeComplianceViolation_Open_View/FeatureServer/0";
const PAGE = 1000;

interface MdAttrs {
  CASE_NUM?: string | null;
  CASE_DATE?: number | null;
  CASE_STATUS?: string | null;
  STAT_DESC?: string | null;
  ADDRESS?: string | null;
  FOLIO?: string | null;
  PROBLEM_DESC?: string | null;
  PROBLEM?: string | null;
  LN_RFRL?: string | null;
  LN_RFRLTYP?: string | null;
  LN_RECBOOK?: string | null;
  LN_RECPAGE?: string | null;
  LN_RECDATE?: string | null;
}

interface MdQueryResp {
  features?: Array<{ attributes: MdAttrs }>;
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t.length > 0 ? t : null;
}

function epochToDate(ms: number | null | undefined): Date | null {
  if (ms === null || ms === undefined) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse Miami-Dade's space-padded "MM/DD/YYYY"-ish LN_RECDATE → Date | null. */
function parseLienDate(s: string | null | undefined): Date | null {
  const t = trimOrNull(s);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cleanFolio(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = String(raw).replace(/\D/g, "");
  return n.length >= 10 ? n : null;
}

export class MiamiDadeArcgisSource implements CodeEnforcementSource {
  readonly source = "opendata:miamidade-ccv";
  readonly countyFips = "12086";
  readonly city = "Miami-Dade";
  readonly format = "arcgis" as const;

  async fetch(opts: { openOnly?: boolean; limit?: number } = {}): Promise<NormalizedViolation[]> {
    // The Open view IS already open-only; openOnly is honored for symmetry but
    // the layer carries no closed rows, so the WHERE stays 1=1.
    const where = "1=1";
    const outFields = [
      "CASE_NUM",
      "CASE_DATE",
      "CASE_STATUS",
      "STAT_DESC",
      "ADDRESS",
      "FOLIO",
      "PROBLEM_DESC",
      "PROBLEM",
      "LN_RFRL",
      "LN_RFRLTYP",
      "LN_RECBOOK",
      "LN_RECPAGE",
      "LN_RECDATE",
    ].join(",");

    const out: NormalizedViolation[] = [];
    let offset = 0;
    for (;;) {
      const pageSize = opts.limit ? Math.min(PAGE, opts.limit - out.length) : PAGE;
      if (pageSize <= 0) break;
      const url =
        `${LAYER}/query` +
        `?where=${encodeURIComponent(where)}` +
        `&outFields=${encodeURIComponent(outFields)}` +
        `&orderByFields=${encodeURIComponent("OBJECTID")}` +
        `&resultOffset=${offset}&resultRecordCount=${pageSize}` +
        `&returnGeometry=false&f=json`;

      const res = await politeFetch(url, {
        headers: { Accept: "application/json" },
        useProxy: false, // green open data — direct egress
        rateLimitMs: 1000,
        timeoutMs: 45_000,
      });
      if (!res.ok) throw new Error(`[miamidade-ccv] ArcGIS HTTP ${res.status} at offset=${offset}`);
      const body = (await res.json()) as MdQueryResp;
      if (body.error) throw new Error(`[miamidade-ccv] ArcGIS error: ${body.error.message}`);
      const feats = body.features ?? [];
      if (feats.length === 0) break;

      for (const f of feats) {
        const a = f.attributes;
        const caseNum = trimOrNull(a.CASE_NUM);
        if (!caseNum) continue;
        const lienRef = trimOrNull(a.LN_RFRL);
        const isLien = !!lienRef || !!trimOrNull(a.LN_RECDATE);
        const desc = trimOrNull(a.PROBLEM_DESC) || trimOrNull(a.PROBLEM);
        out.push({
          countyFips: this.countyFips,
          sourceCaseId: caseNum,
          source: this.source,
          rawParcelId: cleanFolio(a.FOLIO),
          address: trimOrNull(a.ADDRESS),
          city: this.city,
          zip: null,
          violationType: desc,
          category: classifyCategory(desc),
          status: normalizeStatus(trimOrNull(a.STAT_DESC) || trimOrNull(a.CASE_STATUS)),
          rawStatus: trimOrNull(a.STAT_DESC) || trimOrNull(a.CASE_STATUS),
          openedAt: epochToDate(a.CASE_DATE),
          closedAt: null, // Open view → no close date
          isLien,
          lienRecordedAt: parseLienDate(a.LN_RECDATE),
          lienBook: trimOrNull(a.LN_RECBOOK),
          lienPage: trimOrNull(a.LN_RECPAGE),
          latitude: null, // X_COORD/Y_COORD are state-plane, not WGS84
          longitude: null,
        });
      }

      offset += feats.length;
      if (!body.exceededTransferLimit && feats.length < pageSize) break;
      if (feats.length < pageSize && !body.exceededTransferLimit) break;
      if (opts.limit && out.length >= opts.limit) break;
    }
    return out;
  }
}
