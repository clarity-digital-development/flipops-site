/* eslint-disable no-console */
import { scrapeHillsboroughTaxDelinquent } from "@/lib/scrapers/vendors/hillsborough-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Hillsborough delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({
    where: { countyFips: "12057", lienCategory: "tax" },
  });
  console.log("Before — Hillsborough tax liens:", before);

  const t0 = Date.now();
  const r = await scrapeHillsboroughTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Total reported by source:", r.totalReported.toLocaleString());
  console.log("  Records parsed:          ", r.found.toLocaleString());
  console.log("  Pages crawled:           ", r.totalPages);
  console.log("  Persisted:               ", r.persisted.toLocaleString());
  console.log("  APN resolved (in-scrape):", r.apnResolved.toLocaleString());
  console.log("  Skipped (hallucinated):  ", r.skippedHallucinated);

  const after = await prisma.lien.count({
    where: { countyFips: "12057", lienCategory: "tax" },
  });
  console.log(`\nAfter — Hillsborough tax liens: ${after} (+${after - before})`);

  // Top 5 by amount where Parcel is joined (with rich data)
  const topJoined = await prisma.$queryRaw<
    {
      apn: string;
      account: string;
      tax_year: string;
      owner: string;
      parcel_owner: string;
      situs: string;
      situs_city: string;
      market_value: number | null;
    }[]
  >`
    SELECT
      l."apn",
      l."documentNumber" AS account,
      l."lienTypeCode" AS tax_year,
      l."defendantName" AS owner,
      p."ownerName" AS parcel_owner,
      p."situsAddress" AS situs,
      p."situsCity" AS situs_city,
      p."marketValue" AS market_value
    FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12057' AND l."lienCategory" = 'tax'
    ORDER BY p."marketValue" DESC NULLS LAST
    LIMIT 5
  `;
  console.log("\nTop-5 by market value (cross-referenced to Parcel):");
  topJoined.forEach((t, i) => {
    console.log(
      `  ${i + 1}. ${t.account} (apn=${t.apn})`
    );
    console.log(`     owner: ${t.owner}`);
    console.log(`     situs: ${t.situs}, ${t.situs_city}`);
    console.log(
      `     market value: $${t.market_value?.toLocaleString() ?? "n/a"} | year: ${t.tax_year}`
    );
  });

  // APN join rate
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12057' AND l."lienCategory" = 'tax'`;
  const totalHillsboroughLiens = await prisma.lien.count({
    where: { countyFips: "12057", lienCategory: "tax" },
  });
  const joinRate =
    totalHillsboroughLiens > 0
      ? ((Number(joined[0].count) / totalHillsboroughLiens) * 100).toFixed(1)
      : "0.0";
  console.log(
    `\n${joined[0].count} delinquent records JOIN to existing Parcel rows (${joinRate}% join rate)`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
