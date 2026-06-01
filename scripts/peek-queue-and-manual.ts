/* eslint-disable no-console */
// Diagnostic: are manual-script jobs sitting unclaimed? Is the worker alive?

import IORedis from "ioredis";
import { Queue, QueueEvents } from "bullmq";
import { prisma } from "../lib/prisma";

const QUEUES = [
  "domain-duvalclerk",
  "domain-realauction",
  "internal-health",
  "internal-monitoring",
  "domain-default",
];

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("FATAL: REDIS_URL required");
    process.exit(2);
  }
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

  console.log("=".repeat(78));
  console.log("BullMQ queue state");
  console.log("=".repeat(78));
  for (const name of QUEUES) {
    const q = new Queue(name, { connection });
    const counts = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    console.log(`  ${name.padEnd(25)} waiting=${counts.waiting} active=${counts.active} completed=${counts.completed} failed=${counts.failed} delayed=${counts.delayed}`);
    // If anything is waiting or active, peek at the first one
    if (counts.waiting > 0) {
      const jobs = await q.getJobs(["waiting"], 0, 2);
      for (const j of jobs) {
        console.log(`    [WAITING] id=${j.id}  name=${j.name}  data=${JSON.stringify(j.data)}  timestamp=${new Date(j.timestamp).toISOString()}`);
      }
    }
    if (counts.active > 0) {
      const jobs = await q.getJobs(["active"], 0, 2);
      for (const j of jobs) {
        console.log(`    [ACTIVE]  id=${j.id}  name=${j.name}  data=${JSON.stringify(j.data)}  started=${j.processedOn ? new Date(j.processedOn).toISOString() : "?"}`);
      }
    }
    if (counts.failed > 0) {
      const jobs = await q.getJobs(["failed"], 0, 2);
      for (const j of jobs) {
        console.log(`    [FAILED]  id=${j.id}  name=${j.name}  reason=${j.failedReason?.slice(0, 200)}`);
      }
    }
    await q.close();
  }

  console.log("");
  console.log("=".repeat(78));
  console.log("BulkIngestJob — manual-script trigger rows (last 5)");
  console.log("=".repeat(78));
  const manual = await prisma.bulkIngestJob.findMany({
    where: { triggerType: "manual-script" },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { id: true, sourceKey: true, status: true, startedAt: true, finishedAt: true, durationMs: true, recordsFetched: true, errorMessage: true },
  });
  if (manual.length === 0) {
    console.log("  (no rows with triggerType='manual-script' — confirms worker hasn't claimed our manual jobs OR worker isn't running)");
  } else {
    for (const r of manual) {
      console.log(`  ${r.startedAt.toISOString()}  sourceKey=${r.sourceKey}  status=${r.status}  finished=${r.finishedAt?.toISOString() ?? "(in flight)"}  durMs=${r.durationMs}  rows=${r.recordsFetched}  err=${r.errorMessage?.slice(0, 80) ?? "(none)"}`);
    }
  }

  console.log("");
  console.log("=".repeat(78));
  console.log("Worker liveness check via internal-health queue completed-job timestamp");
  console.log("=".repeat(78));
  const hq = new Queue("internal-health", { connection });
  const lastCompleted = await hq.getJobs(["completed"], 0, 1);
  if (lastCompleted[0]) {
    const finishedAt = lastCompleted[0].finishedOn ?? lastCompleted[0].timestamp;
    const age = Math.round((Date.now() - finishedAt) / 1000);
    console.log(`  Last internal-health completion: ${new Date(finishedAt).toISOString()}  (${age}s ago)`);
    console.log(age < 120 ? "  → worker IS alive (heartbeat within 2 min)" : "  → worker may be DEAD (last heartbeat > 2 min ago)");
  } else {
    console.log("  No completed internal-health jobs — worker may never have been deployed");
  }
  await hq.close();

  await connection.quit();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
