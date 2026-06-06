/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const cutoff = new Date("2026-06-03T05:00:00Z");
  const recent = await prisma.foreclosure.findMany({
    where: { capturedAt: { gte: cutoff } },
    orderBy: { capturedAt: "desc" },
    take: 25,
    select: {
      countyFips: true,
      apn: true,
      caseNumber: true,
      stageCode: true,
      auctionDate: true,
      capturedAt: true,
      source: true,
    },
  });
  console.log(`Foreclosure rows captured today (after 05:00Z): ${recent.length}`);
  console.log("-".repeat(110));
  for (const r of recent) {
    const cap = r.capturedAt ? r.capturedAt.toISOString().slice(0, 19) : "null";
    const a = r.auctionDate ? r.auctionDate.toISOString().slice(0, 10) : "null";
    const apn = (r.apn ?? "").slice(0, 30);
    console.log(
      `${cap} | fips=${r.countyFips} | case=${r.caseNumber.slice(0, 18)} | ${r.stageCode.padEnd(10)} | auct=${a} | apn=${apn}`,
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
