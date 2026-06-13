/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// AVM v2 temporal-retrain probe (read-only). Answers the questions that decide
// the v2 history window + out-of-time holdout split:
//   * arms-length sale volume by YEAR per metro (qualCode 01/02, >=$20k, joined
//     to a ParcelFeature row with sqft>0 — i.e. the rows that would actually
//     enter the training frame), so we can pick a --since window.
//   * min/max saleDate (the as-of anchor + the deepest usable history).
//   * trailing-6-month arms-length count (the candidate out-of-time holdout).
//   * ParcelFeature coverage per metro (serving/predict universe).
// Mirrors export-avm-training.ts's exact frame filters so the counts are honest.
//
//   DATABASE_URL=... npx tsx scripts/ml/avm/probe-temporal.ts --metros 12086,12011
// ---------------------------------------------------------------------------
import { prisma } from "../../../lib/prisma";

const QUAL_IN = "'01', '02'";
const SALE_FLOOR = 20_000;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--metros");
  const metros = (i >= 0 ? argv[i + 1] : "12086,12011")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const county of metros) {
    console.log(`\n===== county ${county} =====`);

    const span = await prisma.$queryRawUnsafe<
      Array<{ mind: Date | null; maxd: Date | null; n: bigint }>
    >(
      `SELECT MIN(s."saleDate") AS mind, MAX(s."saleDate") AS maxd, COUNT(*)::bigint AS n
       FROM flipops."ParcelSale" s
       JOIN flipops."ParcelFeature" f
         ON f."countyFips" = s."countyFips" AND f."apn" = s."apn"
       WHERE s."countyFips" = $1
         AND s."qualCode" IN (${QUAL_IN})
         AND COALESCE(s."salePrice",0) >= ${SALE_FLOOR}
         AND COALESCE(f."squareFeet",0) > 0
         AND s."saleDate" IS NOT NULL`,
      county,
    );
    const s0 = span[0];
    console.log(
      `frame rows (arms-length >=$${SALE_FLOOR}, sqft>0): ${s0.n}  span ${s0.mind?.toISOString().slice(0, 10)} → ${s0.maxd?.toISOString().slice(0, 10)}`,
    );

    const byYear = await prisma.$queryRawUnsafe<
      Array<{ yr: number; n: bigint; medprice: number | null }>
    >(
      `SELECT EXTRACT(YEAR FROM s."saleDate")::int AS yr, COUNT(*)::bigint AS n,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY s."salePrice")::float AS medprice
       FROM flipops."ParcelSale" s
       JOIN flipops."ParcelFeature" f
         ON f."countyFips" = s."countyFips" AND f."apn" = s."apn"
       WHERE s."countyFips" = $1
         AND s."qualCode" IN (${QUAL_IN})
         AND COALESCE(s."salePrice",0) >= ${SALE_FLOOR}
         AND COALESCE(f."squareFeet",0) > 0
         AND s."saleDate" IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      county,
    );
    console.log("  year   n         medianPrice");
    for (const r of byYear) {
      console.log(
        `  ${r.yr}  ${String(r.n).padStart(8)}   $${Math.round(r.medprice ?? 0).toLocaleString()}`,
      );
    }

    const trailing = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n
       FROM flipops."ParcelSale" s
       JOIN flipops."ParcelFeature" f
         ON f."countyFips" = s."countyFips" AND f."apn" = s."apn"
       WHERE s."countyFips" = $1
         AND s."qualCode" IN (${QUAL_IN})
         AND COALESCE(s."salePrice",0) >= ${SALE_FLOOR}
         AND COALESCE(f."squareFeet",0) > 0
         AND s."saleDate" >= (SELECT MAX(s2."saleDate") FROM flipops."ParcelSale" s2 WHERE s2."countyFips"=$1) - interval '6 months'`,
      county,
    );
    console.log(`  trailing-6mo arms-length frame rows: ${trailing[0].n}`);

    const pf = await prisma.$queryRawUnsafe<Array<{ total: bigint; valuable: bigint }>>(
      `SELECT COUNT(*)::bigint AS total,
              COUNT(*) FILTER (WHERE COALESCE("squareFeet",0) > 0)::bigint AS valuable
       FROM flipops."ParcelFeature" WHERE "countyFips" = $1`,
      county,
    );
    console.log(
      `  ParcelFeature rows: ${pf[0].total} total · ${pf[0].valuable} valuable (sqft>0, the predict universe)`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
