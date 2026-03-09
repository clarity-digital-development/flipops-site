import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/robots.txt",                   // SEO crawlers
  "/sitemap.xml",                  // SEO crawlers
  "/reserve",                      // Pre-launch reservation page
  "/pricing",
  "/sign-up(.*)",
  "/sign-in(.*)",
  "/privacy",
  "/terms",
  "/api/reserve",                // Reservation form submission (legacy)
  "/api/reserve-spot",           // Reserve form → Google Sheets + Resend
  "/api/newsletter",             // Newsletter signup
  "/api/health",                 // Health check endpoint for Railway
  "/api/webhook(.*)",
  "/api/webhooks/(.*)",          // All webhook endpoints including n8n
  "/api/users",                  // Users endpoint for n8n workflows
  "/api/properties/(.*)",        // Property scoring endpoints
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
  "/not-authorized",
  "/app(.*)",                     // TODO: Remove this when ready for beta launch (re-enable Clerk auth)
  "/api/dashboard/(.*)",         // Dashboard API endpoints
  // REMOVED: /api/test and /api/debug/(.*) - these should require auth
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
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
