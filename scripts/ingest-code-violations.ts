/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M3.2 (B3) — code-enforcement violation ingester (open-data first).
//
//   DATABASE_URL=... npx tsx scripts/ingest-code-violations.ts \
//     --source miamidade [--limit 500] [--dry-run] [--all-statuses]
//
// Sources (slugs in lib/data-sources/code-enforcement/index.ts):
//   miamidade  — ArcGIS FeatureServer (Open view), FOLIO join 99.6% (GREEN)
//   orlando    — Socrata SoQL,  parcel_id join ~3.8% (GREEN; address-resolve TODO)
//
// FLOW:  source.fetch() → resolveApns() (Tier-1 direct folio + Tier-2
//        unique-address) → report join-rate → persistViolations() (TYPED
//        prisma.codeViolation.upsert; schema is pushed). --dry-run NEVER
//        writes — it reports parsed counts + join-rate only (the smoke mode).
//
// After persisting, run scripts/rescore-code-violations.ts to refresh the
// CodeViolationSummary mart that the scorer's CONDITION_FAMILY signals read.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import {
  getSource,
  CODE_ENFORCEMENT_SOURCES,
  resolveApns,
  persistViolations,
} from "@/lib/data-sources/code-enforcement";

interface Opts {
  source: string;
  limit?: number;
  dryRun: boolean;
  openOnly: boolean;
}

function parseArgs(argv: string[]): Opts {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    source: get("--source") ?? "miamidade",
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    dryRun: argv.includes("--dry-run"),
    openOnly: !argv.includes("--all-statuses"),
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const src = getSource(opts.source);
  if (!src) {
    console.error(
      `[ingest-code] unknown --source "${opts.source}". Known: ${Object.keys(CODE_ENFORCEMENT_SOURCES).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[ingest-code] source=${src.source} (${src.city}/${src.countyFips}, ${src.format}) ` +
      `openOnly=${opts.openOnly} limit=${opts.limit ?? "∞"} dryRun=${opts.dryRun}`,
  );

  // 1. Fetch + normalize (paginated inside the adapter).
  const t0 = Date.now();
  const rows = await src.fetch({ openOnly: opts.openOnly, limit: opts.limit });
  console.log(`[ingest-code] fetched+parsed ${rows.length} violations in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Quick category/lien/status breakdown for the operator.
  const byCat = new Map<string, number>();
  let openCount = 0;
  let lienCount = 0;
  let withFolio = 0;
  for (const r of rows) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
    if (r.status === "open") openCount++;
    if (r.isLien) lienCount++;
    if (r.rawParcelId) withFolio++;
  }
  console.log(
    `[ingest-code] status: ${openCount} open · liens: ${lienCount} · with raw parcel id: ${withFolio}/${rows.length}`,
  );
  console.log(`[ingest-code] categories: ${[...byCat.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);

  // 2. Resolve APNs (Tier-1 direct folio + Tier-2 unique-address) + join-rate.
  const { resolved, stats } = await resolveApns(rows);
  const linked = stats.directFolio + stats.uniqueAddress;
  const joinPct = stats.total ? ((100 * linked) / stats.total).toFixed(1) : "0.0";
  console.log(
    `[ingest-code] APN join-rate: ${linked}/${stats.total} = ${joinPct}% ` +
      `(direct-folio ${stats.directFolio} · unique-address ${stats.uniqueAddress}) · unresolved: ${stats.none}`,
  );

  // 3. Persist (typed upsert) — skipped entirely on --dry-run.
  if (opts.dryRun) {
    console.log(
      `[ingest-code] DRY-RUN — no writes. ` +
        `Would upsert ${resolved.length} rows (${linked} parcel-linked).`,
    );
  } else {
    const pstats = await persistViolations(resolved);
    console.log(`[ingest-code] persisted ${pstats.written}/${pstats.attempted} rows (upsert).`);
  }

  await prisma.$disconnect();
  console.log(`[ingest-code] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
