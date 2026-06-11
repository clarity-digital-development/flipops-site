import { prisma } from "@/lib/prisma";
import { ingestHillsboroughRecords } from "@/lib/scrapers/vendors/hillsborough-records";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.1d Hillsborough official-records
// bulk-file ingester (mortgages/liens from publicrec.hillsclerk.com).
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-hillsborough-records-local.ts
//     [--max-vintages 5] [--since 20260501]
//
// Defaults: most-recent 5 daily vintages, direct egress (public IIS file
// server, verified direct 2026-06-11). Creates a BulkIngestJob audit row, then
// prints per-doc-family persistence + APN join-rate verification SQL.
// ---------------------------------------------------------------------------

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Idempotent upsert of THIS source's ScrapeRegistry row (mirrors
 * scripts/run-acclaim-local.ts). Needed because BulkIngestJob.sourceKey is an
 * FK onto ScrapeRegistry. The integration lane owns the canonical seed row.
 */
async function ensureRegistryRow(): Promise<void> {
  const data = {
    domain: "publicrec.hillsclerk.com",
    countyFips: "12057",
    state: "FL",
    scraperFn: "ingestHillsboroughRecords",
    cronExpr: "0 11 * * *", // daily 11:00 UTC — new index files post each business day
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "none",
    notes:
      "Hillsborough OR bulk-file ingester: D/P/M daily index files → Mortgage/Lien upserts (source=bulk:hillsborough-or) + satisfaction release-matching. lastHighWaterMark = YYYYMMDD of latest vintage ingested. 0-scrape public-data-files path (no HOVER, no subscription).",
  };
  await prisma.scrapeRegistry.upsert({
    where: { sourceKey: "hillsborough-official-records" },
    create: {
      sourceKey: "hillsborough-official-records",
      enabled: true,
      bootstrapping: true,
      ...data,
    },
    update: data,
  });
}

async function main() {
  await ensureRegistryRow();
  const maxVintages = parseInt(argValue("--max-vintages") ?? "5", 10);
  const sinceDateKey = argValue("--since");

  console.log(
    `\n=== Hillsborough OR (12057) — publicrec.hillsclerk.com [direct] maxVintages=${maxVintages}${sinceDateKey ? ` since=${sinceDateKey}` : ""} ===`,
  );

  const audit = await prisma.bulkIngestJob.create({
    data: {
      sourceTag: "bulk:hillsborough-or",
      scope: "12057",
      status: "running",
      triggerType: "manual-script",
      sourceKey: "hillsborough-official-records",
    },
  });
  const t0 = Date.now();

  try {
    const { vintages, latestDateKey } = await ingestHillsboroughRecords({
      maxVintages,
      sinceDateKey,
      useProxy: false,
    });

    let mtg = 0;
    let lien = 0;
    let sat = 0;
    let found = 0;
    let nameJoin = 0;
    let ambiguous = 0;
    let none = 0;
    for (const v of vintages) {
      mtg += v.persistedMortgages;
      lien += v.persistedLiens;
      sat += v.satisfactionsApplied;
      found += v.distress;
      nameJoin += v.apnJoin.uniqueName;
      ambiguous += v.apnJoin.ambiguous;
      none += v.apnJoin.none;
      console.log(
        `  ${v.dateKey}: docs=${v.docsTotal} distress=${v.distress} byFamily=${JSON.stringify(v.byFamily)} mtg=${v.persistedMortgages} lien=${v.persistedLiens} sat=${v.satisfactionsApplied}`,
      );
    }
    const joinable = nameJoin + ambiguous + none;

    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "succeeded",
        recordsFetched: found,
        recordsUpserted: mtg + lien,
        rejectCount: 0,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        runStatsJson: JSON.parse(JSON.stringify({ vintages, latestDateKey })),
      },
    });

    console.log(
      `\n  TOTAL vintages=${vintages.length} dir-latest=${latestDateKey} | distress=${found} mtg=${mtg} lien=${lien} sat=${sat}`,
    );
    console.log(
      `  APN join: unique-name=${nameJoin} ambiguous=${ambiguous} none=${none} → ${joinable > 0 ? ((100 * nameJoin) / joinable).toFixed(1) : "0"}% joined`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
      },
    });
    console.error(`  FAILED: ${message}`);
  }

  // Post-run DB verification: persisted rows + APN join rate.
  const mtgRows = await prisma.$queryRaw<
    Array<{ n: number; with_apn: number; min_d: Date | null; max_d: Date | null }>
  >`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn,
           MIN("recordingDate") AS min_d, MAX("recordingDate") AS max_d
    FROM flipops."Mortgage" WHERE source = 'bulk:hillsborough-or'`;
  console.log(`\nMortgage rows WHERE source='bulk:hillsborough-or':`);
  for (const r of mtgRows) {
    console.log(
      `  n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%) range=${r.min_d?.toISOString().slice(0, 10)}..${r.max_d?.toISOString().slice(0, 10)}`,
    );
  }

  const lienRows = await prisma.$queryRaw<
    Array<{ lienCategory: string; n: number; with_apn: number }>
  >`
    SELECT "lienCategory", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn
    FROM flipops."Lien" WHERE source = 'bulk:hillsborough-or'
    GROUP BY "lienCategory" ORDER BY "lienCategory"`;
  console.log(`\nLien rows WHERE source='bulk:hillsborough-or':`);
  for (const r of lienRows) {
    console.log(
      `  ${r.lienCategory.padEnd(12)} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%)`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
