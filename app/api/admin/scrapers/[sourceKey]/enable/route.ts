import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "tannercarlson@vvsvault.com";

// ---------------------------------------------------------------------------
// POST /api/admin/scrapers/[sourceKey]/enable
// Sets enabled=true, clears pausedReason. Worker-bullmq's 60s registry sync
// will pick up the change on its next tick.
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
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
  const updated = await prisma.scrapeRegistry.update({
    where: { sourceKey },
    data: { enabled: true, pausedReason: null, consecutiveP1Alerts: 0 },
  });

  return NextResponse.json({ ok: true, sourceKey, enabled: updated.enabled });
}
