// ---------------------------------------------------------------------------
// POST /api/email/disconnect
//
// Clears `nylasGrantId` (and `connectedEmail`) out of User.investorProfile.
// Does NOT revoke the grant upstream at Nylas — that's a Sprint 3 add (call
// Nylas Grants API DELETE). Surface-level disconnect is enough for the UI
// contract: callers see connected: false on next /api/email/status call.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export async function POST() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorProfile: true },
  });

  let profile: Record<string, unknown> = {};
  if (user?.investorProfile) {
    try {
      const parsed = JSON.parse(user.investorProfile);
      if (parsed && typeof parsed === "object") profile = parsed;
    } catch {
      // Malformed — we'll just overwrite with an empty object below.
    }
  }

  // Strip the Nylas-specific keys without touching the rest of the profile.
  delete profile.nylasGrantId;
  delete profile.connectedEmail;

  await prisma.user.update({
    where: { id: userId },
    data: { investorProfile: JSON.stringify(profile) },
  });

  return NextResponse.json({ disconnected: true });
}
