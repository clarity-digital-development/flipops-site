import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ---------------------------------------------------------------------------
// POST /api/admin/scrapers/[sourceKey]/disable
// Sets enabled=false with a manual pausedReason. Worker-bullmq's 60s sync
// will remove the job scheduler entry on next tick.
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const { sourceKey } = await params;
  let reason = "manually disabled via admin UI";
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.reason === "string" && body.reason.trim().length > 0) {
      reason = body.reason.trim().slice(0, 500);
    }
  } catch {
    // ignore JSON parse errors
  }

  const updated = await prisma.scrapeRegistry.update({
    where: { sourceKey },
    data: { enabled: false, pausedReason: reason },
  });

  return NextResponse.json({ ok: true, sourceKey, enabled: updated.enabled, reason });
}
