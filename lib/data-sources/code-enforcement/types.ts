// ---------------------------------------------------------------------------
// M3.2 (B3) code-enforcement — shared normalized types.
//
// Every source adapter (Socrata / ArcGIS / future Accela) parses its native
// payload into NormalizedViolation, so the ingester's persist + join + summary
// paths are source-agnostic. Field semantics characterized live 2026-06-11 —
// see .gstack/qa-reports/CODE-ENFORCEMENT-SPEC.md.
// ---------------------------------------------------------------------------

/** Normalized lifecycle status. Feeds emit wildly different strings/codes. */
export type ViolationStatus = "open" | "closed" | "unknown";

/** Coarse normalized category for CONDITION_FAMILY weighting + dedup. */
export type ViolationCategory =
  | "structure"
  | "nuisance"
  | "zoning"
  | "vehicle"
  | "other";

/** The single shape every adapter produces and the ingester consumes. */
export interface NormalizedViolation {
  countyFips: string;
  /** Stable case id from the source feed (Miami-Dade CASE_NUM / Orlando apno). */
  sourceCaseId: string;
  /** Provenance tag — "opendata:<city>-<feed>" | "scraper:accela-<jur>". */
  source: string;

  /** DOR PARCEL_ID / folio if the feed carries one (pre-normalization, raw). */
  rawParcelId: string | null;

  address: string | null;
  city: string | null;
  zip: string | null;

  violationType: string | null;
  category: ViolationCategory;

  status: ViolationStatus;
  rawStatus: string | null;
  openedAt: Date | null;
  closedAt: Date | null;

  /** CODE_LIEN driver. */
  isLien: boolean;
  lienRecordedAt: Date | null;
  lienBook: string | null;
  lienPage: string | null;

  latitude: number | null;
  longitude: number | null;
}

/** The interface each city/source adapter implements. */
export interface CodeEnforcementSource {
  /** Stable provenance tag written to CodeViolation.source. */
  readonly source: string;
  readonly countyFips: string;
  readonly city: string;
  /** Open-data feed kind, for the spec + operator output. */
  readonly format: "socrata" | "arcgis";
  /**
   * Paginated fetch → normalized rows. `openOnly` restricts to currently-open
   * cases (the default — we only score live distress). `limit` caps total rows
   * (LIMIT-test / dry-run). Implementations page internally and respect polite
   * pacing; they MUST NOT throw on an empty window (return []).
   */
  fetch(opts: { openOnly?: boolean; limit?: number }): Promise<NormalizedViolation[]>;
}

// ---------------------------------------------------------------------------
// Shared classification helpers (deterministic, source-agnostic).
// ---------------------------------------------------------------------------

/** Map a free-text violation/problem description to a coarse category. */
export function classifyCategory(text: string | null | undefined): ViolationCategory {
  const t = (text || "").toLowerCase();
  if (!t) return "other";
  if (/vehicle|towing|abandoned auto|inoperable|junk (car|motor)/.test(t)) return "vehicle";
  if (/zoning|land use|setback|unauthorized use|sign\b|certificate of use|business tax/.test(t))
    return "zoning";
  if (
    /permit|construction|structure|unsafe|building|roof|electrical|plumbing|demolition|condemn|housing/.test(
      t,
    )
  )
    return "structure";
  if (/weed|litter|trash|debris|nuisance|overgrow|lot\b|abatement|mosquito|junk|sanitation/.test(t))
    return "nuisance";
  return "other";
}

/**
 * Normalize a feed's status string/code to open|closed|unknown.
 * Miami-Dade emits CASE_STATUS="1" (open) with STAT_DESC="Open"; Orlando emits
 * caseinfostatus="Open"/"Closed". Anything else → unknown (kept, never dropped).
 */
export function normalizeStatus(raw: string | null | undefined): ViolationStatus {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "unknown";
  if (/^(open|active|1|in[\s-]?process|pending|cited|notice)/.test(s)) return "open";
  if (/^(closed|complied|resolved|0|void|dismissed|inactive|2)/.test(s)) return "closed";
  return "unknown";
}
