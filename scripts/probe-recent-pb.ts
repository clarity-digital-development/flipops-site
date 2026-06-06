import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { prisma } from "@/lib/prisma";

async function main() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  console.log("=== Probe started ===");
  console.log("sixHoursAgo cutoff:", sixHoursAgo.toISOString());
  console.log("now:", new Date().toISOString());

  // a) BulkIngestJob rows for palm-beach
  console.log("\n=== (a) BulkIngestJob rows for palm-beach (top 10 by startedAt desc) ===");
  const pbJobs = await prisma.bulkIngestJob.findMany({
    where: {
      OR: [
        { sourceKey: "palm-beach-tax-delinquent" },
        { sourceTag: { contains: "palm-beach" } },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  console.log("count returned:", pbJobs.length);
  console.log(JSON.stringify(pbJobs, null, 2));

  // b) ScrapeRegistry row for palm-beach-tax-delinquent
  console.log("\n=== (b) ScrapeRegistry row for palm-beach-tax-delinquent ===");
  const pbRegistry = await prisma.scrapeRegistry.findUnique({
    where: { sourceKey: "palm-beach-tax-delinquent" },
  });
  console.log(JSON.stringify(pbRegistry, null, 2));

  // c) Total BulkIngestJob count in last 6h
  console.log("\n=== (c) Total BulkIngestJob count startedAt >= sixHoursAgo ===");
  const totalRecent = await prisma.bulkIngestJob.count({
    where: { startedAt: { gte: sixHoursAgo } },
  });
  console.log("total recent jobs:", totalRecent);

  // d) BulkIngestJob rows in last 6h (selected fields)
  console.log("\n=== (d) BulkIngestJob rows in last 6h (top 30) ===");
  const recentJobs = await prisma.bulkIngestJob.findMany({
    where: { startedAt: { gte: sixHoursAgo } },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      sourceKey: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      recordsUpserted: true,
      errorMessage: true,
      tier: true,
    },
  });
  console.log("count returned:", recentJobs.length);
  console.log(JSON.stringify(recentJobs, null, 2));

  // e) ScrapeRegistry rows where lastFailureAt is not null
  console.log("\n=== (e) ScrapeRegistry rows with lastFailureAt not null ===");
  const failing = await prisma.scrapeRegistry.findMany({
    where: { lastFailureAt: { not: null } },
    select: {
      sourceKey: true,
      lastFailureAt: true,
      lastFailureReason: true,
      consecutiveFails: true,
    },
  });
  console.log("count returned:", failing.length);
  console.log(JSON.stringify(failing, null, 2));

  console.log("\n=== Probe complete ===");
}

main()
  .catch((err) => {
    console.error("PROBE ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
