import { prisma } from '../lib/prisma';

(async () => {
  // 1. Total RealAuction Foreclosure rows
  const totalRA = await prisma.foreclosure.count({
    where: { source: { startsWith: 'scraper:realauction' } },
  });

  // 2. By stageCode for RealAuction
  const byStageRaw = await prisma.$queryRaw<Array<{ stageCode: string | null; n: bigint }>>`
    SELECT "stageCode", COUNT(*)::bigint AS n
    FROM flipops."Foreclosure"
    WHERE source LIKE 'scraper:realauction%'
    GROUP BY "stageCode"
    ORDER BY n DESC
  `;
  const byStage: Record<string, number> = {};
  for (const r of byStageRaw) byStage[r.stageCode ?? 'null'] = Number(r.n);

  // 3. SCHEDULED rows captured in last 30 days
  const thirtyAgo = new Date(Date.now() - 30 * 86400_000);
  const schedRecent = await prisma.foreclosure.count({
    where: {
      source: { startsWith: 'scraper:realauction' },
      stageCode: 'SCHEDULED',
      capturedAt: { gte: thirtyAgo },
    },
  });

  // 4. SCHEDULED rows captured in last 30d + has judgmentAmount AND openingBid (richer leads)
  const schedRich = await prisma.foreclosure.count({
    where: {
      source: { startsWith: 'scraper:realauction' },
      stageCode: 'SCHEDULED',
      capturedAt: { gte: thirtyAgo },
      judgmentAmount: { not: null },
      openingBid: { not: null },
    },
  });

  // 5. By countyFips for SCHEDULED-recent
  const byCountyRaw = await prisma.$queryRaw<Array<{ countyFips: string; n: bigint }>>`
    SELECT "countyFips", COUNT(*)::bigint AS n
    FROM flipops."Foreclosure"
    WHERE source LIKE 'scraper:realauction%'
      AND "stageCode" = 'SCHEDULED'
      AND "capturedAt" >= ${thirtyAgo}
    GROUP BY "countyFips"
    ORDER BY n DESC
    LIMIT 5
  `;
  const byCountyTop5 = byCountyRaw.map((r) => ({ county: r.countyFips, count: Number(r.n) }));

  // 6. STRICT join — SCHEDULED-recent rows whose (countyFips, apn) match a Parcel
  const strictJoin = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM flipops."Foreclosure" f
    INNER JOIN flipops."Parcel" p
      ON p."countyFips" = f."countyFips" AND p.apn = f.apn
    WHERE f.source LIKE 'scraper:realauction%'
      AND f."stageCode" = 'SCHEDULED'
      AND f."capturedAt" >= ${thirtyAgo}
      AND f.apn IS NOT NULL
  `;
  const schedWithStrictJoin = Number(strictJoin[0]?.n ?? 0);

  // Total SCHEDULED-recent with non-null APN (denominator for join rate)
  const schedWithApn = await prisma.foreclosure.count({
    where: {
      source: { startsWith: 'scraper:realauction' },
      stageCode: 'SCHEDULED',
      capturedAt: { gte: thirtyAgo },
      apn: { not: null },
    },
  });

  // Project normalized join at 85% of SCHEDULED-recent rows that have APN
  const schedWithNormalizedJoinProjected = Math.round(schedWithApn * 0.85);

  // Also peek at a sample
  const sample = await prisma.foreclosure.findMany({
    where: {
      source: { startsWith: 'scraper:realauction' },
      stageCode: 'SCHEDULED',
      capturedAt: { gte: thirtyAgo },
    },
    take: 3,
    select: { countyFips: true, apn: true, judgmentAmount: true, openingBid: true, auctionDate: true, capturedAt: true, source: true },
  });

  console.log(JSON.stringify({
    totalRealAuctionRows: totalRA,
    byStageCode: byStage,
    schedRecent,
    schedRich,
    schedWithApn,
    schedWithStrictJoin,
    schedWithNormalizedJoinProjected,
    byCountyTop5,
    sample,
  }, null, 2));

  await prisma.$disconnect();
})();
