// ---------------------------------------------------------------------------
// Auth.js (NextAuth v5) middleware — M2.5 Clerk→NextAuth migration.
//
// Instantiates NextAuth from the EDGE-SAFE auth.config.ts (no Prisma/bcrypt
// imports here — split-config pattern). The route lists and the evaluation
// ORDER (admin gate BEFORE the public-route bypass) are preserved verbatim
// from the Clerk-era middleware.
// ---------------------------------------------------------------------------

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Minimal replacement for Clerk's createRouteMatcher. Supports the only
 * pattern syntax this file ever used: literal paths + `(.*)` wildcards.
 * Literal segments are regex-escaped; `(.*)` matches any (possibly empty)
 * remainder, identical to Clerk/path-to-regexp semantics for these patterns.
 */
function createRouteMatcher(patterns: string[]): (req: NextRequest) => boolean {
  const regexes = patterns.map((pattern) => {
    const source = pattern
      .split("(.*)")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(.*)");
    return new RegExp(`^${source}$`);
  });
  return (req: NextRequest) =>
    regexes.some((re) => re.test(req.nextUrl.pathname));
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/robots.txt",                   // SEO crawlers
  "/sitemap.xml",                  // SEO crawlers
  "/reserve",                      // Pre-launch reservation page
  "/pricing",
  "/features(.*)",                 // Features hub + subpages
  "/for/(.*)",                     // Persona pages (wholesalers, flippers, BRRRR)
  "/demo",                         // Demo page
  "/about",                        // About page
  "/faq",                          // FAQ page
  "/blog(.*)",                     // Blog pages
  "/tools(.*)",                    // Free tool pages (SEO)
  "/compare(.*)",                  // Comparison pages
  "/sign-up(.*)",
  "/sign-in(.*)",
  "/privacy",
  "/terms",
  "/api/auth(.*)",               // Auth.js handlers (signin/signout/session/csrf)
  "/api/reserve",                // Reservation form submission (legacy)
  "/api/reserve-spot",           // Reserve form → Google Sheets + Resend
  "/api/newsletter",             // Newsletter signup
  "/api/health",                 // Health check endpoint for Railway
  "/api/webhook(.*)",
  "/api/webhooks/(.*)",          // All webhook endpoints
  "/api/users",                  // Users endpoint
  "/api/properties/(.*)",        // Property scoring endpoints
  "/api/auctions/(.*)",          // M3.4 auction calendar (public county records)
  "/api/notifications(.*)",      // Notifications endpoint
  "/api/deals/approve",          // G1 endpoint
  "/api/deals/approve/status",   // G1 monitoring endpoint
  "/api/deals/bid-spread/status", // G2 monitoring endpoint
  "/api/deals/budget-variance/status", // G3 monitoring endpoint
  "/api/deals/change-orders/status", // G4 monitoring endpoint
  "/api/deals/stalled",          // Pipeline monitoring endpoint
  "/api/deals/active",           // Active deals for data refresh
  "/api/deals/sync-all",         // Bulk deal sync endpoint
  "/api/deals/(.*)/refresh",     // Deal data refresh endpoint
  "/api/contractors/performance", // Contractor performance tracking
  "/api/contractors/(.*)/update-score", // Update contractor reliability scores
  "/api/projects/(.*)",          // All project endpoints
  "/api/bids/award",             // G2 endpoint
  "/api/bids/award/status",      // G2 monitoring endpoint
  "/api/invoices/ingest",        // G3 endpoint
  "/api/invoices/status",        // Invoice monitoring endpoint
  "/api/change-orders/submit",   // G4 endpoint
  "/api/change-orders/status",   // Change order monitoring endpoint
  "/api/panels/truth",           // Panel endpoint
  "/api/panels/money",           // Panel endpoint
  "/api/panels/motion",          // Panel endpoint
  "/api/leads/events",           // M1.1: behavioral telemetry accepts ANONYMOUS (sessionId) events;
                                 // the route resolves identity itself via requireUser() when present.
                                 // NOTE: /api/leads/events/link is intentionally NOT public.
  "/not-authorized",
  "/app(.*)",                     // TODO: Remove this when ready for beta launch (re-enable auth)
  "/api/dashboard/(.*)",         // Dashboard API endpoints
  // REMOVED: /api/test and /api/debug/(.*) - these should require auth
]);

// ---------------------------------------------------------------------------
// Admin-only matchers — these ALWAYS require an Auth.js session + downstream
// requireAdmin() role check, regardless of the `/app(.*)` pre-launch public
// bypass above. Without this, /app/admin/* and /api/admin/* pages would
// inherit the pre-launch public bypass and be reachable without sign-in.
//
// This is a route-level FIRST gate (session required); the per-route
// `requireAdmin()` helper enforces the actual email/role check.
// ---------------------------------------------------------------------------
const isAdminRoute = createRouteMatcher([
  "/app/admin(.*)",
  "/api/admin(.*)",
]);

/** Mirror Clerk's auth.protect(): 401 JSON for API/trpc, redirect for pages. */
function deny(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(signInUrl);
}

export default auth((req) => {
  const isSignedIn = Boolean(req.auth);

  // Admin routes get a strict gate ahead of the public-route check — the
  // `/app(.*)` pre-launch bypass MUST NOT apply to admin surfaces.
  if (isAdminRoute(req)) {
    if (!isSignedIn) return deny(req);
    return;
  }
  if (!isPublicRoute(req)) {
    if (!isSignedIn) return deny(req);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
