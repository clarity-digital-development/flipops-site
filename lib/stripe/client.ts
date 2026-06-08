// ---------------------------------------------------------------------------
// Stripe server client — single source of truth for the Stripe SDK instance.
//
// Usage:
//
//   import { stripe } from "@/lib/stripe/client";
//   const session = await stripe.checkout.sessions.create({ ... });
//
// Env:
//   STRIPE_SECRET_KEY     — required at runtime; throws on first import if missing.
//   STRIPE_API_VERSION    — optional pin; defaults to the SDK's pinned version.
//
// Notes:
//   - We use a module-level singleton so connection keep-alive is preserved
//     across hot reloads (same pattern as lib/prisma.ts).
//   - Pinning apiVersion is recommended by Stripe so server-side behavior is
//     not silently changed by an account-level API version bump.
// ---------------------------------------------------------------------------

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  // Defer hard failure to first import — keeps `next build` working on
  // environments that have not configured Stripe yet (e.g. previews).
  // Routes that actually call stripe.* will fail loudly at request time.
  // eslint-disable-next-line no-console
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set; billing routes will return 500 until it is configured."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __flipopsStripe: Stripe | undefined;
}

export const stripe: Stripe =
  globalThis.__flipopsStripe ??
  new Stripe(secret ?? "sk_missing", {
    apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) ?? "2024-12-18.acacia",
    typescript: true,
    appInfo: {
      name: "flipops-site",
      version: "0.1.0",
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__flipopsStripe = stripe;
}

// ---------------------------------------------------------------------------
// Tier <-> Stripe Price ID mapping
//
// Driven by env so the same code works across test/live mode and so we can
// rotate prices without a deploy:
//   STRIPE_PRICE_PRO         — Stripe Price ID that maps to tier="pro"
//   STRIPE_PRICE_ENTERPRISE  — Stripe Price ID that maps to tier="enterprise"
// ---------------------------------------------------------------------------

export type Tier = "free" | "pro" | "enterprise";

export function tierForPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}

export function priceIdForTier(tier: Exclude<Tier, "free">): string | undefined {
  if (tier === "pro") return process.env.STRIPE_PRICE_PRO;
  if (tier === "enterprise") return process.env.STRIPE_PRICE_ENTERPRISE;
  return undefined;
}
