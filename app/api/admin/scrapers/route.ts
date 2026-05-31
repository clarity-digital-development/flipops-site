import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "tannercarlson@vvsvault.com";

// ---------------------------------------------------------------------------
// GET /api/admin/scrapers
// Returns the full ScrapeRegistry with recent BulkIngestJob runs joined in.
// Admin-only.
// ---------------------------------------------------------------------------

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { email: true },
  });
  if (user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.scrapeRegistry.findMany({
    orderBy: [{ enabled: "desc" }, { domain: "asc" }, { sourceKey: "asc" }],
  });

  // For each, pull the 5 most recent BulkIngestJob audit rows.
  const sourceKeys = rows.map((r) => r.sourceKey);
  const recentRuns = sourceKeys.length === 0
    ? []
    : await prisma.bulkIngestJob.findMany({
        where: { sourceKey: { in: sourceKeys } },
        orderBy: { startedAt: "desc" },
        take: 5 * sourceKeys.length, // overshoot, dedupe client-side per sourceKey
        select: {
          id: true,
          sourceKey: true,
          status: true,
          tier: true,
          recordsUpserted: true,
          rejectCount: true,
          http4xxCount: true,
          http5xxCount: true,
          cfChallengeCount: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          errorMessage: true,
        },
      });

  // Group runs by sourceKey, keep newest 5 each.
  const runsBySourceKey: Record<string, typeof recentRuns> = {};
  for (const run of recentRuns) {
    if (!run.sourceKey) continue;
    const list = (runsBySourceKey[run.sourceKey] ??= []);
    if (list.length < 5) list.push(run);
  }

  return NextResponse.json({
    registry: rows,
    runs: runsBySourceKey,
  });
}
