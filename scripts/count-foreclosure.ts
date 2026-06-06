import { prisma } from "../lib/prisma";

async function main() {
  const total = await prisma.foreclosure.count();
  const withDate = await prisma.foreclosure.count({ where: { auctionDate: { not: null } } });
  const captured = await prisma.foreclosure.count({
    where: { capturedAt: { gte: new Date("2026-06-03T00:00:00Z") } },
  });
  console.log(JSON.stringify({ total, withDate, capturedToday: captured }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
