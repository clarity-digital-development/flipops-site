/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// check-probate-status.ts — read-only probate ingest health snapshot.
//
//   DATABASE_URL=... npx tsx scripts/check-probate-status.ts
//
// Prints: ProbateCase counts per source + per county, and the ScrapeRegistry
// state (enabled / cron / last run / cursor) for the probate sources — so you
// can see whether the reCAPTCHA-gated `probate-official-records` adapter is
// scheduled to run (Orange/Broward via 2captcha) and whether the free
// `pinellas-probate-csv` daily refresh is wired.
// ---------------------------------------------------------------------------
import { prisma } from "../lib/prisma";

async function main() {
  const total = await prisma.probateCase.count();
  const bySource = await prisma.probateCase.groupBy({
    by: ["source"],
    _count: { _all: true },
  });
  const byCounty = await prisma.probateCase.groupBy({
    by: ["countyFips"],
    _count: { _all: true },
  });

  console.log(`\n=== ProbateCase: ${total} total ===`);
  console.log("by source:");
  for (const r of bySource.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${(r.source ?? "(null)").padEnd(36)} ${r._count._all}`);
  }
  console.log("by countyFips:");
  for (const r of byCounty.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${r.countyFips}  ${r._count._all}`);
  }

  const reg = await prisma.scrapeRegistry.findMany({
    where: { sourceKey: { in: ["probate-official-records", "pinellas-probate-csv"] } },
    select: {
      sourceKey: true,
      domain: true,
      enabled: true,
      cronExpr: true,
      strategy: true,
      legalRisk: true,
      lastRunAt: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureReason: true,
      lastHighWaterMark: true,
      lastRowCount: true,
      consecutiveFails: true,
      pausedReason: true,
    },
  });

  console.log(`\n=== ScrapeRegistry (probate sources) ===`);
  const found = new Set(reg.map((r) => r.sourceKey));
  for (const r of reg) {
    console.log(`\n  ${r.sourceKey}`);
    console.log(`    enabled=${r.enabled}  cron="${r.cronExpr}"  strategy=${r.strategy}  legalRisk=${r.legalRisk}  domain=${r.domain}`);
    console.log(`    lastRunAt=${r.lastRunAt?.toISOString() ?? "never"}  lastSuccessAt=${r.lastSuccessAt?.toISOString() ?? "never"}`);
    console.log(`    lastHighWaterMark=${r.lastHighWaterMark ?? "-"}  lastRowCount=${r.lastRowCount ?? "-"}  consecutiveFails=${r.consecutiveFails}`);
    if (r.lastFailureReason) console.log(`    lastFailure=${r.lastFailureAt?.toISOString()} :: ${r.lastFailureReason.slice(0, 200)}`);
    if (r.pausedReason) console.log(`    PAUSED: ${r.pausedReason}`);
  }
  for (const key of ["probate-official-records", "pinellas-probate-csv"]) {
    if (!found.has(key)) console.log(`\n  ${key}: NO REGISTRY ROW (won't run via cron/trigger until inserted)`);
  }
}

main()
  .catch((err) => {
    console.error("check-probate-status FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
