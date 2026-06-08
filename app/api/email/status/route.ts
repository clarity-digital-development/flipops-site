// ---------------------------------------------------------------------------
// GET /api/email/status
//
// Returns { connected: boolean, email?: string } based on the presence of
// `nylasGrantId` inside User.investorProfile (JSON column).
//
// Used by the Settings → Integrations card to decide whether to render a
// 'Connect Email' or 'Connected: foo@bar | Disconnect' control.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorProfile: true },
  });

  if (!user?.investorProfile) {
    return NextResponse.json({ connected: false });
  }

  try {
    const profile = JSON.parse(user.investorProfile);
    const grantId: string | undefined = profile?.nylasGrantId;
    const email: string | undefined = profile?.connectedEmail;
    return NextResponse.json({
      connected: Boolean(grantId),
      ...(grantId && email ? { email } : {}),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
