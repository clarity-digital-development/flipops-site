import { prisma } from "@/lib/prisma";
import type { NormalizedViolation } from "./types";

// ---------------------------------------------------------------------------
// M3.2 (B3) — APN resolution + guarded persistence for code-enforcement rows.
//
// SCHEMA-NOT-PUSHED-YET CONTRACT (mirrors scripts/ml/export-training-data.ts):
// the CodeViolation / CodeViolationSummary models live in
// prisma/schema.patch.code.prisma and are NOT in the generated Prisma client
// this wave. So:
//   - APN resolution is raw SQL against the EXISTING Parcel table (typed rows).
//   - Persistence is raw $executeRawUnsafe, GUARDED by an information_schema
//     probe (tableExists) so a real run no-ops cleanly until the orchestrator
//     pushes the patch. The ingester's --dry-run never calls persist at all.
// This file therefore compiles and runs today; the moment the patch is pushed,
// `tableExists` flips true and the same INSERT path writes for real.
// ---------------------------------------------------------------------------

export type ApnJoinTier = "direct-folio" | "unique-address" | "none";

export interface ResolvedViolation extends NormalizedViolation {
  parcelApn: string | null;
  apnTier: ApnJoinTier;
}

export interface JoinStats {
  total: number;
  directFolio: number;
  uniqueAddress: number;
  none: number;
}

/** Has the schema patch been pushed? Gates real persistence. */
export async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'flipops' AND table_name = $1
     ) AS exists`,
    table,
  );
  return rows[0]?.exists === true;
}

/**
 * Tier-1 direct-folio resolution against flipops."Parcel". Verifies each feed
 * folio actually exists for the county (the Miami-Dade 99.6% path). Mutates
 * rows in place and returns join stats. Address-tier (Tier 2) is left as a
 * stub here — it requires the situsAddress fuzzy index (spec §Join Strategy);
 * Orlando rows stay parcelApn=null until that resolver lands.
 */
export async function resolveApns(
  rows: NormalizedViolation[],
): Promise<{ resolved: ResolvedViolation[]; stats: JoinStats }> {
  // Group folios by county for a chunked verification query.
  const byCounty = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.rawParcelId) continue;
    if (!byCounty.has(r.countyFips)) byCounty.set(r.countyFips, new Set());
    byCounty.get(r.countyFips)!.add(r.rawParcelId);
  }

  const verified = new Map<string, Set<string>>(); // county -> set of existing apns
  for (const [county, folioSet] of byCounty) {
    const folios = [...folioSet];
    const hitSet = new Set<string>();
    for (let i = 0; i < folios.length; i += 500) {
      const chunk = folios.slice(i, i + 500);
      if (chunk.length === 0) continue;
      const hits = await prisma.$queryRawUnsafe<Array<{ apn: string }>>(
        `SELECT apn FROM flipops."Parcel" WHERE "countyFips" = $1 AND apn = ANY($2::text[])`,
        county,
        chunk,
      );
      for (const h of hits) hitSet.add(h.apn);
    }
    verified.set(county, hitSet);
  }

  const resolved: ResolvedViolation[] = [];
  const stats: JoinStats = { total: rows.length, directFolio: 0, uniqueAddress: 0, none: 0 };
  for (const r of rows) {
    let parcelApn: string | null = null;
    let apnTier: ApnJoinTier = "none";
    if (r.rawParcelId && verified.get(r.countyFips)?.has(r.rawParcelId)) {
      parcelApn = r.rawParcelId;
      apnTier = "direct-folio";
      stats.directFolio++;
    } else {
      stats.none++;
    }
    resolved.push({ ...r, parcelApn, apnTier });
  }
  return { resolved, stats };
}

export interface PersistStats {
  attempted: number;
  written: number;
  skippedNoTable: boolean;
}

/**
 * Upsert resolved rows into CodeViolation via raw SQL ON CONFLICT, guarded by
 * tableExists. Chunked INSERTs (per OPERATIONS.md: never a single statewide
 * mega-statement on the Railway proxy). Returns counts; a missing table is a
 * clean no-op (skippedNoTable=true), not an error.
 */
export async function persistViolations(rows: ResolvedViolation[]): Promise<PersistStats> {
  const stats: PersistStats = { attempted: rows.length, written: 0, skippedNoTable: false };
  if (rows.length === 0) return stats;
  if (!(await tableExists("CodeViolation"))) {
    stats.skippedNoTable = true;
    return stats;
  }

  const CHUNK = 200; // well under the 32767 bind-var cap (we use json, but stay polite)
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // Build a multi-VALUES INSERT with positional params.
    const cols = [
      "countyFips",
      "parcelApn",
      "sourceCaseId",
      "source",
      "address",
      "city",
      "zip",
      "violationType",
      "category",
      "status",
      "rawStatus",
      "openedAt",
      "closedAt",
      "isLien",
      "lienRecordedAt",
      "lienBook",
      "lienPage",
      "latitude",
      "longitude",
    ];
    const params: unknown[] = [];
    const valueRows: string[] = [];
    for (const r of chunk) {
      const base = params.length;
      params.push(
        r.countyFips,
        r.parcelApn,
        r.sourceCaseId,
        r.source,
        r.address,
        r.city,
        r.zip,
        r.violationType,
        r.category,
        r.status,
        r.rawStatus,
        r.openedAt,
        r.closedAt,
        r.isLien,
        r.lienRecordedAt,
        r.lienBook,
        r.lienPage,
        r.latitude,
        r.longitude,
      );
      const ph = cols.map((_, j) => `$${base + j + 1}`);
      // cuid() default is generated by Prisma only; for raw SQL we let the DB
      // generate id via gen_random_uuid()-style — but the model uses @default(cuid())
      // which is app-side. So we must supply an id. Use md5-based deterministic id.
      valueRows.push(`(${ph.join(",")})`);
    }
    const sql = `
      INSERT INTO flipops."CodeViolation" (
        "id", ${cols.map((c) => `"${c}"`).join(", ")}, "capturedAt", "updatedAt"
      )
      SELECT
        'cv_' || encode(digest(v."countyFips" || ':' || v."sourceCaseId" || ':' || v."source", 'sha256'), 'hex'),
        ${cols.map((c) => `v."${c}"`).join(", ")},
        NOW(), NOW()
      FROM ( VALUES ${valueRows.join(", ")} ) AS v(${cols.map((c) => `"${c}"`).join(", ")})
      ON CONFLICT ("countyFips", "sourceCaseId", "source") DO UPDATE SET
        "parcelApn"     = EXCLUDED."parcelApn",
        "address"       = EXCLUDED."address",
        "violationType" = EXCLUDED."violationType",
        "category"      = EXCLUDED."category",
        "status"        = EXCLUDED."status",
        "rawStatus"     = EXCLUDED."rawStatus",
        "openedAt"      = EXCLUDED."openedAt",
        "closedAt"      = EXCLUDED."closedAt",
        "isLien"        = EXCLUDED."isLien",
        "lienRecordedAt"= EXCLUDED."lienRecordedAt",
        "lienBook"      = EXCLUDED."lienBook",
        "lienPage"      = EXCLUDED."lienPage",
        "latitude"      = EXCLUDED."latitude",
        "longitude"     = EXCLUDED."longitude",
        "updatedAt"     = NOW()
    `;
    const affected = await prisma.$executeRawUnsafe(sql, ...params);
    stats.written += typeof affected === "number" ? affected : chunk.length;
  }
  return stats;
}
