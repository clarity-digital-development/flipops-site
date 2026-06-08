"use client";

// ---------------------------------------------------------------------------
// Settings → Billing
//
// Shows the caller's current plan + subscription status, with:
//   - "Upgrade to Pro" / "Upgrade to Enterprise" buttons → POST /api/billing/checkout
//   - "Manage subscription" button → POST /api/billing/portal
//
// Both POSTs return a redirect URL that we navigate to via window.location.
// Surfaces ?status=success / ?status=cancelled from the Checkout return URL.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Sparkles, Zap, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

type Tier = "free" | "pro" | "enterprise";
type Status = "active" | "paused" | "cancelled";

interface BillingSnapshot {
  tier: Tier;
  subscriptionStatus: Status;
  hasStripeCustomer: boolean;
  prices: { pro: string | null; enterprise: string | null };
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`Failed to load billing (${r.status})`);
    return r.json() as Promise<BillingSnapshot>;
  });

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const { data, error, isLoading, mutate } = useSWR<BillingSnapshot>("/api/billing/me", fetcher);

  const [busy, setBusy] = useState<"pro" | "enterprise" | "portal" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function startCheckout(targetTier: "pro" | "enterprise") {
    setActionError(null);
    const priceId = data?.prices[targetTier];
    if (!priceId) {
      setActionError(
        `Stripe Price ID for ${TIER_LABEL[targetTier]} is not configured. Set STRIPE_PRICE_${targetTier.toUpperCase()} in env.`
      );
      return;
    }
    setBusy(targetTier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (!res.ok || !json.sessionUrl) {
        throw new Error(json?.error ?? "Failed to start checkout");
      }
      window.location.href = json.sessionUrl;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start checkout");
      setBusy(null);
    }
  }

  async function openPortal() {
    setActionError(null);
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.portalUrl) {
        throw new Error(json?.error ?? "Failed to open portal");
      }
      window.location.href = json.portalUrl;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open portal");
      setBusy(null);
    }
  }

  const tier = data?.tier ?? "free";
  const subStatus = data?.subscriptionStatus ?? "active";

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Billing</h1>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and payment method.
            </p>
          </div>
        </div>

        {status === "success" && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Subscription updated.</p>
              <p className="text-muted-foreground">
                Your new plan is active. It may take a few seconds for the tier badge to refresh.
              </p>
            </div>
          </div>
        )}
        {status === "cancelled" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Checkout cancelled.</p>
              <p className="text-muted-foreground">You can restart whenever you&apos;re ready.</p>
            </div>
          </div>
        )}
        {actionError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong.</p>
              <p className="text-muted-foreground">{actionError}</p>
            </div>
          </div>
        )}

        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Current plan</CardTitle>
                <CardDescription>Your active subscription.</CardDescription>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <Badge variant={tier === "free" ? "secondary" : "default"}>
                  {TIER_LABEL[tier]}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : error ? (
              <p className="text-sm text-red-500">Failed to load billing info.</p>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm">
                    Status:{" "}
                    <span
                      className={
                        subStatus === "active"
                          ? "text-emerald-500 font-medium"
                          : subStatus === "paused"
                          ? "text-amber-500 font-medium"
                          : "text-red-500 font-medium"
                      }
                    >
                      {STATUS_LABEL[subStatus]}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data?.hasStripeCustomer
                      ? "Use the portal to update payment method, change plans, or cancel."
                      : "You haven&apos;t started a subscription yet."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={!data?.hasStripeCustomer || busy !== null}
                  onClick={() => openPortal()}
                >
                  {busy === "portal" ? (
                    "Opening..."
                  ) : (
                    <>
                      Manage subscription <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">Pro</CardTitle>
              </div>
              <CardDescription>
                For solo investors and small teams running active pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                disabled={busy !== null || tier === "pro" || tier === "enterprise"}
                onClick={() => startCheckout("pro")}
              >
                {busy === "pro"
                  ? "Redirecting..."
                  : tier === "pro"
                  ? "Current plan"
                  : tier === "enterprise"
                  ? "Already on Enterprise"
                  : "Upgrade to Pro"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-base">Enterprise</CardTitle>
              </div>
              <CardDescription>
                For teams that need higher limits, priority data, and SSO.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant={tier === "enterprise" ? "outline" : "default"}
                disabled={busy !== null || tier === "enterprise"}
                onClick={() => startCheckout("enterprise")}
              >
                {busy === "enterprise"
                  ? "Redirecting..."
                  : tier === "enterprise"
                  ? "Current plan"
                  : "Upgrade to Enterprise"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Payments are processed by Stripe. You&apos;ll be redirected to a secure Stripe-hosted page.
        </p>
      </div>
    </div>
  );
}
