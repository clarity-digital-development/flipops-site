import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "tannercarlson@vvsvault.com";

// ---------------------------------------------------------------------------
// POST /api/admin/queues/[queueName]/jobs/[jobId]/remove
// Removes a job from a queue (used to clear failed jobs we don't want to
// retry). The scheduled job entry is NOT removed — it'll re-fire on its
// next cron tick. Use the scrapers admin page to pause a scheduler.
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ queueName: string; jobId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { email: true },
  });
  if (user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    await job.remove();
    return NextResponse.json({ ok: true, queueName, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await queue.close().catch(() => {});
    await connection.quit().catch(() => {});
  }
}
