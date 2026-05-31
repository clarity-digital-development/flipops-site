/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.bulkIngestJob.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      sourceKey: true,
      sourceTag: true,
      status: true,
      tier: true,
      recordsUpserted: true,
      rejectCount: true,
      durationMs: true,
      startedAt: true,
      finishedAt: true,
      errorMessage: true,
    },
  });
  console.log(`=== BulkIngestJob rows in the last 24h: ${rows.length} ===\n`);
  for (const r of rows) {
    const dur = r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—";
    console.log(
      `${r.startedAt.toISOString()}  ${r.status.padEnd(10)} ${(r.tier ?? "—").padEnd(3)} ${(r.sourceKey ?? r.sourceTag).padEnd(35)} rows=${r.recordsUpserted.toString().padStart(6)} dur=${dur.padStart(8)}${r.errorMessage ? ` ✗ ${r.errorMessage.slice(0, 80)}` : ""}`,
    );
  }

  const counts = await prisma.bulkIngestJob.groupBy({
    by: ["sourceKey", "status"],
    where: { startedAt: { gte: since } },
    _count: { _all: true },
  });
  console.log(`\n=== Counts by sourceKey + status (24h) ===`);
  for (const c of counts) {
    console.log(`  ${(c.sourceKey ?? "(null)").padEnd(35)} ${c.status.padEnd(10)} ${c._count._all}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
