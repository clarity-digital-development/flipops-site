import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "tannercarlson@vvsvault.com";

// ---------------------------------------------------------------------------
// POST /api/admin/scrapers/[sourceKey]/disable
// Sets enabled=false with a manual pausedReason. Worker-bullmq's 60s sync
// will remove the job scheduler entry on next tick.
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> },
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
