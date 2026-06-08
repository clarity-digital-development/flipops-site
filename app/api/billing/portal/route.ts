// ---------------------------------------------------------------------------
// POST /api/billing/portal
//
// Creates a Stripe Customer Portal session for the authenticated user and
// returns its URL. Caller redirects window.location.href to that URL.
//
// Returns: { portalUrl: string }
//
// Auth: requireUser(). User must have a stripeCustomerId (i.e. has completed
// at least one Checkout) — otherwise 409.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { stripe } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer for this user — complete checkout first." },
      { status: 409 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/app/settings/billing`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[billing/portal] stripe.billingPortal.sessions.create failed", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
