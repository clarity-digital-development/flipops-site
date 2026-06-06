import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();

  const [total]: any[] = await p.$queryRaw`SELECT COUNT(*)::int AS c FROM flipops."Foreclosure"`;
  const [auctionPop]: any[] = await p.$queryRaw`SELECT COUNT(*)::int AS c FROM flipops."Foreclosure" WHERE "auctionDate" IS NOT NULL`;
  const [futureAuction]: any[] = await p.$queryRaw`SELECT COUNT(*)::int AS c FROM flipops."Foreclosure" WHERE "auctionDate" > NOW()`;
  const byCounty: any[] = await p.$queryRaw`
    SELECT "countyFips", COUNT(*)::int AS c
    FROM flipops."Foreclosure"
    WHERE "stageCode"='SCHEDULED'
    GROUP BY "countyFips"
    ORDER BY c DESC
  `;
  const sample: any[] = await p.$queryRaw`
    SELECT apn, "countyFips", "auctionDate", "stageCode"
    FROM flipops."Foreclosure"
    ORDER BY "capturedAt" DESC
    LIMIT 10
  `;

  console.log(JSON.stringify({
    totalForeclosureRows: total.c,
    auctionDatePopulated: auctionPop.c,
    futureAuctionDate: futureAuction.c,
    byCountyScheduledCount: byCounty.map((r) => ({ countyFips: r.countyFips, count: r.c })),
    sample,
  }, null, 2));

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
