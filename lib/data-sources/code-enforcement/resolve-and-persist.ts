import { prisma } from "@/lib/prisma";
import type { NormalizedViolation } from "./types";

// ---------------------------------------------------------------------------
// M3.2 — APN resolution + TYPED persistence for code-enforcement rows.
//
// SCHEMA IS PUSHED (Wave D2a): CodeViolation / CodeViolationSummary are now
// generated Prisma-client models, so persistence is typed
// `prisma.codeViolation.upsert` on the unique (countyFips, sourceCaseId,
// source). The information_schema-guarded raw-SQL path is gone.
//
// Join strategy (CODE-ENFORCEMENT-SPEC §Join Strategy):
//   - Tier 1 (direct-folio): verify each feed folio exists in Parcel for the
//     county. Miami-Dade FOLIO @ 99.6% — the production path.
//   - Tier 2 (unique-address): best-effort situsAddress normalized-prefix
//     resolver for feeds whose folio diverges from the DOR PARCEL_ID
//     (Orlando @ ~3.8% folio). Confidence-tagged; only accepts a match when the
//     normalized address prefix maps to EXACTLY ONE parcel in the county
//     (ambiguous → left null). Rows that resolve neither tier persist with
//     parcelApn=null (kept, never dropped — the address is still a locator and
//     a later fuzzy pass / Accela enrich can backfill the APN).
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

/**
 * Normalize a street address to a comparable prefix: uppercase, collapse
 * whitespace, strip unit/suite designators and trailing punctuation. Used by
 * the Tier-2 resolver to match feed addresses against Parcel.situsAddress.
 * Best-effort — returns null when there's no usable street component.
 */
function normalizeAddressPrefix(addr: string | null | undefined): string | null {
  if (!addr) return null;
  let s = addr.toUpperCase().trim();
  // Drop everything after a comma (city/state/zip tail) and unit markers.
  s = s.split(",")[0];
  s = s.replace(/\b(APT|UNIT|STE|SUITE|#|BLDG|FL|FLOOR|LOT)\b.*$/i, "");
  s = s.replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return s.length >= 5 ? s : null;
}

/**
 * Resolve APNs in two tiers. Mutates nothing; returns resolved rows + stats.
 *
 * Tier 1 runs for every county (folio verification against Parcel). Tier 2
 * runs only for rows that Tier 1 left unresolved AND that carry an address —
 * it bulk-loads candidate situsAddress prefixes per county and accepts a match
 * only when the prefix is unique within the county.
 */
export async function resolveApns(
  rows: NormalizedViolation[],
): Promise<{ resolved: ResolvedViolation[]; stats: JoinStats }> {
  // ---- Tier 1: direct-folio verification ----
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
    }
    resolved.push({ ...r, parcelApn, apnTier });
  }

  // ---- Tier 2: unique-address resolution for the Tier-1 misses ----
  // Collect the normalized address prefixes that still need a parcel, grouped
  // by county. Skip counties with no unresolved address rows.
  const needByCounty = new Map<string, Map<string, ResolvedViolation[]>>();
  for (const r of resolved) {
    if (r.apnTier !== "none") continue;
    const prefix = normalizeAddressPrefix(r.address);
    if (!prefix) continue;
    if (!needByCounty.has(r.countyFips)) needByCounty.set(r.countyFips, new Map());
    const m = needByCounty.get(r.countyFips)!;
    if (!m.has(prefix)) m.set(prefix, []);
    m.get(prefix)!.push(r);
  }

  for (const [county, prefixMap] of needByCounty) {
    const prefixes = [...prefixMap.keys()];
    // Bulk-query Parcel for these prefixes. We match on a normalized situs
    // prefix: UPPER(situsAddress) starting with the candidate prefix. Group by
    // prefix to enforce uniqueness (count of distinct apns).
    for (let i = 0; i < prefixes.length; i += 300) {
      const chunk = prefixes.slice(i, i + 300);
      if (chunk.length === 0) continue;
      // For each candidate prefix find parcels whose normalized situsAddress
      // equals the prefix (exact normalized match — conservative). Returns at
      // most one row per (prefix) only when exactly one apn matches.
      const hits = await prisma.$queryRawUnsafe<
        Array<{ prefix: string; apn: string; n: bigint }>
      >(
        `WITH cand(prefix) AS (
           SELECT UNNEST($2::text[])
         ),
         norm AS (
           SELECT
             p.apn,
             REGEXP_REPLACE(
               REGEXP_REPLACE(UPPER(SPLIT_PART(p."situsAddress", ',', 1)), '[^A-Z0-9 ]', ' ', 'g'),
               '\\s+', ' ', 'g'
             ) AS sit
           FROM flipops."Parcel" p
           WHERE p."countyFips" = $1 AND p."situsAddress" IS NOT NULL
         )
         SELECT c.prefix, MIN(n.apn) AS apn, COUNT(DISTINCT n.apn)::bigint AS n
         FROM cand c
         JOIN norm n ON TRIM(n.sit) = c.prefix
         GROUP BY c.prefix
         HAVING COUNT(DISTINCT n.apn) = 1`,
        county,
        chunk,
      );
      for (const h of hits) {
        const targets = prefixMap.get(h.prefix);
        if (!targets) continue;
        for (const t of targets) {
          t.parcelApn = h.apn;
          t.apnTier = "unique-address";
          stats.uniqueAddress++;
        }
      }
    }
  }

  // Final unresolved count.
  stats.none = resolved.filter((r) => r.apnTier === "none").length;
  return { resolved, stats };
}

export interface PersistStats {
  attempted: number;
  written: number;
  skippedNoTable: boolean;
}

/**
 * Upsert resolved rows into CodeViolation via typed prisma.codeViolation.upsert
 * on the unique (countyFips, sourceCaseId, source). Sequential per-row upserts
 * chunked into batches with a short micro-pause between chunks (OPERATIONS.md:
 * never one statewide mega-statement on the Railway proxy). Returns counts;
 * `skippedNoTable` stays false now that the schema is pushed.
 */
export async function persistViolations(rows: ResolvedViolation[]): Promise<PersistStats> {
  const stats: PersistStats = { attempted: rows.length, written: 0, skippedNoTable: false };
  if (rows.length === 0) return stats;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // Upserts within a chunk run concurrently (bounded by the chunk size); each
    // is an independent statement so a single bad row can't abort the batch.
    const results = await Promise.allSettled(
      chunk.map((r) =>
        prisma.codeViolation.upsert({
          where: {
            countyFips_sourceCaseId_source: {
              countyFips: r.countyFips,
              sourceCaseId: r.sourceCaseId,
              source: r.source,
            },
          },
          create: {
            countyFips: r.countyFips,
            parcelApn: r.parcelApn,
            sourceCaseId: r.sourceCaseId,
            source: r.source,
            address: r.address,
            city: r.city,
            zip: r.zip,
            violationType: r.violationType,
            category: r.category,
            status: r.status,
            rawStatus: r.rawStatus,
            openedAt: r.openedAt,
            closedAt: r.closedAt,
            isLien: r.isLien,
            lienRecordedAt: r.lienRecordedAt,
            lienBook: r.lienBook,
            lienPage: r.lienPage,
            latitude: r.latitude,
            longitude: r.longitude,
          },
          update: {
            parcelApn: r.parcelApn,
            address: r.address,
            city: r.city,
            zip: r.zip,
            violationType: r.violationType,
            category: r.category,
            status: r.status,
            rawStatus: r.rawStatus,
            openedAt: r.openedAt,
            closedAt: r.closedAt,
            isLien: r.isLien,
            lienRecordedAt: r.lienRecordedAt,
            lienBook: r.lienBook,
            lienPage: r.lienPage,
            latitude: r.latitude,
            longitude: r.longitude,
          },
        }),
      ),
    );
    for (const res of results) {
      if (res.status === "fulfilled") stats.written++;
    }
    // Micro-pause between chunks so the Railway PG proxy can checkpoint WAL.
    if (i + CHUNK < rows.length) await new Promise((r) => setTimeout(r, 50));
  }
  return stats;
}
