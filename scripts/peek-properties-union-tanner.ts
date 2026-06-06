import { config as loadDotenv } from 'dotenv';
loadDotenv({ path: '.env.local' });
import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find Tanner's user
  const tanner = await prisma.user.findFirst({
    where: { email: { contains: 'tannercarlson', mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  console.log('Tanner user:', tanner);

  if (tanner) {
    const mineCount = await prisma.property.count({ where: { userId: tanner.id } });
    console.log('Mine (Property) count for Tanner:', mineCount);
  }

  // Score variance check: full distribution
  const variance = (await prisma.$queryRaw`
    SELECT score, COUNT(*)::int AS cnt
    FROM flipops."AuctionSummary"
    WHERE score IS NOT NULL
    GROUP BY score
    ORDER BY score DESC
    LIMIT 20
  `) as Array<{ score: number; cnt: number }>;
  console.log('AuctionSummary score distribution (top 20):');
  for (const r of variance) console.log(`  score=${r.score}  count=${r.cnt}`);

  const uniqueScores = variance.length;
  console.log(`\nUnique score values in AuctionSummary: ${uniqueScores}`);

  // Confirm union row counts across full DB (not limited to 20)
  const auctionRows = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt FROM flipops."AuctionSummary" s
    INNER JOIN flipops."Parcel" par ON par."countyFips"=s."countyFips" AND par."apn"=s."apn"
    WHERE s.score IS NOT NULL
  `;
  const taxRows = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt FROM flipops."TaxDelinquencySummary" s
    WHERE NOT EXISTS (
      SELECT 1 FROM flipops."AuctionSummary" auc
      WHERE auc."countyFips"=s."countyFips" AND auc."apn"=s."apn" AND auc."nextAuctionDate" IS NOT NULL
    )
  `;
  console.log('Full virt-fc eligible rows:', auctionRows[0].cnt);
  console.log('Full virt-tax eligible rows:', taxRows[0].cnt);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
