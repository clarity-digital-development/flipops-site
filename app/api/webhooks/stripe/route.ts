// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
//
// Stripe webhook receiver. Verifies the Stripe-Signature header against
// STRIPE_WEBHOOK_SECRET, then dispatches on event.type.
//
// Handled events:
//   - checkout.session.completed       → set User.stripeCustomerId + tier + status
//   - customer.subscription.updated    → set User.tier from current price + status
//   - customer.subscription.deleted    → reset User.tier="free", status="cancelled"
//
// Identity resolution priority (per event):
//   1. metadata.userId (we stamp this in Checkout)
//   2. client_reference_id (Checkout sessions)
//   3. Reverse-lookup via User.stripeCustomerId
//
// Important: Next.js App Router strips bodies when you call request.json().
// Stripe signature verification requires the raw body — use request.text()
// and pass the string to constructEvent. We also export `runtime = "nodejs"`
// because the Stripe SDK uses Node crypto.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, tierForPriceId } from "@/lib/stripe/client";

export const runtime = "nodejs";
// Stripe webhooks must not be cached or revalidated.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "signature verification failed";
    // eslint-disable-next-line no-console
    console.warn("[stripe/webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignore unhandled events — return 200 so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[stripe/webhook] handler for ${event.type} threw:`, err);
    // Returning 500 tells Stripe to retry — desirable on transient DB blips.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    (session.metadata?.userId as string | undefined) ??
    session.client_reference_id ??
    null;

  if (!userId) {
    // eslint-disable-next-line no-console
    console.warn("[stripe/webhook] checkout.session.completed without userId metadata", {
      sessionId: session.id,
    });
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  // Determine the tier from the subscription's current price.
  let tier: ReturnType<typeof tierForPriceId> = "free";
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = sub.items.data[0]?.price.id;
    tier = tierForPriceId(priceId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      tier,
      subscriptionStatus: "active",
    },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const user = await resolveUserFromSubscription(sub);
  if (!user) return;

  const priceId = sub.items.data[0]?.price.id;
  const tier = tierForPriceId(priceId);

  // Map Stripe statuses → our internal subscriptionStatus vocabulary
  // (active | paused | cancelled).
  let status: "active" | "paused" | "cancelled";
  switch (sub.status) {
    case "active":
    case "trialing":
      status = "active";
      break;
    case "past_due":
    case "unpaid":
    case "paused":
    case "incomplete":
      status = "paused";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "cancelled";
      break;
    default:
      status = "active";
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: status === "cancelled" ? "free" : tier,
      subscriptionStatus: status,
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const user = await resolveUserFromSubscription(sub);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { tier: "free", subscriptionStatus: "cancelled" },
  });
}

async function resolveUserFromSubscription(sub: Stripe.Subscription) {
  // Priority 1: metadata.userId stamped at Checkout time.
  const metaUserId = (sub.metadata?.userId as string | undefined) ?? null;
  if (metaUserId) {
    const u = await prisma.user.findUnique({ where: { id: metaUserId }, select: { id: true } });
    if (u) return u;
  }
  // Priority 2: reverse-lookup by Stripe customer id.
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  if (customerId) {
    const u = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (u) return u;
  }
  // eslint-disable-next-line no-console
  console.warn("[stripe/webhook] could not resolve user for subscription", { subId: sub.id });
  return null;
}
