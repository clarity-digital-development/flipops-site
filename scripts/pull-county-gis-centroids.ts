/* eslint-disable no-console */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geometryCentroid } from "@/lib/data-sources/bulk/fl-fgio-bulk";

// ---------------------------------------------------------------------------
// County GIS centroid puller — big-6 FL counties whose FGIO Hub exports
// persistently HTTP-500. Pages each county's OWN GIS FeatureServer/MapServer
// (honest resultOffset pagination, unlike the throttled FGIO layer) and
// streams newline-delimited GeoJSON that lib/data-sources/bulk/fl-fgio-bulk.ts
// already parses: one Feature per line with properties {CO_NO, PARCEL_ID}
// (PARCEL_ID pre-normalized to the FL DOR NAL format = Parcel.apn) and a
// WGS84 Point geometry.
//
// Usage:
//   npx tsx scripts/pull-county-gis-centroids.ts --county 12086 \
//     [--out data/raw/county-gis/12086.ndjson] [--page-size 2000] [--max-pages 2]
//
// Then ingest with the proven CLI:
//   npx tsx -r dotenv/config scripts/ingest-fl-geocodes.ts \
//     dotenv_config_path=.env.local --file data/raw/county-gis/12086.ndjson --county 12086
//
// Resume: progress is checkpointed to <out>.progress.json after every page;
// re-running continues from the last completed offset (appends to the file).
//
// APN format verification (2026-06-10, 200-row sample joined vs Parcel.apn):
//   12086 Miami-Dade  FOLIO    200/200 exact    (13-digit, no separators)
//   12011 Broward     FOLIO    196/198 exact    (12-char BCPA folio)
//   12099 Palm Beach  PARID    187/189 exact    (17-digit PCN, no separators)
//   12095 Orange      PARCEL   200/200 after R-T-S → S-T-R swap of first 6
//   12071 Lee         STRAP    (see verification notes in source config)
// ---------------------------------------------------------------------------

interface CountySource {
  fips: string;
  name: string;
  coNo: number; // FL DOR county number — what the ingester maps back to FIPS
  url: string; // layer URL (no trailing /query)
  apnField: string;
  /**
   * "geometry" = point layer, read feature.geometry (f=json);
   * "centroid" = hosted polygon layer, request returnCentroid (f=json);
   * "polygon"  = MapServer polygon layer that ignores returnCentroid — fetch
   *              f=geojson with a small maxAllowableOffset and compute the
   *              centroid client-side (same math the ingester would apply).
   */
  geometryMode: "geometry" | "centroid" | "polygon";
  pageSize: number;
  /** Normalize the raw APN field value to the FL DOR PARCEL_ID format. */
  normalize?: (raw: string) => string;
  /** Extra query params (e.g. a WHERE refinement). */
  where?: string;
}

const COUNTY_SOURCES: Record<string, CountySource> = {
  // Miami-Dade Property Point View (official MDC AGOL org, gis-mdc hub item).
  // Per-folio POINT layer — includes stacked condo folios (942,821 rows).
  "12086": {
    fips: "12086",
    name: "Miami-Dade",
    coNo: 23,
    url: "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaGISView_gdb/FeatureServer/0",
    apnField: "FOLIO",
    geometryMode: "geometry",
    pageSize: 2000,
  },
  // Broward County Parcel Tax Roll polygons (official BCGIS AGOL org).
  // One polygon per land parcel (554,358 rows) — stacked condo folios are NOT
  // in this layer, so expect ~73% match vs the 754K-row Parcel table.
  "12011": {
    fips: "12011",
    name: "Broward",
    coNo: 16,
    url: "https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0",
    apnField: "FOLIO",
    geometryMode: "centroid",
    pageSize: 2000,
  },
  // Palm Beach County Parcels and Property Details (official PBC AGOL org).
  "12099": {
    fips: "12099",
    name: "Palm Beach",
    coNo: 60,
    url: "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Projection/FeatureServer/0",
    apnField: "PARID",
    geometryMode: "centroid",
    pageSize: 2000,
  },
  // Lee County Parcels (official LeeCountyFLGIS AGOL org). STRAP is already
  // sec-twp-rge ordered like the NAL PARCEL_ID.
  "12071": {
    fips: "12071",
    name: "Lee",
    coNo: 46,
    url: "https://services2.arcgis.com/LvWGAAhHwbCJ2GMP/arcgis/rest/services/Lee_County_Parcels/FeatureServer/0",
    apnField: "STRAP",
    geometryMode: "centroid",
    pageSize: 2000,
  },
  // Orange County: official OCGIS Public_Dynamic "Parcels" layer (496,431
  // rows). PARCEL ships rge-twp-sec; the NAL PARCEL_ID is sec-twp-rge — swap
  // the first three 2-char groups (verified 200/200 vs Parcel.apn).
  // The MapServer silently ignores returnCentroid → polygon mode.
  "12095": {
    fips: "12095",
    name: "Orange",
    coNo: 58,
    url: "https://ocgis4.ocfl.net/arcgis/rest/services/Public_Dynamic/MapServer/216",
    apnField: "PARCEL",
    geometryMode: "polygon",
    pageSize: 1000,
    normalize: (s) => s.slice(4, 6) + s.slice(2, 4) + s.slice(0, 2) + s.slice(6),
  },
};

interface PullProgress {
  offset: number;
  written: number;
  total: number | null;
  /** Keyset mode: highest OBJECTID ingested so far. Servers that cap deep
   *  resultOffset paging (Lee 400s past ~284K) need cursor pagination. */
  cursor?: number;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1]?.startsWith("--") ? "true" : (argv[++i] ?? "true");
  }
  return args;
}

async function fetchJsonWithRetry(url: string, maxRetries = 6): Promise<Record<string, unknown>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      if (body && typeof body === "object" && "error" in body) {
        throw new Error(`ArcGIS error: ${JSON.stringify(body.error).slice(0, 200)}`);
      }
      return body;
    } catch (err) {
      lastErr = err;
      const backoff = Math.min(2 ** attempt * 1000, 30_000);
      console.warn(
        `  retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${err instanceof Error ? err.message : err}`,
      );
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fips = args.county;
  if (!fips || !COUNTY_SOURCES[fips]) {
    throw new Error(`--county must be one of: ${Object.keys(COUNTY_SOURCES).join(", ")}`);
  }
  const src = { ...COUNTY_SOURCES[fips] };
  if (args.url) src.url = args.url;
  if (!src.url) throw new Error(`${src.name}: no layer URL configured — pass --url`);
  if (args["page-size"]) src.pageSize = parseInt(args["page-size"], 10);
  const keyset = "keyset" in args;
  const maxPages = args["max-pages"] ? parseInt(args["max-pages"], 10) : Infinity;
  const outPath = args.out ?? path.join("data", "raw", "county-gis", `${fips}.ndjson`);
  const progressPath = `${outPath}.progress.json`;
  mkdirSync(path.dirname(outPath), { recursive: true });

  // Resume support
  let progress: PullProgress = { offset: 0, written: 0, total: null };
  if (existsSync(progressPath) && existsSync(outPath)) {
    progress = JSON.parse(readFileSync(progressPath, "utf8")) as PullProgress;
    console.log(`Resuming at offset=${progress.offset} (written=${progress.written})`);
  }

  const where = encodeURIComponent(src.where ?? "1=1");
  const base = `${src.url}/query?where=${where}&outFields=${src.apnField}&outSR=4326&f=json`;

  // Total count (best-effort; some servers reject returnCountOnly)
  if (progress.total === null) {
    try {
      const c = await fetchJsonWithRetry(`${src.url}/query?where=${where}&returnCountOnly=true&f=json`, 2);
      progress.total = (c.count as number) ?? null;
    } catch {
      progress.total = null;
    }
  }
  console.log(
    `=== ${src.name} (${fips}) ← ${src.url}\n    apnField=${src.apnField} mode=${src.geometryMode} pageSize=${src.pageSize} total=${progress.total ?? "?"}`,
  );

  const out = createWriteStream(outPath, { flags: progress.offset > 0 ? "a" : "w" });
  const startedAt = Date.now();
  let pages = 0;
  let skippedNoGeom = 0;

  for (;;) {
    if (pages >= maxPages) {
      console.log(`Stopping at --max-pages=${maxPages} (offset=${progress.offset})`);
      break;
    }
    const geomParams =
      src.geometryMode === "centroid"
        ? "&returnGeometry=false&returnCentroid=true"
        : src.geometryMode === "polygon"
          ? "&returnGeometry=true&maxAllowableOffset=0.00002"
          : "&returnGeometry=true";
    const fmt = src.geometryMode === "polygon" ? "geojson" : "json";
    // --keyset: cursor pagination on OBJECTID instead of resultOffset.
    // Strictly more robust (some servers reject deep offsets) at the cost of
    // requiring OBJECTID in outFields and an ORDER BY per page.
    const url = keyset
      ? `${src.url}/query?where=${encodeURIComponent(`(${src.where ?? "1=1"}) AND OBJECTID > ${progress.cursor ?? 0}`)}&outFields=${src.apnField},OBJECTID&outSR=4326&f=${fmt}${geomParams}&orderByFields=OBJECTID&resultRecordCount=${src.pageSize}`
      : `${base.replace(/f=json$/, `f=${fmt}`)}${geomParams}&resultOffset=${progress.offset}&resultRecordCount=${src.pageSize}`;
    const body = await fetchJsonWithRetry(url);
    const features = (body.features ?? []) as Array<{
      attributes?: Record<string, unknown>;
      properties?: Record<string, unknown>; // geojson
      geometry?: { x: number; y: number } | { type: string; coordinates: unknown };
      centroid?: { x: number; y: number };
    }>;
    if (features.length === 0) break;

    const lines: string[] = [];
    for (const f of features) {
      const attrs = f.attributes ?? f.properties ?? {};
      const rawApn = attrs[src.apnField];
      let pt: { x: number; y: number } | null | undefined;
      if (src.geometryMode === "centroid") {
        pt = f.centroid;
      } else if (src.geometryMode === "polygon") {
        const c = geometryCentroid(f.geometry as { type?: string; coordinates?: unknown } | null);
        pt = c ? { x: c.lon, y: c.lat } : null;
      } else {
        pt = f.geometry as { x: number; y: number } | undefined;
      }
      if (rawApn === null || rawApn === undefined || !pt || typeof pt.x !== "number" || typeof pt.y !== "number") {
        skippedNoGeom++;
        continue;
      }
      const apn = (src.normalize ?? ((s: string) => s))(String(rawApn).trim());
      if (!apn) {
        skippedNoGeom++;
        continue;
      }
      lines.push(
        JSON.stringify({
          type: "Feature",
          properties: { CO_NO: src.coNo, PARCEL_ID: apn },
          geometry: { type: "Point", coordinates: [pt.x, pt.y] },
        }),
      );
    }
    const flushed = out.write(lines.join("\n") + "\n");
    if (!flushed) await new Promise<void>((r) => out.once("drain", () => r()));

    progress.written += lines.length;
    progress.offset += features.length;
    if (keyset) {
      for (const f of features) {
        const oid = Number((f.attributes ?? f.properties ?? {})["OBJECTID"]);
        if (Number.isFinite(oid) && oid > (progress.cursor ?? 0)) progress.cursor = oid;
      }
    }
    pages++;
    writeFileSync(progressPath, JSON.stringify(progress));

    if (pages % 25 === 0 || features.length < src.pageSize) {
      const rate = Math.round(progress.offset / ((Date.now() - startedAt) / 1000));
      console.log(
        `  page ${pages}: offset=${progress.offset}/${progress.total ?? "?"} written=${progress.written} skipped=${skippedNoGeom} (${rate} rec/s)`,
      );
    }
    if (features.length < src.pageSize && body.exceededTransferLimit !== true) break;
  }

  await new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.end(() => resolve());
  });
  console.log(
    `=== Done ${src.name}: offset=${progress.offset} written=${progress.written} skipped=${skippedNoGeom} → ${outPath}`,
  );
}

main().catch((err) => {
  console.error("\n❌ pull-county-gis-centroids failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
