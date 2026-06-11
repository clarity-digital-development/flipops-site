/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M2.4 — Apply calibrated propensities to TaxDelinquencySummary.
//
//   DATABASE_URL=... npx tsx scripts/ml/apply-predictions.ts \
//     --in scripts/ml/out/model-v1/predictions.csv \
//     --model-version <ModelVersion.id>
//
// Reads predictions.csv from train_propensity.py (countyFips,apn,propensity12mo)
// and batch-UPDATEs flipops."TaxDelinquencySummary"."propensity12mo" +
// "propensityModelVersionId".
//
// SKELETON STATUS: the propensity12mo / propensityModelVersionId columns do
// NOT exist until prisma/schema.patch.ml.prisma is applied. This script is
// therefore (a) typed against raw SQL only — no generated-model imports for
// the new tables — and (b) guarded by an information_schema preflight that
// exits with instructions instead of throwing mid-write.
//
// Batching: chunked VALUES updates of CHUNK_ROWS rows per statement.
// OPERATIONS.md landmine — the Railway proxy silently kills long-running
// statements, so one giant UPDATE over 100K+ rows is forbidden. 500 rows ×
// 3 bind params = 1500 binds per statement, far under the PG 32767 cap.
// ---------------------------------------------------------------------------

import * as fs from "fs";
import { z } from "zod";
// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../lib/prisma";

const CHUNK_ROWS = 500;

const PredictionRow = z.object({
  countyFips: z.string().regex(/^\d{5}$/),
  apn: z.string().min(1),
  propensity12mo: z.coerce.number().min(0).max(1),
});
type PredictionRow = z.infer<typeof PredictionRow>;

/** Minimal CSV reader for the 3-column predictions file (no quoted fields). */
function readPredictionsCsv(file: string): PredictionRow[] {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = {
    countyFips: header.indexOf("countyFips"),
    apn: header.indexOf("apn"),
    propensity12mo: header.indexOf("propensity12mo"),
  };
  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error(`--in CSV must have countyFips,apn,propensity12mo columns; got: ${header.join(",")}`);
  }
  return lines.slice(1).map((line, n) => {
    const cells = line.split(",");
    const parsed = PredictionRow.safeParse({
      countyFips: cells[idx.countyFips],
      apn: cells[idx.apn],
      propensity12mo: cells[idx.propensity12mo],
    });
    if (!parsed.success) {
      throw new Error(`row ${n + 2}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    return parsed.data;
  });
}

/** Preflight: bail with instructions if the M2.3 patch hasn't been pushed. */
async function assertPatchApplied(): Promise<void> {
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'flipops' AND table_name = 'TaxDelinquencySummary'
       AND column_name IN ('propensity12mo', 'propensityModelVersionId')`,
  );
  if (cols.length < 2) {
    console.error(
      "[apply] TaxDelinquencySummary is missing propensity12mo/propensityModelVersionId.\n" +
        "[apply] Apply prisma/schema.patch.ml.prisma to schema.prisma, then `npx prisma db push`.",
    );
    process.exit(2);
  }
}

/**
 * Refuse to publish scores from an unknown/unpromoted ModelVersion unless
 * --force (SCORING-ARCHITECTURE invariant #1/#2). Soft-skips when the
 * ModelVersion table itself predates the patch.
 */
async function assertVersionPromoted(modelVersionId: string, force: boolean): Promise<void> {
  const table = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'flipops' AND table_name = 'ModelVersion'`,
  );
  if (table.length === 0) {
    console.warn("[apply] ModelVersion table not found — skipping promotion check (patch not applied yet).");
    return;
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; promoted: boolean }>>(
    `SELECT "id", "promoted" FROM flipops."ModelVersion" WHERE "id" = $1`,
    modelVersionId,
  );
  if (rows.length === 0) {
    console.error(`[apply] no ModelVersion row with id=${modelVersionId} — insert one first (README step 4).`);
    process.exit(2);
  }
  if (!rows[0].promoted && !force) {
    console.error(`[apply] ModelVersion ${modelVersionId} is not promoted. Pass --force to apply anyway.`);
    process.exit(2);
  }
}

async function applyChunk(rows: PredictionRow[], modelVersionId: string): Promise<number> {
  // UPDATE ... FROM (VALUES ...) — one bounded statement per chunk.
  const values: string[] = [];
  const params: unknown[] = [modelVersionId]; // $1
  rows.forEach((r, i) => {
    const base = 1 + i * 3;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}::float)`);
    params.push(r.countyFips, r.apn, r.propensity12mo);
  });
  const sql = `
    UPDATE flipops."TaxDelinquencySummary" t SET
      "propensity12mo"           = v.p,
      "propensityModelVersionId" = $1
    FROM (VALUES ${values.join(", ")}) AS v("countyFips", "apn", p)
    WHERE t."countyFips" = v."countyFips" AND t."apn" = v."apn"
  `;
  return prisma.$executeRawUnsafe(sql, ...params);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const inFile = get("--in");
  const modelVersionId = get("--model-version");
  const force = argv.includes("--force");
  const limit = get("--limit") ? Number(get("--limit")) : undefined; // LIMIT-test small batches first
  if (!inFile || !modelVersionId) {
    console.error(
      "usage: npx tsx scripts/ml/apply-predictions.ts --in <predictions.csv> " +
        "--model-version <ModelVersion.id> [--limit N] [--force]",
    );
    process.exit(1);
  }

  let rows = readPredictionsCsv(inFile);
  if (limit) rows = rows.slice(0, limit);
  console.log(`[apply] ${rows.length} predictions from ${inFile} (modelVersion=${modelVersionId})`);

  await assertPatchApplied();
  await assertVersionPromoted(modelVersionId, force);

  const start = Date.now();
  let updated = 0;
  for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
    updated += await applyChunk(rows.slice(i, i + CHUNK_ROWS), modelVersionId);
    if ((i / CHUNK_ROWS) % 20 === 0) {
      console.log(`[apply] … ${Math.min(i + CHUNK_ROWS, rows.length)}/${rows.length} (updated=${updated})`);
    }
  }

  // updated < rows.length is EXPECTED when predictions include parcels whose
  // summary row was since deleted/re-keyed — report, don't fail.
  console.log(
    `[apply] done: ${updated}/${rows.length} summary rows updated in ${((Date.now() - start) / 1000).toFixed(1)}s` +
      (updated < rows.length ? ` (${rows.length - updated} predictions had no matching summary row)` : ""),
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
