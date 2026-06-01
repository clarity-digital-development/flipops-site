import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ---------------------------------------------------------------------------
// POST /api/admin/scrapers/[sourceKey]/enable
// Sets enabled=true, clears pausedReason. Worker-bullmq's 60s registry sync
// will pick up the change on its next tick.
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const { sourceKey } = await params;
  const updated = await prisma.scrapeRegistry.update({
    where: { sourceKey },
    data: { enabled: true, pausedReason: null, consecutiveP1Alerts: 0 },
  });

  return NextResponse.json({ ok: true, sourceKey, enabled: updated.enabled });
}
