import { prisma } from "@/lib/prisma";

async function main() {
  const FIPS = "12031";
  const now = new Date();
  const thirty = new Date(now.getTime() - 30 * 86400_000);
  const ninety = new Date(now.getTime() - 90 * 86400_000);

  // Mortgages
  const mortgages30 = await prisma.mortgage.groupBy({
    by: ["mortgageType"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, recordingDate: { gte: thirty } },
    _count: { _all: true },
  });
  const mortgages90 = await prisma.mortgage.groupBy({
    by: ["mortgageType"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, recordingDate: { gte: ninety } },
    _count: { _all: true },
  });
  const mortgageTotal = await prisma.mortgage.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" } },
  });

  // Liens by lienCategory + lienTypeCode
  const liens30 = await prisma.lien.groupBy({
    by: ["lienCategory", "lienTypeCode"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, recordingDate: { gte: thirty } },
    _count: { _all: true },
  });
  const liens90 = await prisma.lien.groupBy({
    by: ["lienCategory", "lienTypeCode"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, recordingDate: { gte: ninety } },
    _count: { _all: true },
  });
  const lienTotal = await prisma.lien.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" } },
  });

  // Foreclosures
  const fc30 = await prisma.foreclosure.groupBy({
    by: ["stageCode"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, filingDate: { gte: thirty } },
    _count: { _all: true },
  });
  const fc90 = await prisma.foreclosure.groupBy({
    by: ["stageCode"],
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, filingDate: { gte: ninety } },
    _count: { _all: true },
  });
  const fcTotal = await prisma.foreclosure.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" } },
  });

  // APN-population for join feasibility
  const mtgWithApn = await prisma.mortgage.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, apn: { not: null } },
  });
  const lienWithApn = await prisma.lien.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, apn: { not: null } },
  });
  const fcWithApn = await prisma.foreclosure.count({
    where: { countyFips: FIPS, source: { startsWith: "scraper:duval-clerk" }, apn: { not: null } },
  });

  console.log(JSON.stringify({
    totals: { mortgages: mortgageTotal, liens: lienTotal, foreclosures: fcTotal },
    apnPopulation: { mortgages: mtgWithApn, liens: lienWithApn, foreclosures: fcWithApn },
    mortgages30, mortgages90,
    liens30, liens90,
    fc30, fc90,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
