// ---------------------------------------------------------------------------
// GET /api/billing/me
//
// Returns the caller's current billing snapshot for the Settings → Billing
// page. Kept separate from /api/settings so this endpoint can evolve
// independently of the broader settings shape.
//
// Returns: {
//   tier: "free" | "pro" | "enterprise",
//   subscriptionStatus: "active" | "paused" | "cancelled",
//   hasStripeCustomer: boolean,
//   prices: { pro?: string, enterprise?: string }   // Stripe Price IDs from env
// }
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
    select: {
      tier: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    prices: {
      pro: process.env.STRIPE_PRICE_PRO ?? null,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    },
  });
}
