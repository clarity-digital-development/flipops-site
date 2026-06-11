// ---------------------------------------------------------------------------
// M3.2 (B3) code-enforcement — open-data source registry.
//
// Phase 1 (100% GREEN open data) sources. Phase 2 (yellow Accela Citizen
// Access) adapters register here later with source="scraper:accela-<jur>" and
// the SAME NormalizedViolation contract — the ingester/persist/join paths do
// not change. See .gstack/qa-reports/CODE-ENFORCEMENT-SPEC.md.
// ---------------------------------------------------------------------------

import type { CodeEnforcementSource } from "./types";
import { MiamiDadeArcgisSource } from "./sources/miamidade-arcgis";
import { OrlandoSocrataSource } from "./sources/orlando-socrata";

export * from "./types";
export * from "./resolve-and-persist";

/** All registered open-data sources, keyed by a short slug for the CLI. */
export const CODE_ENFORCEMENT_SOURCES: Record<string, CodeEnforcementSource> = {
  miamidade: new MiamiDadeArcgisSource(),
  orlando: new OrlandoSocrataSource(),
  // jacksonville: TODO — Duval's open-data portal not located (data.coj.net is
  //   dead; maps.coj.net ArcGIS folders carry no code-enforcement service).
  //   Likely an Accela/Municipal-portal source → Phase 2. See spec §Jacksonville.
};

export function getSource(slug: string): CodeEnforcementSource | null {
  return CODE_ENFORCEMENT_SOURCES[slug] ?? null;
}
