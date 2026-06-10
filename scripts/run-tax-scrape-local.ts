/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";
import { resolveAdapter, registeredSourceKeys } from "@/lib/scrapers/dispatch";
import { createRunStatsCollector } from "@/lib/scrapers/dispatch/run-stats";
import type { RunContext } from "@/lib/scrapers/dispatch/types";

// ---------------------------------------------------------------------------
// Operational tool: run a dispatch scraper adapter from a LOCAL machine,
// mirroring the worker-bullmq audit flow (BulkIngestJob row + ScrapeRegistry
// stamps), for scrapers that are bot-walled on datacenter egress or when the
// worker is down.
//
// Usage:
//   export DATABASE_URL=...   (from .env.local — public turntable host)
//   export PROXY_URL=...      (required by useProxy:true scrapers)
//   npx tsx scripts/run-tax-scrape-local.ts --scraper broward-tax-delinquent
//   npx tsx scripts/run-tax-scrape-local.ts --scraper hillsborough-tax-delinquent
//
// Mirrors lib/cron/worker-bullmq.ts processJob's adapter path (audit-row
// create → adapter(ctx) → audit + registry update), minus BullMQ/season/skip
// machinery — this is an explicit operator override, equivalent to
// triggerType=manual-script.
// ---------------------------------------------------------------------------

async function main() {
  const idx = process.argv.indexOf("--scraper");
  const sourceKey = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (!sourceKey) {
    console.error(
      `Usage: npx tsx scripts/run-tax-scrape-local.ts --scraper <key>\nAvailable: ${registeredSourceKeys().join(", ")}`,
    );
    process.exit(1);
  }

  const adapter = resolveAdapter(sourceKey);
  if (!adapter) {
    console.error(
      `[run-tax-scrape-local] no adapter for sourceKey=${sourceKey}. Available: ${registeredSourceKeys().join(", ")}`,
    );
    process.exit(1);
  }

  const row = await prisma.scrapeRegistry.findUnique({ where: { sourceKey } });
  if (!row) {
    console.error(`[run-tax-scrape-local] no ScrapeRegistry row for sourceKey=${sourceKey}`);
    process.exit(1);
  }

  // Create audit row exactly like worker-bullmq's success path does.
  const audit = await prisma.bulkIngestJob.create({
    data: {
      sourceTag: `scraper:${sourceKey}-${new Date().toISOString().slice(0, 10)}`,
      sourceKey,
      scope: row.countyFips ?? row.state ?? "unknown",
      status: "running",
      triggerType: "manual-script",
    },
  });
  console.log(`[run-tax-scrape-local] sourceKey=${sourceKey} runId=${audit.id} — starting adapter`);

  const stats = createRunStatsCollector();
  const ctx: RunContext = {
    sourceKey,
    runId: audit.id,
    lastRunAt: row.lastRunAt,
    lastHighWaterMark: row.lastHighWaterMark,
    registry: {
      sourceKey: row.sourceKey,
      domain: row.domain,
      countyFips: row.countyFips,
      state: row.state,
      strategy: row.strategy,
      rateLimitMs: row.rateLimitMs,
      proxyMode: row.proxyMode,
      legalRisk: row.legalRisk,
      bootstrapping: row.bootstrapping,
    },
    stats,
  };

  const start = Date.now();
  try {
    const result = await adapter(ctx);
    const durationMs = Date.now() - start;
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "succeeded",
        recordsFetched: result.rowCount,
        recordsUpserted: result.rowCount,
        rejectCount: result.rejectCount,
        http4xxCount: result.stats.http4xxCount,
        http5xxCount: result.stats.http5xxCount,
        cfChallengeCount: result.stats.cfChallengeCount,
        selectorMissRate: result.stats.selectorMissRate,
        runStatsJson: result.stats as unknown as object,
        finishedAt: new Date(),
        durationMs,
      },
    });
    await prisma.scrapeRegistry.update({
      where: { sourceKey },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        lastRowCount: result.rowCount,
        lastHighWaterMark: result.newHighWaterMark ?? row.lastHighWaterMark,
        consecutiveFails: 0,
      },
    });
    console.log(
      `[run-tax-scrape-local] SUCCEEDED sourceKey=${sourceKey} rows=${result.rowCount} rejects=${result.rejectCount} ${(durationMs / 1000).toFixed(1)}s`,
    );
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "failed",
        errorMessage: msg,
        finishedAt: new Date(),
        durationMs,
        runStatsJson: stats.snapshot() as unknown as object,
      },
    });
    await prisma.scrapeRegistry.update({
      where: { sourceKey },
      data: {
        lastRunAt: new Date(),
        lastFailureAt: new Date(),
        lastFailureReason: msg,
        consecutiveFails: { increment: 1 },
      },
    });
    console.error(`[run-tax-scrape-local] FAILED sourceKey=${sourceKey} after ${(durationMs / 1000).toFixed(1)}s: ${msg}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
