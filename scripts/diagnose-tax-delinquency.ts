/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Diagnostic: per-county tax-delinquency data quality (M1.4 / AUDIT-A1 §5.4).
//
// Localizes each county's bug to either the raw Lien table (scraper problem)
// or TaxDelinquencySummary (rescore problem) by comparing:
//   - Lien (lienCategory='tax'): rows, apn coverage, amount coverage, SUM(amount)
//   - TaxDelinquencySummary: rows, SUM(totalAmount)
//
// Run: DATABASE_URL=... npx tsx scripts/diagnose-tax-delinquency.ts
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Lien (lienCategory='tax') per county ===");
  const lien = await prisma.$queryRaw<
    Array<{
      countyFips: string;
      rows: bigint;
      withApn: bigint;
      distinctApn: bigint;
      withAmount: bigint;
      sumAmount: number | null;
    }>
  >`
    SELECT "countyFips",
           COUNT(*)::bigint                                   AS "rows",
           COUNT("apn")::bigint                               AS "withApn",
           COUNT(DISTINCT "apn")::bigint                      AS "distinctApn",
           COUNT(*) FILTER (WHERE "amount" IS NOT NULL AND "amount" > 0)::bigint AS "withAmount",
           SUM("amount")::float                               AS "sumAmount"
    FROM flipops."Lien"
    WHERE "lienCategory" = 'tax'
    GROUP BY "countyFips"
    ORDER BY "countyFips"`;
  for (const r of lien) {
    console.log(
      `  ${r.countyFips}  rows=${r.rows}  withApn=${r.withApn}  distinctApn=${r.distinctApn}  withAmount=${r.withAmount}  sum=$${(r.sumAmount ?? 0).toLocaleString()}`,
    );
  }

  console.log("\n=== TaxDelinquencySummary per county ===");
  const summary = await prisma.$queryRaw<
    Array<{ countyFips: string; rows: bigint; sumOwed: number | null }>
  >`
    SELECT "countyFips", COUNT(*)::bigint AS "rows", SUM("totalAmount")::float AS "sumOwed"
    FROM flipops."TaxDelinquencySummary"
    GROUP BY "countyFips"
    ORDER BY "countyFips"`;
  for (const r of summary) {
    console.log(`  ${r.countyFips}  rows=${r.rows}  sumOwed=$${(r.sumOwed ?? 0).toLocaleString()}`);
  }

  console.log("\n=== Sources per problem county (12011 Broward, 12057 Hillsborough, 12099 Palm Beach) ===");
  const sources = await prisma.$queryRaw<
    Array<{ countyFips: string; source: string; rows: bigint; withApn: bigint; sumAmount: number | null }>
  >`
    SELECT "countyFips", "source",
           COUNT(*)::bigint AS "rows",
           COUNT("apn")::bigint AS "withApn",
           SUM("amount")::float AS "sumAmount"
    FROM flipops."Lien"
    WHERE "lienCategory" = 'tax'
      AND "countyFips" IN ('12011','12057','12099')
    GROUP BY "countyFips", "source"
    ORDER BY "countyFips", "source"`;
  for (const r of sources) {
    console.log(
      `  ${r.countyFips}  ${r.source}  rows=${r.rows}  withApn=${r.withApn}  sum=$${(r.sumAmount ?? 0).toLocaleString()}`,
    );
  }

  console.log("\n=== Sample rows per problem county ===");
  const samples = await prisma.$queryRaw<
    Array<{
      countyFips: string;
      apn: string | null;
      documentNumber: string | null;
      lienTypeCode: string | null;
      amount: number | null;
      defendantName: string | null;
      source: string;
    }>
  >`
    SELECT * FROM (
      SELECT DISTINCT ON ("countyFips") "countyFips", "apn", "documentNumber", "lienTypeCode",
             "amount"::float AS "amount", "defendantName", "source"
      FROM flipops."Lien"
      WHERE "lienCategory" = 'tax' AND "countyFips" IN ('12011','12057','12099')
      ORDER BY "countyFips", "id"
    ) s`;
  for (const r of samples) {
    console.log(`  ${JSON.stringify(r)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
