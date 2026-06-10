# M1 — Foundations: Stop the Bleeding, Ship the Receipts

> Days 1-30. Everything here is either calendar-gated (labels), prerequisite (geocode,
> requireUser sweep), or maximum demo-impact-per-effort (coverage page, real comps).
> Update item status in place; mirror counts to `README.md`.

---

### M1.1 — Label-bleed P0: stop destroying ML training data
**Status:** TODO · **Effort:** 2-3 days · **Deps:** none (M1.6 helps but don't wait)
**Why:** `LeadEvent`, `Activity`, `DealAnalysis`, `Offer`, `Contract` = ALL 0 rows. The
behavioral pipeline (`lib/behavior/client.ts` → API) is correctly wired but the pre-launch
auth bypass 401s most events and a silent `no_user` drop discards the rest. Labels are
calendar-gated — unfixed weeks are unrecoverable.
**What/How:**
1. Find the server-side receiver for `trackLeadEvent` (grep `lib/behavior` for the POST target).
   Add an **anonymous-session path**: accept events with a client-generated `sessionId` when
   no user exists; store with `userId=null, sessionId=X`. Link sessions→users at signup
   (UPDATE ... WHERE sessionId IN ...).
2. Remove/instrument the silent `no_user` drop — every dropped event must log loudly.
3. **Server-side outcome emission**: `offer_made`, `contract_signed`, `closed` must be emitted
   transactionally from the Offer/Contract API routes (POST /api/offers, POST /api/contracts,
   status-change PATCH) — never client best-effort. Add the emission calls in those routes.
4. **User auto-provisioning**: when an authenticated request hits requireUser() and no User row
   exists, CREATE it (jit-provisioning) instead of 404. This also unblocks OPS-4 (TelnyxNumber seed).
5. **Health stat**: a `LeadEvents/day` counter somewhere visible (admin page or log line cron)
   so a 0-event week can never go unnoticed again.
6. `CampaignRecipient.repliedAt` plumbing: inbound Telnyx SMS reply (webhook-router
   `handleMessageReceived`) should look up CampaignRecipient by `toPhoneNumber`+recent sentAt
   and stamp repliedAt + bump Campaign.replyCount.
7. **Scorer snapshot logging**: log the per-family point vector + scorer version + searchContext
   into `leadSnapshot` (or equivalent JSON column) on every scored event — cheap now,
   impossible to backfill later. (From AUDIT-A3 sequencing note.)
**Done when:** events visibly accrue in the DB from anonymous + authed sessions; outcome labels
write transactionally; the health stat exists; a test SMS reply stamps repliedAt.
**Source:** AUDIT-A3 (the "single most expensive silent failure" finding).

---

### M1.2 — /api/comps rewrite onto ParcelSale
**Status:** TODO · **Effort:** 2-4 days · **Deps:** M1.3 strongly recommended first (real distance needs lat/lng)
**Why:** Current comps query the user's own distressed-lead Property table (selection-biased,
depresses ARV — the opposite of what a flipper needs), fake distance with a random number,
and call a DOR tax-assessment number an "AVM" — while **1,976,625 ParcelSale rows are
referenced by zero API routes**. This is the platform's biggest data asset going unused.
**What/How:**
1. Rewrite `/api/comps` (find under app/api/) to query ParcelSale JOIN Parcel:
   same county, similar sqft (±25%), similar yearBuilt (±15y), sale within 12mo,
   `qualCode` arms-length filter, ORDER BY haversine distance using Parcel.latitude/longitude.
2. Return per-comp provenance: saleDate, price, distance (real), source='FL-DOR-SDF'.
3. Underwriting page consumes the new shape — check `app/app/underwriting/page-content.tsx`
   comps tab + the F2 demo-property path (demo property keeps its synthetic comps).
**Done when:** comps for a real Jacksonville property return actual nearby sales with real
distances; no random numbers anywhere in the comps path.
**Source:** AUDIT-A4 misfit #2.

---

### M1.3 — FGIO geocode join: lat/lng on 11M parcels
**Status:** TODO · **Effort:** ~1 day (mostly runtime) · **Deps:** none
**Why:** latitude/longitude = 0.0% on ALL 10,998,035 parcels. Blocks map pins from real data,
distance-based comps (M1.2), and every spatial ML feature. The ingester ALREADY EXISTS —
this was a Week-2 FL-COVERAGE-PLAN item that simply never ran.
**What/How:**
1. Read `lib/data-sources/bulk/fl-fgio.ts` — understand its input (FloridaGIO statewide
   parcel geometry download) and UPSERT pattern.
2. Download the FGIO source (statewide parcels GeoJSON/shapefile — the ingester header
   documents the URL), run the join against Railway PG. Expect hours of runtime at the
   ~1190 rows/sec ingest ceiling; run with the connection-drop retry + 60s transaction
   timeout patterns from the F1 BulkIngester (see memory: FL DOR ingest performance).
3. Verify: `SELECT COUNT(*) FROM flipops."Parcel" WHERE latitude IS NOT NULL` > 10M.
**Done when:** >90% parcels have coordinates; /app/leads map renders pins from Parcel coords
(today pins come from city-coordinates.ts fallback only).
**Source:** AUDIT-A1 gap #2.

---

### M1.4 — Tax-delinquency data-quality bugs (3 counties)
**Status:** TODO · **Effort:** 1-2 days · **Deps:** none
**Why:** Three bugs poison per-metro exposure numbers (the headline demo stat):
Broward (12011) = exactly 1 row; Hillsborough (12057) = 18,385 rows summing to $0
(amount extraction broken); Palm Beach (12099) = implausibly sparse 573 rows.
Healthy references: Miami-Dade $456.2M, Orange $132.7M, Duval $84.2M.
**What/How:** Re-run/debug the per-metro scrapers (see `lib/scrapers/` + the per-metro
source playbook in memory/project_top5_metro_tax_delinquent.md). Broward likely a scrape
or rescore failure; Hillsborough an amount-parse regression; PB possibly a pagination stop.
**Done when:** all 6 metros show plausible row counts + nonzero amounts; TaxDelinquencySummary
re-scored (scripts/rescore-tax-delinquent.ts).
**Source:** AUDIT-A1 gap #3.

---

### M1.5 — DELETE-NOW cleanup (~19,400 lines) + scorer extraction
**Status:** TODO · **Effort:** 1-2 days · **Deps:** none, but do scorer extraction FIRST
**Why:** Parasitic weight: dead scripts, orphaned components, REAPI corpse. Also the live
scorer is misfiled inside the dead provider's directory.
**What/How (order matters):**
1. Extract `lib/reapi/utils/distress-scorer.ts` (v2.1, LIVE) + the `REAPIPropertyData` type
   → `lib/scoring/`. Update the ~2 import sites. Rename type to `PropertyScoreInput`-ish.
2. THEN delete `lib/reapi/` + `app/api/reapi/` wholesale.
3. Delete ~110 one-off probe/inspect/test scripts + 434KB probe-artifact dirs (full list in
   AUDIT-A5). Keep operational scripts (scrapers, seeds, triggers, rescore-*).
4. Delete 20 orphaned app/components files (incl. all 8 tool-consolidation versions),
   `page-old.tsx`, placeholder-page, CSS backup, HydrationProbe, debug-clerk page (env leak).
5. Extract still-used TYPES from leads/vendors seed-data, then delete the dead seed arrays.
6. Move 24 historical docs → `docs/archive/` (list in AUDIT-A5).
7. Remove broken `seed:railway` npm script.
**Done when:** typecheck clean, app boots, grep "reapi" returns only lib/scoring comments.
**DO NOT TOUCH:** anything Clerk (that's M1.6/M2.5/M3.6), `components/dialer/consent-badge.tsx`
(live compliance feature), county-clerk scraper files matching "clerk" greps.
**Source:** AUDIT-A5.

---

### M1.6 — requireUser() sweep: 28 routes (Clerk migration step 1)
**Status:** TODO · **Effort:** 1-2 days · **Deps:** none · **Unblocks:** M1.1 fully, M2.5
**Why:** ~28 API routes still call Clerk's `auth()` directly. Sweeping them onto the canonical
`lib/auth/require-user.ts` helper makes the eventual NextAuth swap a 3-file change instead of
a 41-file change, AND centralizes the jit-provisioning from M1.1 step 4.
**What/How:** grep `from '@clerk/nextjs/server'` under app/api/; for each route, replace the
inline auth()+findUnique with `const g = await requireUser(); if ('error' in g) return g.error;`.
Preserve the FO_API_KEY service-key paths untouched.
**Done when:** only require-user.ts, require-admin.ts, middleware.ts, and UI components import
Clerk directly.
**Source:** AUDIT-A5 migration plan step 1.

---

### M1.7 — Data Health & Coverage page (the crown jewel)
**Status:** TODO · **Effort:** 3-4 days · **Deps:** M1.3 (choropleth needs nothing, but stats benefit)
**Why:** The single highest demo-impact-per-effort build in the estate. Today /app/data-sources
is 100% hardcoded fiction. Everything a real version needs already exists: `ScrapeRegistry`,
`BulkIngestJob` audit rows, county counts — already rendered in admin-only /app/admin/scrapers.
**This page IS the differentiation vs PropStream** — no reseller can show live scraper receipts.
**What/How:**
1. Rebuild `app/app/data-sources/page.tsx` as user-facing **Data Health & Coverage**:
   - Headline stats: 10.9M parcels · 67/67 FL counties · 1.9M sales · 105K tax-delinquent · $691M exposure
   - FL county choropleth (SVG map; color = signal coverage depth per county)
   - Per-source cards: name, what it provides, last-run (from BulkIngestJob), cadence,
     record count, freshness state (green/amber/red vs expected cadence)
2. Wire to real queries (aggregate BulkIngestJob + count(*) per table; cache 5-15min).
3. Add to sidebar (it's currently orphaned).
**Done when:** an investor can look at this page and understand the data moat in 10 seconds.
**Source:** AUDIT-A4 misfit #1 + missing-surface #1.

---

### M1.8 — Zero-cost derived signals (pure SQL over data in hand)
**Status:** TODO · **Effort:** ~1 day · **Deps:** none
**What/How:**
1. **NEWLY_ABSENTEE**: year-over-year NAL mailing-address diff (owner mailing address changed
   away from situs = just became absentee = high-motivation window). Pure SQL; add boost to scorer.
2. **Owner-occupancy code**: situs ≡ mailing compare (96-100% field completeness) → persist as
   a Parcel column or computed flag; feeds scorer + filters.
3. **DOR_UC → land-use description** lookup table (the codes exist on every parcel; human-readable
   labels are a static mapping).
**Done when:** both signals queryable + the scorer consumes NEWLY_ABSENTEE.
**Source:** AUDIT-A1 cheap wins + AUDIT-A2 zero-cost win.

---

### M1.9 — CLAUDE.md stale-claims fix
**Status:** TODO · **Effort:** ~2 hours · **Deps:** ideally after M1.5/M1.6 so it describes reality
**Why:** CLAUDE.md actively misleads every agent onboarded onto the repo: claims REAPI
reactivation plans, Clerk-auth-forever, references docs deleted in the teardown
(DECISIONS.md/TESTS.md), stale homepage section list, "Coming Q2 2025" claims.
**What/How:** Rewrite the stale sections: Tech Stack (auth status = Clerk-live-NextAuth-planned),
Environment Variables (REAPI gone, Telnyx/Stripe/DocuSign/Sentry added), Feature Status
(reflect sprints 1-3 + teardown), Project Structure (roadmap/ exists, reapi/ gone),
add a pointer to docs/roadmap/README.md near the top.
**Done when:** a fresh agent reading CLAUDE.md gets an accurate picture.
**Source:** AUDIT-A5 + this roadmap's existence.
