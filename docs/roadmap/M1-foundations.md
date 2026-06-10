# M1 — Foundations: Stop the Bleeding, Ship the Receipts

> Days 1-30. Everything here is either calendar-gated (labels), prerequisite (geocode,
> requireUser sweep), or maximum demo-impact-per-effort (coverage page, real comps).
> Update item status in place; mirror counts to `README.md`.

---

### M1.1 — Label-bleed P0: stop destroying ML training data
**Status:** DONE (2026-06-09) · **Effort:** 2-3 days · **Deps:** none (M1.6 helps but don't wait)
**Outcome:** Full pipeline shipped. Anonymous-session path live: `/api/leads/events` accepts
client `sessionId` (route added to middleware public list — events were 401'd before reaching
the route), every rejection logs loudly; session→user linking via `/api/leads/events/link`
(protected). Outcome labels (`offer_made`/`contract_signed`/`closed`) emit transactionally via
`emitLeadEvent(tx)` inside the Offer/Contract route `$transaction`s, with scorer-version +
family-breakdown snapshots (`lib/events/emit.ts`). Inbound Telnyx SMS stamps
`CampaignRecipient.repliedAt` + replyCount (webhook-router, non-fatal). Health stat at
`/api/admin/events-health`. JIT provisioning in `requireUser()`. Schema: `LeadEvent.userId`
nullable + `sessionId`, `CampaignRecipient.repliedAt` (db push applied). Smoke-verified on
live DB (anonymous insert persisted with snapshot); a real inbound-SMS repliedAt check
post-deploy is the only outstanding verification.
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
**Status:** DONE (2026-06-09) · **Effort:** 2-4 days · **Deps:** M1.3 strongly recommended first (real distance needs lat/lng)
**Outcome:** `/api/comps` fully rewritten onto ParcelSale JOIN Parcel with an empirically
validated arms-length `qualCode` filter ('01'/'02' in; '05' multi-parcel and '11'/'14'
nominal transfers out) + price floor; real haversine distance when coords exist, ZIP-match
display fallback until the M1.3 geocode run lands; underwriting page consumes the new shape
(nullable distance/beds/baths, weighted-ARV null-distance prior). No random numbers remain.
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
**Status:** PARTIAL (2026-06-09 — code done, statewide run pending) · **Effort:** ~1 day (mostly runtime) · **Deps:** none
**Outcome:** Streaming shapefile+GeoJSON ingester built (`lib/data-sources/bulk/fl-fgio-bulk.ts`)
with Hub download automation + batched UPDATE-only SQL, CLI at `scripts/ingest-fl-geocodes.ts`
(`--download <fips|all>`, `--dry-run`). Key findings: Hub Download API v1 only serves SHAPEFILE
for FGIO items and defaults to FL Albers meters — `spatialRefId=4326` required. The statewide
backfill run is queued as a post-deploy execution; Parcel lat/lng is still 0% in PG.
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
**Status:** PARTIAL (2026-06-09 — root causes fixed in code, prod re-runs pending) · **Effort:** 1-2 days · **Deps:** none
**Outcome:** Root causes diagnosed and fixed: Broward's LienHub county-held source truthfully
has ~1 row most of the year — replaced with a new TaxSys govhub CSV scraper
(`lib/scrapers/vendors/broward-tax-delinquent-csv.ts`, now primary in dispatch); Hillsborough
gets amounts via a certificate Face Amount join second pass; `rescore-tax-delinquent.ts` now
dedups latest capture per (county, apn, doc) and stops claiming "$0.00 owed" when amounts are
uncaptured. Diagnostics added (`scripts/diagnose-tax-delinquency.ts`). STILL OPEN: production
scraper re-runs + rescore — DB still shows Broward=1 summary row and Hillsborough sum=$0
(verified via diagnostic 2026-06-10).
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
**Status:** DONE (2026-06-09) · **Effort:** 1-2 days · **Deps:** none, but do scorer extraction FIRST
**Outcome:** Scorer v2.1 extracted to `lib/scoring/distress-scorer.ts` first, then `lib/reapi/`
+ `app/api/reapi/` deleted wholesale; ~100 dead scripts + probe-artifact dirs removed; 25
orphaned app/components deleted; 23 historical docs moved to `docs/archive/`; broken
`seed:railway` npm script removed. Audit corrections: newsletter-form, interactive-score-demo,
trust-bar are LIVE imports (footer/hero-v2) — kept. Post-cleanup fix: RealAuction macro test
fixtures were restored into `tests/scrapers/fixtures/`. Typecheck exits 0 (root + workers).
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
**Status:** DONE (2026-06-09) · **Effort:** 1-2 days · **Deps:** none · **Unblocks:** M1.1 fully, M2.5
**Outcome:** Routes swept onto canonical `requireUser()`, which now JIT-provisions the User
row (upsert on clerkId from Clerk profile; P2002 fallback adopts pre-Clerk same-email rows;
404 only when Clerk has no email). Verified: exactly ONE API route still imports Clerk
directly — `app/api/leads/events/route.ts`, deliberately left for M1.1's anonymous-session
rework. Service-key (FO_API_KEY) paths untouched.
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
**Status:** DONE (2026-06-09) · **Effort:** 3-4 days · **Deps:** M1.3 (choropleth needs nothing, but stats benefit)
**Outcome:** `app/app/data-sources/page.tsx` fully rebuilt as user-facing Data Health &
Coverage backed by new `/api/data-health` (requireUser, 10-min in-memory cache): real headline
stats validated against prod (10,998,035 parcels · 67/67 counties · 1,976,625 sales · 105,586
tax-delinquent · $686.8M owed · 532 foreclosures · 163 future auctions), 67-tile FL county
coverage grid, per-source freshness cards from ScrapeRegistry/BulkIngestJob, honest provenance
footer. Added to sidebar for all personas (full aggregate batch runs in ~1.2s).
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
**Status:** PARTIAL (2026-06-09 — code done, statewide run pending) · **Effort:** ~1 day · **Deps:** none
**Outcome:** `Parcel.ownerOccupied` column landed (db push applied); derivation script built
(`scripts/derive-owner-occupancy.ts` — per-county set-based UPDATE, `--county`/`--dry-run`)
and live-verified on Calhoun 12013 (13,236 rows in 9.8s, 20.9% occupied — rural-plausible,
spot-checked clean); DOR_UC → land-use lookup shipped (`lib/data-sources/dor-uc-codes.ts`,
100-code DR-505 table); scorer wired (promote sets `absenteeOwner = parcel.ownerOccupied ===
false`). STILL OPEN: the statewide backfill run (queued post-deploy alongside the M1.3
geocode run) and the NEWLY_ABSENTEE year-over-year diff (TODO block in the script).
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
**Status:** DONE (2026-06-09) · **Effort:** ~2 hours · **Deps:** ideally after M1.5/M1.6 so it describes reality
**Outcome:** CLAUDE.md surgically corrected: auth = Clerk-live + requireUser()-only route
guard with JIT provisioning (NextAuth migration in progress); REAPI/ATTOM env vars and
"plan to reactivate" claims removed (property data is self-scraped); deleted-doc references
(DECISIONS.md/TESTS.md) and lib/reapi pointers fixed (scorer = lib/scoring); Feature Status
now documents the scrape-first data layer (11M FL parcels), Data Health page, and real comps
endpoint; "Coming Q2 2025" + deleted homepage-component sections removed; roadmap statuses
mirrored here and in README.md.
**Why:** CLAUDE.md actively misleads every agent onboarded onto the repo: claims REAPI
reactivation plans, Clerk-auth-forever, references docs deleted in the teardown
(DECISIONS.md/TESTS.md), stale homepage section list, "Coming Q2 2025" claims.
**What/How:** Rewrite the stale sections: Tech Stack (auth status = Clerk-live-NextAuth-planned),
Environment Variables (REAPI gone, Telnyx/Stripe/DocuSign/Sentry added), Feature Status
(reflect sprints 1-3 + teardown), Project Structure (roadmap/ exists, reapi/ gone),
add a pointer to docs/roadmap/README.md near the top.
**Done when:** a fresh agent reading CLAUDE.md gets an accurate picture.
**Source:** AUDIT-A5 + this roadmap's existence.
