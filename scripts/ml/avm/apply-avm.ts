/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M3.3 AVM v1 — Apply a trained AVM to every parcel, writing ParcelValuation.
//
// DEFERRED TO THE BUILD WAVE: the ParcelValuation table is in
// prisma/schema.patch.avm.prisma and is NOT pushed yet. This script is written
// now (so the loop is complete) but is information_schema-GUARDED: it checks
// flipops."ParcelValuation" exists and EXITS CLEANLY (code 0) if not. Once the
// orchestrator pushes the patch, run it for real.
//
//   DATABASE_URL=... npx tsx scripts/ml/avm/apply-avm.ts \
//     --metros 12086,12011 \
//     --model scripts/ml/avm/out/model-v1/model.txt \
//     --metrics scripts/ml/avm/out/model-v1/metrics.json \
//     --model-version-id <ModelVersion.id from register-model-version> \
//     [--dry-run] [--chunk 150000]
//
// SCORING-ARCHITECTURE invariants:
//   #1 every stored estimate carries modelVersionId (provenance).
//   #2 refuse to apply unless the named ModelVersion is `promoted=true`
//      (unless --force) — never serve estimates from an unpromoted model.
//
// HOW IT SCORES: LightGBM serving in pure TS is not worth a dependency for v1.
// Instead apply-avm.ts shells out to train_avm.py's sibling scorer is overkill;
// the pragmatic v1 path is to score via a small Python predict step that reads
// model.txt + the same ParcelFeature columns the exporter used, emits a CSV of
// (countyFips, apn, estimatedValue), and this script UPSERTs that CSV in
// chunked batches. To keep this file self-contained and dependency-light, it
// accepts a --predictions CSV (countyFips,apn,estimatedValue) produced by that
// step and does ONLY the guarded, chunked UPSERT — the part that touches the DB
// and must obey the Railway-proxy chunking rule (OPERATIONS.md: chunk ~150K,
// proxy kills silent long statements).
//
// Typed against raw SQL ($queryRawUnsafe / $executeRawUnsafe) by design so it
// compiles BEFORE the ParcelValuation model is generated.
// ---------------------------------------------------------------------------

import * as fs from "fs";
import { prisma } from "../../../lib/prisma";

interface ApplyOpts {
  predictions: string; // CSV: countyFips,apn,estimatedValue[,lowEstimate,highEstimate]
  modelVersionId: string;
  bandPct: number; // residual band from metrics.json (low/high when CSV omits them)
  chunk: number;
  dryRun: boolean;
  force: boolean;
}

interface PredRow {
  countyFips: string;
  apn: string;
  estimatedValue: number;
  lowEstimate: number | null;
  highEstimate: number | null;
}

async function tableExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'flipops' AND table_name = 'ParcelValuation'
     ) AS exists`,
  );
  return Boolean(rows[0]?.exists);
}

async function modelVersionPromoted(id: string): Promise<boolean | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ promoted: boolean }>>(
    `SELECT "promoted" FROM flipops."ModelVersion" WHERE id = $1`,
    id,
  );
  if (rows.length === 0) return null;
  return Boolean(rows[0].promoted);
}

function parsePredictions(path: string, bandPct: number): PredRow[] {
  const text = fs.readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines.shift()?.split(",").map((h) => h.trim()) ?? [];
  const idx = (name: string) => header.indexOf(name);
  const ci = idx("countyFips");
  const ai = idx("apn");
  const ei = idx("estimatedValue");
  const li = idx("lowEstimate");
  const hi = idx("highEstimate");
  if (ci < 0 || ai < 0 || ei < 0) {
    throw new Error(
      `--predictions CSV must have columns countyFips,apn,estimatedValue (got: ${header.join(",")})`,
    );
  }
  const out: PredRow[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    const est = Number(cells[ei]);
    if (!Number.isFinite(est) || est <= 0) continue;
    const low = li >= 0 && cells[li] ? Number(cells[li]) : est * (1 - bandPct);
    const high = hi >= 0 && cells[hi] ? Number(cells[hi]) : est * (1 + bandPct);
    out.push({
      countyFips: cells[ci],
      apn: cells[ai],
      estimatedValue: est,
      lowEstimate: Number.isFinite(low) ? low : null,
      highEstimate: Number.isFinite(high) ? high : null,
    });
  }
  return out;
}

async function upsertChunk(rows: PredRow[], modelVersionId: string): Promise<void> {
  // Build a multi-row VALUES UPSERT. 6 columns/row → PG 32767 bind-var cap
  // allows ~5400 rows/statement; we chunk far below that anyway. Bind params
  // are 1-indexed: ($1..$6),($7..$12),…
  const cols = ["countyFips", "apn", "estimatedValue", "lowEstimate", "highEstimate", "modelVersionId"];
  const values: unknown[] = [];
  const tuples: string[] = [];
  rows.forEach((r, i) => {
    const b = i * 6;
    tuples.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`);
    values.push(r.countyFips, r.apn, r.estimatedValue, r.lowEstimate, r.highEstimate, modelVersionId);
  });
  const sql =
    `INSERT INTO flipops."ParcelValuation" (${cols.map((c) => `"${c}"`).join(", ")}, "computedAt") ` +
    `VALUES ${tuples.map((t) => t.slice(0, -1) + `, now())`).join(", ")} ` +
    `ON CONFLICT ("countyFips", "apn") DO UPDATE SET ` +
    `"estimatedValue" = EXCLUDED."estimatedValue", ` +
    `"lowEstimate" = EXCLUDED."lowEstimate", ` +
    `"highEstimate" = EXCLUDED."highEstimate", ` +
    `"modelVersionId" = EXCLUDED."modelVersionId", ` +
    `"computedAt" = now()`;
  await prisma.$executeRawUnsafe(sql, ...values);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const opts: ApplyOpts = {
    predictions: get("--predictions") ?? "",
    modelVersionId: get("--model-version-id") ?? "",
    bandPct: Number(get("--band") ?? 0.15),
    chunk: Number(get("--chunk") ?? 2000),
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };

  // ---- GUARD: table must exist (deferred until the patch is pushed) --------
  if (!(await tableExists())) {
    console.log(
      "[avm-apply] flipops.\"ParcelValuation\" does not exist yet — " +
        "schema.patch.avm.prisma is not pushed. No-op (this is expected pre-build-wave). Exiting 0.",
    );
    await prisma.$disconnect();
    return;
  }
  if (!opts.predictions || !opts.modelVersionId) {
    console.error(
      "usage: apply-avm.ts --predictions <csv> --model-version-id <id> [--band 0.15] [--chunk 2000] [--dry-run] [--force]",
    );
    process.exit(1);
  }

  // ---- GUARD: only serve from a promoted ModelVersion (invariant #2) -------
  const promoted = await modelVersionPromoted(opts.modelVersionId);
  if (promoted === null) {
    console.error(`[avm-apply] ModelVersion id=${opts.modelVersionId} not found.`);
    process.exit(2);
  }
  if (!promoted && !opts.force) {
    console.error(
      `[avm-apply] ModelVersion id=${opts.modelVersionId} is NOT promoted. ` +
        "Refusing to write estimates from an unpromoted model (pass --force to override).",
    );
    process.exit(3);
  }

  const rows = parsePredictions(opts.predictions, opts.bandPct);
  console.log(
    `[avm-apply] ${rows.length} predictions, modelVersionId=${opts.modelVersionId}, ` +
      `chunk=${opts.chunk}, dryRun=${opts.dryRun}`,
  );
  if (opts.dryRun) {
    console.log("[avm-apply] dry-run — no writes. Sample:", rows.slice(0, 3));
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += opts.chunk) {
    const slice = rows.slice(i, i + opts.chunk);
    await upsertChunk(slice, opts.modelVersionId);
    written += slice.length;
    console.log(`[avm-apply] upserted ${written}/${rows.length}`);
  }
  console.log(`[avm-apply] done: ${written} ParcelValuation rows upserted.`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
