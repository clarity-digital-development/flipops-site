import { NextResponse, type NextRequest } from "next/server";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { requireAdmin } from "@/lib/auth/require-admin";

// ---------------------------------------------------------------------------
// POST /api/admin/queues/[queueName]/jobs/[jobId]/retry
// Retries a failed job in the named queue.
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ queueName: string; jobId: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const { queueName, jobId } = await params;
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
    const job = await queue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    await job.retry();
    return NextResponse.json({ ok: true, queueName, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await queue.close().catch(() => {});
    await connection.quit().catch(() => {});
  }
}
