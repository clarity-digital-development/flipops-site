import { NextResponse, type NextRequest } from "next/server";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// Mirrors worker-bullmq.ts QUEUE_BY_DOMAIN so we enqueue on the same queue
// the scheduler would use.
const QUEUE_BY_DOMAIN: Record<string, string> = {
  "jaxdailyrecord.com":       "domain-jaxdailyrecord",
  "lienhub.com":              "domain-lienhub",
  "realauction.com":          "domain-realauction",
  "miamidade.gov":            "domain-miamidade",
  "county-taxes.net":         "domain-county-taxes",
  "floridapublicnotices.com": "domain-flpublicnotices",
  "duvalclerk.com":           "domain-duvalclerk",
  "floridarevenue.com":       "bulk-ingest",
};

// ---------------------------------------------------------------------------
// POST /api/admin/scrapers/[sourceKey]/trigger
// Enqueues a one-shot job for the given sourceKey on its domain queue.
// Worker-bullmq picks it up immediately (subject to per-queue concurrency cap).
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const { sourceKey } = await params;

  // Look up the registry row for the source's domain.
  const row = await prisma.scrapeRegistry.findUnique({ where: { sourceKey } });
  if (!row) {
    return NextResponse.json({ error: `Unknown sourceKey: ${sourceKey}` }, { status: 404 });
  }
  const queueName = QUEUE_BY_DOMAIN[row.domain] ?? "domain-default";

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json({ error: "REDIS_URL not configured" }, { status: 500 });
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  const queue = new Queue(queueName, { connection });

  try {
    const job = await queue.add(
      sourceKey,
      { sourceKey, trigger: "manual-admin" },
      {
        attempts: 1, // operator-triggered — don't retry-storm
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    return NextResponse.json({
      ok: true,
      sourceKey,
      queue: queueName,
      jobId: job.id,
    });
  } finally {
    await queue.close().catch(() => {});
    await connection.quit().catch(() => {});
  }
}
