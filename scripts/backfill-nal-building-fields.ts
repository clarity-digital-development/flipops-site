/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// backfill-nal-building-fields.ts — Phase 0 (M3.3 AVM data expansion).
//
// Populates the 4 "free" NAL building columns that were always in the FL DOR
// roll but dropped on the original ingest: effectiveYearBuilt (EFF_YR_BLT),
// improvementQuality (IMP_QUAL), specialFeatureValue (SPEC_FEAT_VAL),
// numResUnits (NO_RES_UNTS).
//
// GEOCODE-SAFE BY DESIGN: this is a TARGETED `UPDATE ... FROM (VALUES …)` of
// ONLY those 4 columns (+ updatedAt) — it never touches latitude/longitude or
// any other column. A full NAL re-ingest is NOT safe for a backfill: the
// bulk-ingester upsert does `SET <col> = EXCLUDED.<col>` for every column incl.
// latitude/longitude, and the NAL mapper emits latitude=null — so a re-ingest
// would WIPE the 94.8% FloridaGIO geocode backfill. This script avoids that.
//
// Reads the already-on-disk NAL CSVs at
//   data/raw/fl-dor-2025/extracted/NAL_2025_co<NN>/NAL<NN>F*.csv
// (no re-download). Mirrors the fl-fgio-bulk.ts UPDATE-only pattern.
//
//   DATABASE_URL=... npx tsx scripts/backfill-nal-building-fields.ts [FIPS ...]
//     (no FIPS args = all 67 counties; e.g. `12086 12011` = Miami-Dade + Broward)
// ---------------------------------------------------------------------------
import { createReadStream, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { prisma } from "@/lib/prisma";
import { flCountyByCoNo } from "@/lib/data-sources/bulk/fl-counties";
import { nalRowToParcelRecord } from "@/lib/data-sources/bulk/fl-dor";

const RAW_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-2025/extracted");
const BATCH = 4000; // 6 binds/row → 24k binds, well under the 32767 PG cap

interface Upd {
  countyFips: string;
  apn: string;
  eff: number | null;
  qual: number | null;
  spec: number | null;
  units: number | null;
}

async function flush(rows: Upd[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values: unknown[] = [];
  const tuples: string[] = [];
  rows.forEach((r, i) => {
    const b = i * 6;
    values.push(r.countyFips, r.apn, r.eff, r.qual, r.spec, r.units);
    tuples.push(`($${b + 1}::text, $${b + 2}::text, $${b + 3}::int, $${b + 4}::int, $${b + 5}::double precision, $${b + 6}::int)`);
  });
  const sql =
    `UPDATE flipops."Parcel" AS p SET ` +
    `"effectiveYearBuilt" = v.eff, "improvementQuality" = v.qual, ` +
    `"specialFeatureValue" = v.spec, "numResUnits" = v.units, "updatedAt" = NOW() ` +
    `FROM (VALUES ${tuples.join(", ")}) AS v("countyFips", apn, eff, qual, spec, units) ` +
    `WHERE p."countyFips" = v."countyFips" AND p.apn = v.apn`;
  return prisma.$executeRawUnsafe(sql, ...values);
}

function findCsv(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const csv = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".csv"));
  return csv ? path.join(dir, csv) : null;
}

async function ingestFile(csvPath: string, targets: Set<string>): Promise<{ scanned: number; updated: number; counties: Set<string> }> {
  const counties = new Set<string>();
  let scanned = 0;
  let updated = 0;
  let batch: Upd[] = [];
  const stream = createReadStream(csvPath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true }),
  );
  for await (const row of stream as AsyncIterable<Record<string, string>>) {
    const coNo = Number.parseInt(row["CO_NO"] ?? "", 10);
    if (Number.isNaN(coNo)) continue;
    const county = flCountyByCoNo(coNo);
    if (!county) continue;
    if (targets.size && !targets.has(county.fips)) continue;
    const rec = nalRowToParcelRecord(row, county.fips);
    if (!rec) continue;
    const eff = rec.effectiveYearBuilt ?? null;
    const qual = rec.improvementQuality ?? null;
    const spec = rec.specialFeatureValue ?? null;
    const units = rec.numResUnits ?? null;
    // Skip pure-null rows (vacant land with none of the 4 signals) — nothing to write.
    if (eff === null && qual === null && spec === null && units === null) continue;
    counties.add(county.fips);
    scanned++;
    batch.push({ countyFips: county.fips, apn: rec.apn, eff, qual, spec, units });
    if (batch.length >= BATCH) {
      updated += await flush(batch);
      batch = [];
    }
  }
  if (batch.length) updated += await flush(batch);
  return { scanned, updated, counties };
}

async function main() {
  const targets = new Set(process.argv.slice(2).filter((a) => /^\d{5}$/.test(a)));
  console.log(
    `[backfill-nal-building-fields] ${targets.size ? `targets=${[...targets].join(",")}` : "ALL 67 counties"}`,
  );
  if (!existsSync(RAW_DIR)) {
    console.error(`NAL dir not found: ${RAW_DIR}`);
    process.exit(1);
  }
  const dirs = readdirSync(RAW_DIR).filter((d) => /^NAL_2025_co\d+$/i.test(d)).sort();
  const t0 = Date.now();
  let totalScanned = 0;
  let totalUpdated = 0;
  const allCounties = new Set<string>();
  for (const d of dirs) {
    const csvPath = findCsv(path.join(RAW_DIR, d));
    if (!csvPath) continue;
    const { scanned, updated, counties } = await ingestFile(csvPath, targets);
    if (scanned > 0) {
      for (const c of counties) allCounties.add(c);
      totalScanned += scanned;
      totalUpdated += updated;
      console.log(`  ${d.padEnd(20)} fips=${[...counties].join("/")||"-"}  scanned=${scanned}  updated=${updated}`);
    }
  }
  console.log(
    `\n[backfill-nal-building-fields] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
      `${allCounties.size} counties, ${totalScanned} rows with data, ${totalUpdated} Parcel rows updated.`,
  );
}

main()
  .catch((e) => {
    console.error("[backfill-nal-building-fields] FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
