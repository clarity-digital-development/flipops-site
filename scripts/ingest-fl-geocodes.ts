/* eslint-disable no-console */
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  FlFgioBulkGeocodeIngester,
  downloadCountyCentroidShapefile,
  type GeocodeIngestResult,
} from "@/lib/data-sources/bulk/fl-fgio-bulk";
import { FL_COUNTIES, flCountyByFips } from "@/lib/data-sources/bulk/fl-counties";

// ---------------------------------------------------------------------------
// FL geocode backfill CLI — joins FGIO statewide parcel centroids onto the
// Parcel table (UPDATE latitude/longitude only; never inserts).
//
// Modes:
//   1. Ingest a local file you already downloaded (Hub export .zip, .shp, or
//      EPSG:4326 GeoJSON/NDJSON):
//        npx tsx -r dotenv/config scripts/ingest-fl-geocodes.ts \
//          dotenv_config_path=.env.local \
//          --file data/raw/fl-fgio-geo/fl-fgio-centroids-co49-4326.zip --county 12077
//
//   2. Download from the FloridaGIO Hub Download API + ingest, per county or
//      the whole state (67 sequential county exports — the statewide single
//      file blows the 2GB DBF cap, see fl-fgio-bulk.ts header):
//        npx tsx -r dotenv/config scripts/ingest-fl-geocodes.ts \
//          dotenv_config_path=.env.local --download 12077
//        npx tsx -r dotenv/config scripts/ingest-fl-geocodes.ts \
//          dotenv_config_path=.env.local --download all
//
// Flags:
//   --file <path>        local file to ingest (.zip / .shp / .geojson / .json / .ndjson)
//   --download <fips|all> fetch county centroid shapefile(s) from the Hub API first
//   --county <fips|all>  restrict updates to one county (default: all)
//   --dest <dir>         download directory (default: data/raw/fl-fgio-geo)
//   --dry-run            parse + map + count; no DB writes, no audit row
//   --batch-size <n>     rows per UPDATE batch (default 2000, max 8000)
//   --max <n>            cap parsed records (testing)
//
// Verify afterwards:
//   SELECT COUNT(*) FILTER (WHERE latitude IS NOT NULL) AS geocoded, COUNT(*) AS total
//   FROM flipops."Parcel";
// ---------------------------------------------------------------------------

const ArgsSchema = z.object({
  file: z.string().optional(),
  download: z.string().optional(),
  county: z.string().default("all"),
  dest: z.string().default(path.join("data", "raw", "fl-fgio-geo")),
  dryRun: z.boolean().default(false),
  batchSize: z.coerce.number().int().min(1).max(8000).optional(),
  max: z.coerce.number().int().min(1).optional(),
});

function parseArgs(argv: string[]) {
  const raw: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--file":
        raw.file = argv[++i];
        break;
      case "--download":
        raw.download = argv[++i];
        break;
      case "--county":
        raw.county = argv[++i];
        break;
      case "--dest":
        raw.dest = argv[++i];
        break;
      case "--dry-run":
        raw.dryRun = true;
        break;
      case "--batch-size":
        raw.batchSize = argv[++i];
        break;
      case "--max":
        raw.max = argv[++i];
        break;
      default:
        if (a.startsWith("dotenv_config_")) break; // dotenv/config passthrough
        throw new Error(`Unknown argument: ${a}`);
    }
  }
  return ArgsSchema.parse(raw);
}

function printResult(label: string, r: GeocodeIngestResult) {
  const secs = (r.durationMs / 1000).toFixed(1);
  console.log(
    `  ✓ ${label}: parsed=${r.recordsParsed} updated=${r.rowsUpdated} ` +
      `skipped=${r.recordsSkipped} filtered=${r.recordsFiltered} ` +
      `batches=${r.batches} in ${secs}s`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file && !args.download) {
    throw new Error("Provide --file <path> or --download <fips|all> (see header for usage).");
  }
  if (args.county !== "all" && !flCountyByFips(args.county)) {
    throw new Error(`--county ${args.county} is not a known FL county FIPS (e.g. 12077).`);
  }

  const ingester = new FlFgioBulkGeocodeIngester();
  const countyFilter = args.county === "all" ? undefined : args.county;
  const common = {
    dryRun: args.dryRun,
    batchSize: args.batchSize,
    maxRecords: args.max,
  };

  console.log(
    `=== FL FGIO geocode backfill (${ingester.sourceTag})${args.dryRun ? " [DRY RUN]" : ""} ===\n`,
  );

  const results: GeocodeIngestResult[] = [];
  const failures: string[] = [];

  if (args.file) {
    console.log(`Ingesting ${args.file} (county filter: ${args.county})…`);
    const r = await ingester.ingestFile(args.file, { ...common, countyFips: countyFilter });
    printResult(path.basename(args.file), r);
    results.push(r);
  } else if (args.download) {
    const counties =
      args.download === "all"
        ? FL_COUNTIES
        : [flCountyByFips(args.download)].filter((c): c is NonNullable<typeof c> => c !== null);
    if (counties.length === 0) {
      throw new Error(`--download ${args.download} is not a known FL county FIPS or "all".`);
    }
    for (const county of counties) {
      try {
        console.log(`${county.name} (CO_NO=${county.coNo}, FIPS=${county.fips}) — requesting Hub export…`);
        const zipPath = await downloadCountyCentroidShapefile(county.coNo, args.dest);
        console.log(`  downloaded ${zipPath}`);
        const r = await ingester.ingestFile(zipPath, { ...common, countyFips: county.fips });
        printResult(county.name, r);
        results.push(r);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${county.name} failed: ${msg}`);
        failures.push(`${county.name}: ${msg}`);
      }
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      parsed: acc.parsed + r.recordsParsed,
      updated: acc.updated + r.rowsUpdated,
      skipped: acc.skipped + r.recordsSkipped,
    }),
    { parsed: 0, updated: 0, skipped: 0 },
  );
  console.log(
    `\n=== Done: ${results.length} file(s) — parsed=${totals.parsed} updated=${totals.updated} skipped=${totals.skipped} ===`,
  );
  if (failures.length) {
    console.error(`\n${failures.length} count(y/ies) FAILED:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n❌ ingest-fl-geocodes failed:", err instanceof Error ? err.message : err);
  prisma.$disconnect().finally(() => process.exit(1));
});
