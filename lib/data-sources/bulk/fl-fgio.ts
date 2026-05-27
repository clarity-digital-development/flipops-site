import {
  BulkIngester,
  type IngestOptions,
  type ParcelRecord,
} from "@/lib/scrapers/base/bulk-ingester";
import { flCountyByFips, FL_COUNTIES } from "./fl-counties";
import { captureRaw } from "../raw-capture";

// ---------------------------------------------------------------------------
// FloridaGIO statewide cadastral ingester.
//
// Pulls the FL DOR roll (owner / value / characteristics / last sale) from the
// FloridaGIO ArcGIS FeatureServer, which mirrors the NAL schema for all 67
// counties (10.8M parcels). The CO_NO → FIPS crosswalk is in fl-counties.ts.
//
// FeatureServer: services9.arcgis.com/Gh9awoU677aKree0/.../Florida_Statewide_Cadastral/FeatureServer/0
//
// ⚠️ VERIFIED CONSTRAINT (2026-05-26): this hosted layer is THROTTLED to tiny
// interactive queries. It returns correct data with the exact shape
// `where=CO_NO=N&outFields=<list>&returnGeometry=true&returnCentroid=true&outSR=4326&resultRecordCount=2`
// but REJECTS ("Invalid query parameters") anything larger: resultRecordCount
// above a tiny cap, resultOffset (any), orderByFields, or compound WHERE.
// Metadata advertises maxRecordCount=2000 + supportsPagination=true but the
// server does not honor it — this is an intentional push toward the bulk
// FILE download for large pulls.
//
// THEREFORE:
//   • TARGETED lookups (a few parcels — e.g. on-demand "user searched an
//     address") → use this FeatureServer with the small-query shape. Works.
//   • FULL-COUNTY / STATEWIDE bulk preload → MUST use the FloridaGIO Hub file
//     download (FGDB/GeoJSON/CSV) or the DOR NAL CSV, NOT this query API.
//     That async file-download pipeline is the next build (see master plan).
//
// This class is wired for the targeted-query path. fetchBatches uses the
// proven small-query shape with a conservative page size. For true bulk,
// build FloridaGioBulkFileIngester against the Hub download endpoint.
// ---------------------------------------------------------------------------

const FEATURE_SERVER =
  "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0";

// The throttled layer only accepts a tiny resultRecordCount with the geometry
// params present. Keep it small; this endpoint serves targeted lookups, not bulk.
const PAGE_SIZE = 2;

// Explicit field list — matches the proven-working query shape exactly.
const OUT_FIELDS = [
  "OBJECTID", "CO_NO", "PARCEL_ID", "OWN_NAME", "PHY_ADDR1", "PHY_CITY",
  "PHY_ZIPCD", "JV", "AV_SD", "DOR_UC", "ACT_YR_BLT", "TOT_LVG_AR",
  "SALE_PRC1", "SALE_YR1",
].join(",");

interface ArcGisFeature {
  attributes: Record<string, unknown>;
  centroid?: { x: number; y: number };
}
interface ArcGisResponse {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

export class FloridaGioIngester extends BulkIngester {
  constructor(private vintage = "2025") {
    super();
  }

  get sourceTag(): string {
    return `bulk:fl-fgio-${this.vintage}`;
  }
  get dataVintage(): string {
    return this.vintage;
  }

  protected defaultScope(): string {
    return "FL";
  }

  protected async *fetchBatches(
    opts: IngestOptions,
  ): AsyncGenerator<ParcelRecord[], void, unknown> {
    // Determine which counties to pull. One county = one CO_NO filter.
    const counties = opts.countyFips
      ? [flCountyByFips(opts.countyFips)].filter(Boolean)
      : FL_COUNTIES;

    for (const county of counties) {
      if (!county) continue;
      // NOTE: this layer rejects resultOffset / orderByFields / large counts,
      // so we cannot paginate the full county here — only the proven
      // small-query shape works. Returns the first PAGE_SIZE parcels for the
      // county (sufficient for targeted lookups). Full-county bulk = file
      // download ingester (next build).
      // Encode the inner "=" in the WHERE value, but leave outFields commas
      // literal — this throttled layer rejects %2C-encoded field lists.
      const url =
        `${FEATURE_SERVER}/query?where=${encodeURIComponent(`CO_NO=${county.coNo}`)}` +
        `&outFields=${OUT_FIELDS}` +
        `&returnGeometry=true&returnCentroid=true&outSR=4326` +
        `&resultRecordCount=${PAGE_SIZE}&f=json`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`FloridaGIO HTTP ${res.status} (county ${county.name})`);
      const data = (await res.json()) as ArcGisResponse;
      if (data.error) throw new Error(`FloridaGIO error: ${data.error.message}`);

      const features = data.features ?? [];
      if (features.length > 0) {
        // BRONZE: preserve the raw FeatureServer attributes for this county batch.
        void captureRaw({
          entityType: "parcel",
          source: "fl-fgio",
          sourceTag: this.sourceTag,
          category: "bulk_roll",
          countyFips: county.fips,
          requestParams: { url, coNo: county.coNo },
          rawResponse: { features: features.map((f) => f.attributes) },
        });
        yield features.map((f) => this.mapFeature(f, county.fips));
      }
    }
  }

  private mapFeature(f: ArcGisFeature, fips: string): ParcelRecord {
    const a = f.attributes;
    const situsZip = a.PHY_ZIPCD != null ? String(a.PHY_ZIPCD).padStart(5, "0").slice(0, 5) : null;
    const ownerZip = a.OWN_ZIPCD != null ? String(a.OWN_ZIPCD).padStart(5, "0").slice(0, 5) : null;
    const ownerMailing = [a.OWN_ADDR1, a.OWN_CITY, a.OWN_STATE, ownerZip]
      .filter(Boolean)
      .join(", ") || null;

    return {
      countyFips: fips,
      apn: str(a.PARCEL_ID) ?? "",
      state: "FL",
      ownerName: str(a.OWN_NAME),
      ownerMailingAddress: ownerMailing,
      situsAddress: str(a.PHY_ADDR1),
      situsCity: str(a.PHY_CITY),
      situsState: "FL",
      situsZip,
      marketValue: num(a.JV),
      assessedValue: num(a.AV_SD),
      landValue: num(a.LND_VAL),
      propertyType: str(a.DOR_UC),
      yearBuilt: int(a.ACT_YR_BLT),
      squareFeet: int(a.TOT_LVG_AR),
      lotSize: num(a.LND_SQFOOT),
      lastSalePrice: num(a.SALE_PRC1),
      lastSaleYear: int(a.SALE_YR1),
      // Centroid (returnCentroid=true, outSR=4326) gives map-pin coordinates.
      latitude: f.centroid?.y ?? null,
      longitude: f.centroid?.x ?? null,
    };
  }
}

export function buildFloridaGioIngester(vintage?: string): FloridaGioIngester {
  return new FloridaGioIngester(vintage);
}

// ---------------------------------------------------------------------------
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}
