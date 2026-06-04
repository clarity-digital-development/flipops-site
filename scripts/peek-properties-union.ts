/**
 * scripts/peek-properties-union.ts — M2.3 smoke verifier
 *
 * Runs the same 3-branch UNION SQL that /api/properties uses and prints the
 * top-10 by score. Bypasses the Next.js HTTP route + Clerk auth so we can
 * eyeball the SQL output directly.
 *
 * Verifies:
 *   1. virt-fc-* rows appear (auction-virtual branch is live)
 *   2. No duplicate (countyFips, apn) across branches (HG1 dedup)
 *   3. Scores match what scripts/rescore-auction.ts materialized (85 / grade A)
 *
 * Usage:  npx tsx scripts/peek-properties-union.ts
 */
import { config as loadDotenv } from 'dotenv';
loadDotenv({ path: '.env.local' });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface Row {
  id: string;
  virtual: boolean;
  county_fips: string | null;
  apn: string | null;
  address: string;
  score: number | null;
  grade: string | null;
  motivation: string | null;
  data_source: string;
  foreclosure: boolean;
  tax_delinquent: boolean;
}

async function main() {
  // Use any user — the NOT EXISTS on Property uses userId, but for a smoke
  // peek we can pass a placeholder UUID that won't match anyone.
  const userId = '00000000-0000-0000-0000-000000000000';

  const mineQuery = Prisma.sql`
    SELECT
      p."id" AS id, FALSE AS virtual, p."countyFips" AS county_fips, p."apn" AS apn,
      p."address" AS address, p."score" AS score, NULL::text AS grade,
      NULL::text AS motivation, p."dataSource" AS data_source,
      p."foreclosure" AS foreclosure, p."taxDelinquent" AS tax_delinquent
    FROM flipops."Property" p
    WHERE p."userId" = ${userId}
  `;

  const virtualQuery = Prisma.sql`
    SELECT
      ('virt-' || s."countyFips" || '-' || s."apn") AS id, TRUE AS virtual,
      s."countyFips" AS county_fips, s."apn" AS apn,
      COALESCE(par."situsAddress", '(address pending)') AS address,
      COALESCE(s."score", 20) AS score, s."grade" AS grade,
      s."motivation" AS motivation, 'parcel-lien-bridge' AS data_source,
      FALSE AS foreclosure, TRUE AS tax_delinquent
    FROM flipops."TaxDelinquencySummary" s
    LEFT JOIN flipops."Parcel" par
      ON par."countyFips" = s."countyFips" AND par."apn" = s."apn"
    WHERE NOT EXISTS (
      SELECT 1 FROM flipops."AuctionSummary" auc
      WHERE auc."countyFips" = s."countyFips" AND auc."apn" = s."apn"
        AND auc."nextAuctionDate" IS NOT NULL
    )
  `;

  const auctionQuery = Prisma.sql`
    SELECT
      ('virt-fc-' || s."countyFips" || '-' || s."apn") AS id, TRUE AS virtual,
      s."countyFips" AS county_fips, s."apn" AS apn,
      COALESCE(par."situsAddress", '(address pending)') AS address,
      COALESCE(s."score", 20) AS score, s."grade" AS grade,
      s."motivation" AS motivation, 'parcel-auction-bridge' AS data_source,
      TRUE AS foreclosure,
      (EXISTS (
        SELECT 1 FROM flipops."TaxDelinquencySummary" tds
        WHERE tds."countyFips" = s."countyFips" AND tds."apn" = s."apn"
      )) AS tax_delinquent
    FROM flipops."AuctionSummary" s
    INNER JOIN flipops."Parcel" par
      ON par."countyFips" = s."countyFips" AND par."apn" = s."apn"
    WHERE s."score" IS NOT NULL
  `;

  const unionSql = Prisma.sql`
    (${mineQuery}) UNION ALL (${virtualQuery}) UNION ALL (${auctionQuery})
    ORDER BY score DESC NULLS LAST, id ASC
    LIMIT 20
  `;

  const rows = (await prisma.$queryRaw(unionSql)) as Row[];

  console.log(`\nTotal rows returned: ${rows.length}\n`);

  const byBranch = {
    mine: rows.filter((r) => !r.virtual),
    virt: rows.filter((r) => r.id.startsWith('virt-') && !r.id.startsWith('virt-fc-')),
    virtFc: rows.filter((r) => r.id.startsWith('virt-fc-')),
  };
  console.log(`Branch breakdown:`);
  console.log(`  mine:    ${byBranch.mine.length}`);
  console.log(`  virt-:   ${byBranch.virt.length}`);
  console.log(`  virt-fc: ${byBranch.virtFc.length}\n`);

  // Dedup check: same (countyFips, apn) across branches
  const seen = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.county_fips}/${r.apn}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(r);
  }
  const dupes = [...seen.entries()].filter(([_, v]) => v.length > 1);
  console.log(
    dupes.length === 0
      ? `HG1 dedup: OK (no parcel appears in multiple branches)\n`
      : `HG1 DEDUP VIOLATION: ${dupes.length} parcels in multiple branches:\n${dupes.map(([k]) => '  ' + k).join('\n')}\n`,
  );

  console.log(`Top virt-fc-* (auction-virtual) rows:`);
  for (const r of byBranch.virtFc.slice(0, 3)) {
    console.log(
      `  id=${r.id}\n    addr=${r.address}\n    score=${r.score} grade=${r.grade}\n    motivation=${r.motivation}\n    foreclosure=${r.foreclosure} taxDelinquent=${r.tax_delinquent}\n`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
