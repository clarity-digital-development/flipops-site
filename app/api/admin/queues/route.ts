import { NextResponse } from "next/server";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/queues
// Returns counts + recent failed jobs for every queue worker-bullmq owns.
// Native Next-friendly substitute for @bull-board (which expects Express
// middleware that doesn't fit App Router cleanly).
// ---------------------------------------------------------------------------

const KNOWN_QUEUES = [
  "internal-health",
  "internal-monitoring",
  "bulk-ingest",
  "domain-jaxdailyrecord",
  "domain-duvalclerk",
  "domain-realauction",
  "domain-lienhub",
  "domain-county-taxes",
  "domain-miamidade",
  "domain-flpublicnotices",
  "domain-default",
] as const;

const FAILED_JOB_LIMIT = 10;

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json({ error: "REDIS_URL not configured" }, { status: 500 });
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  try {
    const queues = await Promise.all(
      KNOWN_QUEUES.map(async (name) => {
        const q = new Queue(name, { connection });
        try {
          const counts = await q.getJobCounts(
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
            "waiting-children",
          );
          const failedJobs = await q.getJobs(["failed"], 0, FAILED_JOB_LIMIT - 1);
          return {
            name,
            counts,
            failed: failedJobs.map((j) => ({
              id: j.id ?? null,
              name: j.name,
              data: j.data,
              attemptsMade: j.attemptsMade,
              failedReason: j.failedReason ?? null,
              finishedOn: j.finishedOn ?? null,
              processedOn: j.processedOn ?? null,
              timestamp: j.timestamp,
              stacktrace: j.stacktrace?.slice(0, 3) ?? [],
            })),
          };
        } finally {
          await q.close().catch(() => {});
        }
      }),
    );

    return NextResponse.json({ queues });
  } finally {
    await connection.quit().catch(() => {});
  }
}
