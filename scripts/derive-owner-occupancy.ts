/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";
import { FL_COUNTIES } from "@/lib/data-sources/bulk/fl-counties";

// ---------------------------------------------------------------------------
// Derive Parcel.ownerOccupied — zero-cost signal from data already in hand
// (M1.8, AUDIT-A1/A2 cheap win).
//
// Heuristic: owner-occupied ⇔ situs address ≈ owner mailing address.
//   - Street line: UPPER, strip punctuation, collapse whitespace, compare the
//     first 12 characters. Situs street = Parcel.situsAddress (NAL PHY_ADDR1
//     [+ PHY_ADDR2]); mailing street = first comma-segment of
//     Parcel.ownerMailingAddress (NAL "OWN_ADDR1, [OWN_ADDR2,] OWN_CITY,
//     OWN_STATE, OWN_ZIPCD" — see lib/data-sources/bulk/fl-dor.ts).
//   - ZIP tiebreaker when BOTH sides carry one: first 5 digits of situsZip vs
//     the trailing 5(+4) digit run of ownerMailingAddress. ZIP mismatch vetoes
//     a street-prefix match (e.g. "123 MAIN ST" exists in two cities).
//   - Rows missing either side stay NULL (= unknown, NOT false).
//
// Execution: ONE set-based UPDATE per county (67 statements) — batching by
// countyFips avoids a single 11M-row transaction and keeps WAL pressure sane.
// Each statement runs inside its own transaction with SET LOCAL
// statement_timeout and synchronous_commit=OFF (the F1 BulkIngester pattern).
// Idempotent: re-runs simply recompute the flag.
//
// Usage:
//   DATABASE_URL=... npx tsx scripts/derive-owner-occupancy.ts                # all 67 counties
//   DATABASE_URL=... npx tsx scripts/derive-owner-occupancy.ts --county 12013 # one county (comma-list ok)
//   DATABASE_URL=... npx tsx scripts/derive-owner-occupancy.ts --dry-run      # counts only, no writes
//   ... --timeout-ms 120000                                                   # per-statement timeout override
//
// ---------------------------------------------------------------------------
// TODO(NEWLY_ABSENTEE) — year-over-year mailing-address diff. NOT BUILDABLE
// YET: only the 2025 NAL vintage exists anywhere (verified live 2026-06-10):
//   - Parcel.source     = 'bulk:fl-dor-2025' for all 10,998,035 rows
//   - Parcel.dataVintage = '2025' for all rows
//   - BulkIngestJob has only 'bulk:fl-dor-2025' / 'bulk:fl-dor-sdf-2025' tags
//     (all 2026-05-29)
//   - data/raw/fl-dor-2025/NAL holds a single '2025F' download
// Implementation plan AT NEXT VINTAGE INGEST (2026 NAL, ~mid-2026):
//   1. BEFORE upserting the new roll, snapshot the prior mailing state into a
//      slim table: ParcelOwnerVintage(countyFips, apn, dataVintage, ownerName,
//      ownerMailingAddress, ownerOccupied) — one INSERT...SELECT per county.
//   2. Ingest the 2026 roll (existing UPSERT path overwrites
//      ownerMailingAddress in place — without step 1 the prior vintage is
//      destroyed, which is why the diff cannot be reconstructed today).
//   3. Re-run THIS script for ownerOccupied on the new vintage.
//   4. NEWLY_ABSENTEE per county = parcels where prior vintage was
//      ownerOccupied=TRUE (or normalized mailing == situs) AND new vintage is
//      ownerOccupied=FALSE AND ownerName is unchanged (same owner moved away —
//      the high-motivation window; an owner CHANGE is a sale, not absenteeism).
//   5. Persist as Parcel.newlyAbsentee boolean (or vintage-stamped signal
//      table) + feed the scorer's ABSENTEE_FAMILY with a boost above the base
//      12-pt ABSENTEE_OWNER (newly-absentee is far stronger than steady-state
//      absentee). Wire into /api/properties UNION + promote like ownerOccupied.
// ---------------------------------------------------------------------------

interface CountyResult {
  fips: string;
  name: string;
  updated: number;
  occupied: number;
  absentee: number;
  skipped: number; // rows missing situs or mailing (left NULL)
  durationMs: number;
}

/**
 * SQL fragments shared by the live UPDATE and the dry-run SELECT.
 *
 * norm(street): UPPER → strip everything but [A-Z0-9 ] → collapse runs of
 * whitespace → trim → first 12 chars. Stripping punctuation to '' (not space)
 * makes "N.W." ≡ "NW" and "P.O BOX" ≡ "PO BOX".
 */
const NORM_SITUS = `LEFT(BTRIM(regexp_replace(regexp_replace(UPPER("situsAddress"), '[^A-Z0-9 ]', '', 'g'), '\\s+', ' ', 'g')), 12)`;
const NORM_MAIL = `LEFT(BTRIM(regexp_replace(regexp_replace(UPPER(split_part("ownerMailingAddress", ',', 1)), '[^A-Z0-9 ]', '', 'g'), '\\s+', ' ', 'g')), 12)`;
// situs zip: digits only, first 5. mailing zip: trailing 5(+4)-digit run.
const ZIP_SITUS = `NULLIF(LEFT(regexp_replace(COALESCE("situsZip", ''), '\\D', '', 'g'), 5), '')`;
const ZIP_MAIL = `(regexp_match("ownerMailingAddress", '(\\d{5})(?:-?\\d{4})?\\s*$'))[1]`;

/** Inner per-row computation: (id, occ boolean). Filtered to decidable rows.
 *  onlyUnset additionally restricts to rows not yet computed — the chunked
 *  loop's progress guarantee (occ is provably non-null for decidable rows,
 *  so every selected row leaves the NULL set once updated). */
function computeSql(fips: string, onlyUnset = false): string {
  return `
    SELECT
      "id",
      (
        LENGTH(situs_n) >= 4 AND LENGTH(mail_n) >= 4
        AND situs_n = mail_n
        AND (zip_s IS NULL OR zip_m IS NULL OR zip_s = zip_m)
      ) AS occ
    FROM (
      SELECT
        "id",
        ${NORM_SITUS} AS situs_n,
        ${NORM_MAIL}  AS mail_n,
        ${ZIP_SITUS}  AS zip_s,
        ${ZIP_MAIL}   AS zip_m
      FROM flipops."Parcel"
      WHERE "countyFips" = '${fips}'
        AND "situsAddress" IS NOT NULL
        AND "ownerMailingAddress" IS NOT NULL
        ${onlyUnset ? `AND "ownerOccupied" IS NULL` : ""}
    ) raw
  `;
}

async function runCounty(
  fips: string,
  name: string,
  opts: { dryRun: boolean; timeoutMs: number },
): Promise<CountyResult> {
  const start = Date.now();

  if (opts.dryRun) {
    const [row] = await prisma.$queryRawUnsafe<
      { total: bigint; would_true: bigint; would_false: bigint; skipped: bigint }[]
    >(`
      SELECT
        (SELECT COUNT(*) FROM flipops."Parcel" WHERE "countyFips" = '${fips}')::bigint AS total,
        COUNT(*) FILTER (WHERE c.occ)::bigint      AS would_true,
        COUNT(*) FILTER (WHERE NOT c.occ)::bigint  AS would_false,
        ((SELECT COUNT(*) FROM flipops."Parcel" WHERE "countyFips" = '${fips}') - COUNT(*))::bigint AS skipped
      FROM (${computeSql(fips)}) c
    `);
    return {
      fips,
      name,
      updated: Number(row.would_true) + Number(row.would_false),
      occupied: Number(row.would_true),
      absentee: Number(row.would_false),
      skipped: Number(row.skipped),
      durationMs: Date.now() - start,
    };
  }

  // Live: set-based UPDATE inside its own transaction. synchronous_commit=OFF
  // per the F1 BulkIngester pattern; explicit timeout because the Prisma
  // interactive-transaction default is 5s.
  //
  // chunkSize > 0 → CHUNKED loop over still-NULL rows. Required for the big
  // counties (300K+ rows): a single multi-minute UPDATE sends no wire traffic
  // while the server works, and the Railway TCP proxy kills the silent
  // connection ("Server has closed the connection"). Chunks of ~150-200K keep
  // each statement under ~2 min. Resumable by construction (onlyUnset).
  const runChunk = (limitClause: string, onlyUnset: boolean) =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${opts.timeoutMs}`);
        await tx.$executeRawUnsafe(`SET LOCAL synchronous_commit = OFF`);
        return tx.$executeRawUnsafe(`
          UPDATE flipops."Parcel" AS p
          SET "ownerOccupied" = c.occ,
              "updatedAt" = NOW()
          FROM (${computeSql(fips, onlyUnset)} ${limitClause}) c
          WHERE p."id" = c."id"
        `);
      },
      { timeout: Math.max(opts.timeoutMs + 30_000, 60_000) },
    );

  let updated = 0;
  if (opts.chunkSize > 0) {
    // Runaway guard: decidable rows / chunk + slack.
    const maxIters = Math.ceil(11_000_000 / opts.chunkSize) + 10;
    for (let i = 0; i < maxIters; i++) {
      const n = await runChunk(`LIMIT ${opts.chunkSize}`, true);
      updated += n;
      if (n > 0) {
        console.log(`    chunk ${i + 1}: +${n.toLocaleString()} (total ${updated.toLocaleString()})`);
      }
      if (n === 0) break;
    }
  } else {
    updated = await runChunk("", false);
  }

  // Cheap post-update breakdown for the progress log (countyFips is indexed).
  const [agg] = await prisma.$queryRawUnsafe<
    { occupied: bigint; absentee: bigint; skipped: bigint }[]
  >(`
    SELECT
      COUNT(*) FILTER (WHERE "ownerOccupied" IS TRUE)::bigint  AS occupied,
      COUNT(*) FILTER (WHERE "ownerOccupied" IS FALSE)::bigint AS absentee,
      COUNT(*) FILTER (WHERE "ownerOccupied" IS NULL)::bigint  AS skipped
    FROM flipops."Parcel"
    WHERE "countyFips" = '${fips}'
  `);

  return {
    fips,
    name,
    updated,
    occupied: Number(agg.occupied),
    absentee: Number(agg.absentee),
    skipped: Number(agg.skipped),
    durationMs: Date.now() - start,
  };
}

function parseArgs(argv: string[]) {
  const opts = { counties: [] as string[], dryRun: false, timeoutMs: 60_000, chunkSize: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--county" || a.startsWith("--county=")) {
      const v = a.includes("=") ? a.split("=")[1] : argv[++i];
      for (const c of (v ?? "").split(",")) {
        const fips = c.trim().replace(/[^0-9]/g, "");
        if (fips) opts.counties.push(fips);
      }
    } else if (a === "--chunk-size" || a.startsWith("--chunk-size=")) {
      const v = a.includes("=") ? a.split("=")[1] : argv[++i];
      const n = parseInt(v ?? "", 10);
      if (!isNaN(n) && n > 0) opts.chunkSize = n;
    } else if (a === "--timeout-ms" || a.startsWith("--timeout-ms=")) {
      const v = a.includes("=") ? a.split("=")[1] : argv[++i];
      const n = parseInt(v ?? "", 10);
      if (!isNaN(n) && n > 0) opts.timeoutMs = n;
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const targets =
    opts.counties.length > 0
      ? opts.counties.map((fips) => {
          const c = FL_COUNTIES.find((x) => x.fips === fips);
          if (!c) {
            console.error(`Unknown FL county FIPS: ${fips}`);
            process.exit(1);
          }
          return c;
        })
      : FL_COUNTIES;

  console.log(
    `derive-owner-occupancy: ${targets.length} count${targets.length === 1 ? "y" : "ies"}` +
      `${opts.dryRun ? " [DRY RUN — no writes]" : ""} (statement_timeout=${opts.timeoutMs}ms)`,
  );

  const totals = { updated: 0, occupied: 0, absentee: 0, skipped: 0 };
  let failures = 0;

  for (const county of targets) {
    try {
      const r = await runCounty(county.fips, county.name, opts);
      totals.updated += r.updated;
      totals.occupied += r.occupied;
      totals.absentee += r.absentee;
      totals.skipped += r.skipped;
      const pct = r.updated > 0 ? ((r.occupied / r.updated) * 100).toFixed(1) : "0.0";
      console.log(
        `  ${county.fips} ${county.name.padEnd(14)} ${opts.dryRun ? "would set" : "set"}=${r.updated}` +
          ` occupied=${r.occupied} (${pct}%) absentee=${r.absentee} null=${r.skipped}` +
          ` in ${(r.durationMs / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      failures++;
      console.error(`  ${county.fips} ${county.name} FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `DONE: ${opts.dryRun ? "would set" : "set"}=${totals.updated}` +
      ` occupied=${totals.occupied} absentee=${totals.absentee} null=${totals.skipped}` +
      `${failures > 0 ? ` — ${failures} count(ies) FAILED (re-run with --county to retry)` : ""}`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
