import { prisma } from "@/lib/prisma";
import {
  REALTAXDEED_COUNTIES,
  fetchTaxDeedSaleDates,
  scrapeRealTaxDeed,
} from "@/lib/scrapers/vendors/realtaxdeed";
import { refreshAuctionSummary } from "./rescore-auction";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.2 realtaxdeed scraper.
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-realtaxdeed-local.ts [--county 12031]...
//                    [--months 3] [--max-dates 5] [--no-rescore]
//
// Defaults to 3 counties (Duval, Miami-Dade, Broward). Direct egress
// (useProxy:false) — RealAuction's WAF 403s the DataImpulse pool.
// ---------------------------------------------------------------------------

function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

async function main() {
  const countyArgs = argValues("--county");
  const months = parseInt(argValues("--months")[0] ?? "3", 10);
  const maxDates = parseInt(argValues("--max-dates")[0] ?? "5", 10);
  const fipsList = countyArgs.length > 0 ? countyArgs : ["12031", "12086", "12011"];

  let totalFound = 0;
  let totalPersisted = 0;

  for (const fips of fipsList) {
    const county = REALTAXDEED_COUNTIES.find((c) => c.countyFips === fips);
    if (!county) {
      console.warn(`SKIP ${fips}: not in REALTAXDEED_COUNTIES`);
      continue;
    }
    console.log(`\n=== ${county.county} (${fips}) — ${county.subdomain}.realtaxdeed.com ===`);

    const dates = await fetchTaxDeedSaleDates({ subdomain: county.subdomain, monthsAhead: months });
    console.log(`  calendar sale dates (${months + 1} months): ${dates.length ? dates.join(", ") : "(none)"}`);

    for (const saleDate of dates.slice(0, maxDates)) {
      const r = await scrapeRealTaxDeed({ countyFips: fips, saleDate });
      if (!r) continue;
      totalFound += r.found;
      totalPersisted += r.persisted;
      console.log(`  ${saleDate}: found=${r.found} persisted=${r.persisted}`);
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  console.log(`\nTOTAL: found=${totalFound} persisted=${totalPersisted}`);

  if (!process.argv.includes("--no-rescore")) {
    const res = await refreshAuctionSummary();
    console.log(`AuctionSummary refreshed: ${res.rowsAffected} rows in ${res.durationMs}ms`);
  }

  // Post-run DB verification: realtaxdeed rows per county + future sale dates.
  const rows = await prisma.$queryRawUnsafe<
    Array<{ countyFips: string; stageCode: string; n: number; future_n: number; min_d: Date | null; max_d: Date | null }>
  >(`
    SELECT "countyFips", "stageCode", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE "auctionDate" > NOW())::int AS future_n,
           MIN("auctionDate") AS min_d, MAX("auctionDate") AS max_d
    FROM flipops."Foreclosure"
    WHERE source = 'realtaxdeed'
    GROUP BY "countyFips", "stageCode"
    ORDER BY "countyFips", "stageCode"`);
  console.log(`\nForeclosure rows WHERE source='realtaxdeed':`);
  for (const r of rows) {
    console.log(
      `  ${r.countyFips} ${r.stageCode.padEnd(9)} n=${r.n} future=${r.future_n} range=${r.min_d?.toISOString().slice(0, 10)}..${r.max_d?.toISOString().slice(0, 10)}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
