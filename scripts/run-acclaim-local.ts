import { prisma } from "@/lib/prisma";
import {
  ACCLAIM_COUNTIES,
  scrapeAcclaimCounty,
} from "@/lib/scrapers/vendors/acclaim-records";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.1a Acclaim official-records family
// adapter (Duval + Broward mortgages/liens).
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-acclaim-local.ts
//     [--county 12031]... [--days 7] [--max-pages 60]
//
// Defaults: both ACCLAIM_COUNTIES, trailing 7-day recording window.
// Direct egress per county config (both verified direct 2026-06-10).
// Creates a BulkIngestJob audit row per county run (manual-script trigger),
// then prints per-doc-family persistence + APN join-rate verification SQL.
// ---------------------------------------------------------------------------

function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

/**
 * Idempotent upsert of THIS source's ScrapeRegistry row (mirrors
 * prisma/seed-scrape-registry.ts — only touches acclaim-official-records).
 * Needed because BulkIngestJob.sourceKey is an FK onto ScrapeRegistry.
 */
async function ensureRegistryRow(): Promise<void> {
  const data = {
    domain: "officialrecords.broward.org",
    countyFips: null as string | null,
    state: "FL",
    scraperFn: "scrapeAcclaimCounty",
    cronExpr: "0 12 * * 2", // weekly Tuesdays — keep in sync with seed-scrape-registry.ts
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "none",
    notes:
      "Acclaim ORI family: doc-type+date-range search → Mortgage/Lien upserts (source=scraper:acclaim-ori) + satisfaction release-matching. lastHighWaterMark = ISO date scraped through.",
  };
  await prisma.scrapeRegistry.upsert({
    where: { sourceKey: "acclaim-official-records" },
    create: { sourceKey: "acclaim-official-records", enabled: true, bootstrapping: true, ...data },
    update: data,
  });
}

async function main() {
  await ensureRegistryRow();
  const countyArgs = argValues("--county");
  const days = parseInt(argValues("--days")[0] ?? "7", 10);
  const maxPages = parseInt(argValues("--max-pages")[0] ?? "60", 10);
  const fipsList =
    countyArgs.length > 0 ? countyArgs : ACCLAIM_COUNTIES.map((c) => c.countyFips);

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  for (const fips of fipsList) {
    const county = ACCLAIM_COUNTIES.find((c) => c.countyFips === fips);
    if (!county) {
      console.warn(`SKIP ${fips}: not in ACCLAIM_COUNTIES`);
      continue;
    }
    console.log(`\n=== ${county.county} (${fips}) — ${county.baseUrl} [direct=${!county.useProxy}] ===`);

    const audit = await prisma.bulkIngestJob.create({
      data: {
        sourceTag: `scraper:acclaim-ori-${fips}`,
        scope: fips,
        status: "running",
        triggerType: "manual-script",
        sourceKey: "acclaim-official-records",
      },
    });
    const t0 = Date.now();
    try {
      const r = await scrapeAcclaimCounty({ countyFips: fips, from, to, maxPages });
      await prisma.bulkIngestJob.update({
        where: { id: audit.id },
        data: {
          status: "succeeded",
          recordsFetched: r.found,
          recordsUpserted: r.persistedMortgages + r.persistedLiens,
          rejectCount: r.rejected,
          finishedAt: new Date(),
          durationMs: Date.now() - t0,
          runStatsJson: JSON.parse(JSON.stringify(r)),
        },
      });
      const joinable =
        r.apnJoin.direct + r.apnJoin.uniqueName + r.apnJoin.ambiguous + r.apnJoin.none;
      const joined = r.apnJoin.direct + r.apnJoin.uniqueName;
      console.log(
        `  window ${r.from}..${r.to} | found=${r.found} pages=${r.pages} requests=${r.requests} docTypes=${r.docTypeIdsSelected}`,
      );
      console.log(`  byFamily: ${JSON.stringify(r.byFamily)}`);
      console.log(
        `  persisted: mortgages=${r.persistedMortgages} liens=${r.persistedLiens} | satisfactions applied=${r.satisfactionsApplied} skipped=${r.satisfactionsSkipped} | rejected=${r.rejected}`,
      );
      console.log(
        `  APN join: direct=${r.apnJoin.direct} unique-name=${r.apnJoin.uniqueName} ambiguous=${r.apnJoin.ambiguous} none=${r.apnJoin.none} → ${joinable > 0 ? ((100 * joined) / joinable).toFixed(1) : "0"}% joined`,
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
    await new Promise((res) => setTimeout(res, 3000));
  }

  // Post-run DB verification: persisted rows + APN join rate per county/table.
  const mtg = await prisma.$queryRaw<
    Array<{ countyFips: string; n: number; with_apn: number; min_d: Date | null; max_d: Date | null }>
  >`
    SELECT "countyFips", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn,
           MIN("recordingDate") AS min_d, MAX("recordingDate") AS max_d
    FROM flipops."Mortgage" WHERE source = 'scraper:acclaim-ori'
    GROUP BY "countyFips" ORDER BY "countyFips"`;
  console.log(`\nMortgage rows WHERE source='scraper:acclaim-ori':`);
  for (const r of mtg) {
    console.log(
      `  ${r.countyFips} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%) range=${r.min_d?.toISOString().slice(0, 10)}..${r.max_d?.toISOString().slice(0, 10)}`,
    );
  }

  const liens = await prisma.$queryRaw<
    Array<{ countyFips: string; lienCategory: string; n: number; with_apn: number }>
  >`
    SELECT "countyFips", "lienCategory", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn
    FROM flipops."Lien" WHERE source = 'scraper:acclaim-ori'
    GROUP BY "countyFips", "lienCategory" ORDER BY "countyFips", "lienCategory"`;
  console.log(`\nLien rows WHERE source='scraper:acclaim-ori':`);
  for (const r of liens) {
    console.log(
      `  ${r.countyFips} ${r.lienCategory.padEnd(12)} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%)`,
    );
  }

  const released = await prisma.$queryRaw<Array<{ t: string; n: number }>>`
    SELECT 'mortgage' AS t, COUNT(*)::int AS n FROM flipops."Mortgage"
      WHERE source = 'scraper:acclaim-ori' AND "releasedAt" IS NOT NULL
    UNION ALL
    SELECT 'lien', COUNT(*)::int FROM flipops."Lien"
      WHERE source = 'scraper:acclaim-ori' AND "releasedAt" IS NOT NULL`;
  console.log(`\nReleased (satisfaction-matched) acclaim-ori rows:`);
  for (const r of released) console.log(`  ${r.t}: ${r.n}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
