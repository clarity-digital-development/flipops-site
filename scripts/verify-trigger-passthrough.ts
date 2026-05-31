/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.bulkIngestJob.findMany({
    where: { sourceKey: "palm-beach-tax-delinquent" },
    orderBy: { startedAt: "desc" },
    take: 6,
    select: {
      sourceTag: true,
      sourceKey: true,
      triggerType: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      recordsUpserted: true,
    },
  });

  console.log("=== Last 6 Palm Beach BulkIngestJob rows ===\n");
  for (const r of rows) {
    const dur = r.durationMs != null ? `${(r.durationMs / 1000).toFixed(2)}s` : "—";
    console.log(
      `${r.startedAt.toISOString()}  status=${r.status.padEnd(10)} trigger=${(r.triggerType ?? "(null)").padEnd(15)} rows=${String(r.recordsUpserted).padStart(5)} dur=${dur.padStart(7)}`,
    );
  }

  // Highlight: did the most recent row pick up the new manual-script value?
  const latest = rows[0];
  if (latest) {
    const expected = "manual-script";
    if (latest.triggerType === expected) {
      console.log(`\n✓ PASS: latest row has triggerType="${latest.triggerType}" as expected for the manual-enqueue path.`);
    } else {
      console.log(`\n✗ FAIL: latest row has triggerType="${latest.triggerType}" (expected "${expected}").`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
