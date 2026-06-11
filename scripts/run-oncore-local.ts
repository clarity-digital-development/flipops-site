import { prisma } from "@/lib/prisma";
import { ONCORE_COUNTIES, scrapeOnCoreCounty } from "@/lib/scrapers/vendors/oncore-records";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.1c OnCore/Eagle (Tyler) official-records
// family adapter (Orange mortgages/liens).
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-oncore-local.ts [--county 12095] [--days 7]
//
// Defaults: all ONCORE_COUNTIES (Orange only), trailing 7-day recording window.
// Direct egress per county config. Creates a BulkIngestJob audit row per county,
// then prints persistence + APN join-rate verification SQL.
//
// ⚠ Orange's OnCore doc search has migrated to Tyler's Self-Service SPA. The
// session mint is verified but the SPA search handshake is not yet replicable
// over plain HTTP, so a live run currently reports outcome=search-blocked with
// the precise blocker (and a bronze RawSnapshot). The runner exits 0 in that
// case — a blocker is the documented expected state, not a script failure.
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
 * prisma/seed-scrape-registry.ts). enabled=false until the SPA search lands.
 * Needed because BulkIngestJob.sourceKey is an FK onto ScrapeRegistry.
 */
async function ensureRegistryRow(): Promise<void> {
  const data = {
    domain: "selfservice.or.occompt.com",
    countyFips: "12095",
    state: "FL",
    scraperFn: "scrapeOnCoreCounty",
    cronExpr: "0 12 * * 3", // weekly Wednesdays — keep in sync with seed-scrape-registry.ts
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none",
    notes:
      "OnCore/Eagle (Tyler) ORI family, Orange. Doc search migrated to Self-Service SPA — session mint verified, SPA search handshake pending. Persists Mortgage/Lien (source=scraper:oncore-<fips>). enabled=false until search transport lands.",
  };
  await prisma.scrapeRegistry.upsert({
    where: { sourceKey: "oncore-official-records" },
    create: { sourceKey: "oncore-official-records", enabled: false, bootstrapping: true, ...data },
    update: data,
  });
}

async function main() {
  await ensureRegistryRow();
  const countyArgs = argValues("--county");
  const days = parseInt(argValues("--days")[0] ?? "7", 10);
  const fipsList = countyArgs.length > 0 ? countyArgs : ONCORE_COUNTIES.map((c) => c.countyFips);

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  for (const fips of fipsList) {
    const county = ONCORE_COUNTIES.find((c) => c.countyFips === fips);
    if (!county) {
      console.warn(`SKIP ${fips}: not in ONCORE_COUNTIES`);
      continue;
    }
    console.log(`\n=== ${county.county} (${fips}) — ${county.selfServiceBaseUrl} [direct=${!county.useProxy}] ===`);

    const audit = await prisma.bulkIngestJob.create({
      data: {
        sourceTag: `scraper:oncore-${fips}`,
        scope: fips,
        status: "running",
        triggerType: "manual-script",
        sourceKey: "oncore-official-records",
      },
    });
    const t0 = Date.now();
    try {
      const r = await scrapeOnCoreCounty({ countyFips: fips, from, to });
      // A documented blocker is a "succeeded" audit (the run did its job: it
      // proved the gate and wrote a bronze record), with 0 upserts.
      await prisma.bulkIngestJob.update({
        where: { id: audit.id },
        data: {
          status: r.outcome === "session-failed" ? "failed" : "succeeded",
          recordsFetched: r.found,
          recordsUpserted: r.persistedMortgages + r.persistedLiens,
          rejectCount: r.rejected,
          errorMessage: r.outcome === "search-blocked" ? `search-blocked:${r.blocker}` : null,
          finishedAt: new Date(),
          durationMs: Date.now() - t0,
          runStatsJson: JSON.parse(JSON.stringify(r)),
        },
      });
      const joinable = r.apnJoin.direct + r.apnJoin.uniqueName + r.apnJoin.ambiguous + r.apnJoin.none;
      const joined = r.apnJoin.direct + r.apnJoin.uniqueName;
      console.log(`  window ${r.from}..${r.to} | outcome=${r.outcome} blocker=${r.blocker} found=${r.found}`);
      console.log(`  byFamily: ${JSON.stringify(r.byFamily)}`);
      console.log(
        `  persisted: mortgages=${r.persistedMortgages} liens=${r.persistedLiens} | rejected=${r.rejected}`,
      );
      console.log(
        `  APN join: direct=${r.apnJoin.direct} unique-name=${r.apnJoin.uniqueName} ambiguous=${r.apnJoin.ambiguous} none=${r.apnJoin.none} → ${joinable > 0 ? ((100 * joined) / joinable).toFixed(1) : "0"}% joined`,
      );
      if (r.outcome === "search-blocked") {
        console.log(
          `  NOTE: OnCore search migrated to Tyler Self-Service SPA. Session mint OK; SPA search handshake pending (blocker=${r.blocker}). Bronze RawSnapshot written. Adapter ships enabled=false-ready.`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.bulkIngestJob.update({
        where: { id: audit.id },
        data: { status: "failed", errorMessage: message, finishedAt: new Date(), durationMs: Date.now() - t0 },
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
    FROM flipops."Mortgage" WHERE source LIKE 'scraper:oncore-%'
    GROUP BY "countyFips" ORDER BY "countyFips"`;
  console.log(`\nMortgage rows WHERE source LIKE 'scraper:oncore-%':`);
  for (const r of mtg) {
    console.log(
      `  ${r.countyFips} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%) range=${r.min_d?.toISOString().slice(0, 10)}..${r.max_d?.toISOString().slice(0, 10)}`,
    );
  }
  if (mtg.length === 0) console.log("  (none — expected while search is SPA-gated)");

  const liens = await prisma.$queryRaw<
    Array<{ countyFips: string; lienCategory: string; n: number; with_apn: number }>
  >`
    SELECT "countyFips", "lienCategory", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn
    FROM flipops."Lien" WHERE source LIKE 'scraper:oncore-%'
    GROUP BY "countyFips", "lienCategory" ORDER BY "countyFips", "lienCategory"`;
  console.log(`\nLien rows WHERE source LIKE 'scraper:oncore-%':`);
  for (const r of liens) {
    console.log(
      `  ${r.countyFips} ${r.lienCategory.padEnd(12)} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%)`,
    );
  }
  if (liens.length === 0) console.log("  (none — expected while search is SPA-gated)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
