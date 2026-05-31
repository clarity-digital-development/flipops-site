/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";
import { parseExpression } from "cron-parser";

async function main() {
  const rows = await prisma.scrapeRegistry.findMany({
    orderBy: [{ enabled: "desc" }, { domain: "asc" }],
  });
  console.log(`=== ScrapeRegistry expected-next vs actual-last ===\n`);
  const now = new Date();
  for (const r of rows) {
    let nextScheduled = "(invalid cronExpr)";
    let overdueMin = "—";
    try {
      const it = parseExpression(r.cronExpr, { tz: r.timezone || "America/New_York" });
      const next = it.next().toDate();
      const prev = it.prev().toDate();
      nextScheduled = next.toISOString().slice(0, 16);
      overdueMin = String(Math.round((now.getTime() - prev.getTime()) / 60_000));
    } catch (e) {
      nextScheduled = `(invalid: ${e instanceof Error ? e.message : e})`;
    }
    const last = r.lastRunAt ? r.lastRunAt.toISOString().slice(0, 16) : "—";
    const last_succ = r.lastSuccessAt ? r.lastSuccessAt.toISOString().slice(0, 16) : "—";
    console.log(
      `${r.sourceKey.padEnd(33)} en=${r.enabled ? "Y" : "N"} cron='${r.cronExpr}'  prev_due=${overdueMin}m_ago  next=${nextScheduled}  lastRun=${last}  lastOk=${last_succ}${r.pausedReason ? `  ⏸ ${r.pausedReason}` : ""}`,
    );
  }

  // Also surface anything paused
  const paused = rows.filter((r) => !r.enabled);
  if (paused.length > 0) {
    console.log(`\n⚠ Paused: ${paused.length}`);
    for (const r of paused) console.log(`   ${r.sourceKey} — ${r.pausedReason ?? "(no reason)"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
