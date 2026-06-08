// ---------------------------------------------------------------------------
// POST /api/billing/checkout
//
// Creates a Stripe Checkout Session for the authenticated user and returns
// the session URL. Caller redirects window.location.href to that URL.
//
// Body: { priceId: string }
// Returns: { sessionUrl: string }
//
// Auth: requireUser() (must be signed in; not admin-gated).
//
// Notes:
//   - If the user already has a stripeCustomerId we pass it as `customer` so
//     Stripe reuses the existing customer record instead of duplicating it.
//   - We pass client_reference_id = internal userId so the webhook can match
//     the resulting subscription back to a User row even if the customer was
//     created inline by Checkout (the customer.id won't be on User yet).
//   - Success/cancel URLs default to /app/settings/billing.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { stripe } from "@/lib/stripe/client";

const BodySchema = z.object({
  priceId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId, email } = guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: body.priceId, quantity: 1 }],
      // Reuse existing Stripe customer if we have one; otherwise let Checkout
      // create one and we will capture it from the webhook.
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : email
        ? { customer_email: email }
        : {}),
      client_reference_id: user.id,
      // Stamp metadata on both the Session and the resulting Subscription so
      // the webhook can always recover the internal user id regardless of
      // which event fires first.
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/app/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/settings/billing?status=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe returned no session URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({ sessionUrl: session.url });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[billing/checkout] stripe.checkout.sessions.create failed", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
