import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.scrapeRegistry.findMany({
    orderBy: [{ enabled: "asc" }, { sourceKey: "asc" }],
    select: {
      sourceKey: true,
      domain: true,
      enabled: true,
      pausedReason: true,
      consecutiveP1Alerts: true,
      consecutiveFails: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureReason: true,
      cronExpr: true,
      legalRisk: true,
      bootstrapping: true,
    } as any,
  });

  const disabled = rows.filter((r: any) => !r.enabled);
  const enabled = rows.filter((r: any) => r.enabled);

  console.log("=== ALL SCRAPERS (" + rows.length + " total) ===");
  console.log(JSON.stringify(rows, null, 2));

  console.log("\n=== DISABLED (" + disabled.length + ") ===");
  console.log(JSON.stringify(disabled, null, 2));

  console.log("\n=== ENABLED COUNT: " + enabled.length + " ===");

  const duval = rows.find((r: any) => r.sourceKey === "duval-clerk-recordings");
  console.log("\n=== DUVAL CLERK RECORDINGS ===");
  console.log(JSON.stringify(duval, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
