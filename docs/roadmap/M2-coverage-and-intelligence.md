# M2 — The Coverage Multiplier and the First Model

> Days 31-60. Civitek is on the plan-of-record clock and nothing else moves the coverage
> number comparably; the propensity model trains on data that already exists — no waiting on users.

## Small-county strategy (settled 2026-06-10 — do not re-derive)

The parcel layer (owner/values/geocode/absentee/score) is ALREADY statewide, all 67 counties —
small counties are never blank, they lack only county-specific DISTRESS FEEDS. Those arrive via
**platform adapters, not per-county scrapers**: Civitek serves ~60+ FL clerks (M2.1 — built for
metros first, small counties are config entries afterward), realtaxdeed.com ~44+ counties'
tax-deed sales (M2.2, same code as prod foreclosure scraper), Grant Street LienHub/TaxSys ~30
tax collectors (Broward CSV pattern reuses), Accela for mid-size-city code enforcement (M3.2).
Metro-first ordering follows deal volume (~45%+ of FL flips in the big-6), but county #15-#60
on each platform costs a config row + verification pass. Deliberately metro-only for now:
sheriff/arrest + probate dockets (true per-county portals — extend after platform patterns prove).

---

### M2.1 — F2.1 Civitek mortgage/lien scraper (THE coverage multiplier)
**Status:** TODO · **Effort:** 1-2 weeks (the big one) · **Deps:** none; FL-COVERAGE-PLAN §F2.1 is the spec
**Why:** The 296-field mortgage/lien bucket is 30% of the entire Cotality dictionary and
effectively empty (208 Mortgage rows; HOA/mechanics-lien schema at 0 rows). Landing it moves
effective coverage ~17% → ~48%. This was always the plan's "single highest-leverage build."
**What/How:**
1. Re-read FL-COVERAGE-PLAN.md §F2.1 (Civitek = the county official-records platform family).
   The Duval Clerk scraper (`lib/scrapers/vendors/duval-clerk.ts`, VERIFIED in prod) is the
   pattern ancestor — same court/records platform genus.
2. Build the Civitek adapter on the existing scraper base (politeFetch + cookie-fetch +
   dispatch adapter + BulkIngestJob audit). Yellow-zone: apply the §5.1 hardening checklist;
   direct Railway egress vs proxy per-host testing (memory: RealAuction + Duval both needed
   `useProxy:false`).
3. Target doc types: mortgages, satisfactions, assignments, lis pendens, judgment liens,
   HOA liens, mechanics liens. Parse → Mortgage/Lien tables (schema exists; HOA/mechanics
   55-field v1 schema exists at 0 rows).
4. Join keys: countyFips + APN where present; else grantor/grantee name-match → Parcel.ownerName
   (fuzzy; persist match confidence).
5. Roll out county-by-county: Duval first (known portal), then the top-6 metros.
**Done when:** Mortgage + Lien row counts in the tens of thousands across ≥3 metros; equity
estimation becomes possible (assessed/market value minus open mortgage balance).
**Source:** AUDIT-A1 gap #1; FL-COVERAGE-PLAN F2.1.

---

### M2.2 — B2: Tax-deed applications signal
**Status:** TODO · **Effort:** 2-4 days (cheapest catalog build) · **Deps:** none
**Why:** FL Ch.197 escalation — certificate holder applies for deed, sale is months away:
owner distress with a third-party CLOCK. Rides `*.realtaxdeed.com` — the SAME RealAuction
platform as the production foreclosure scraper (cookie+XHR path, no Playwright) — plus
Grant Street LienHub (~30 counties) already on the F2 roadmap.
**What/How:**
1. Clone the realauction-playwright XHR pattern for the realtaxdeed.com calendar endpoints.
2. New signal `TAX_DEED_APPLICATION` in TAX_FAMILY with FUTURE_AUCTION-style proximity decay
   (lib/scoring/distress-scorer post-M1.5 extraction).
3. Join to existing TaxDelinquencySummary rows — converts a slice of the 105K delinquency
   records into time-urgent leads with a sale date.
4. While in the scorer: add the empty `CONDITION_FAMILY` scaffolding (code-violation /
   sinkhole / storm-damage / condemned slots) so M3's property-distress sources have a home.
**Done when:** tax-deed application rows flow; scorer boosts proximity-decayed; leads UI
surfaces "Tax deed sale ~Aug 12" on affected rows.
**Source:** AUDIT-A2 build B2 + scorer prerequisite.

---

### M2.3 — ML foundations: feature mart + training loop
**Status:** TODO · **Effort:** ~1 week · **Deps:** M1.3 (geocode for spatial features)
**What/How:**
1. `ParcelFeature` silver mart for active metros (start: Duval + Miami-Dade): one row per
   parcel with model-ready features (value ratios, sqft/lot, age, owner-occupancy, absentee,
   signal flags + ages, ZIP aggregates). Use the proven `rescore-*.ts` single-SQL-UPSERT pattern.
2. `ZipMarketStats`: per-ZIP médian sale price, price/sqft, sale velocity, 12mo trend —
   from ParcelSale aggregates.
3. Training loop skeleton: export TS script (mart → parquet/CSV) → train Python (LightGBM,
   keep it boring) → apply TS script (predictions → PG batch UPSERT) + a `ModelVersion` table
   (version, trainedAt, metrics, featureList). NO model server — batch inference into columns,
   the same architecture the materialized scores already prove.
**Done when:** mart populated for 2 metros; a dummy model round-trips export→train→apply.
**Source:** AUDIT-A3 sequencing step 2.

---

### M2.4 — Propensity model v1: tax-delinquency → sale hazard
**Status:** TODO · **Effort:** ~1 week · **Deps:** M2.3
**Why:** Trainable TODAY from retrospective cohorts (105K delinquent parcels × ParcelSale
outcome joins via `TaxDelinquencySummary.earliestYear`) — no behavioral labels needed.
Output: calibrated P(sale within 12mo). **No competitor has anything but static "motivation: HIGH".**
**What/How:** discrete-time hazard framing (per-parcel-per-quarter rows; label = sold that
quarter); LightGBM; calibrate (isotonic); write P(sale|12mo) into TaxDelinquencySummary;
surface in the score-breakdown tooltip: "23% chance of sale in 12 mo (model v1)".
**Done when:** calibration plot is sane (predicted≈observed by decile); tooltip ships.
**Source:** AUDIT-A3 model (d), resequenced first because labels exist.

---

### M2.5 — NextAuth migration steps 2-4
**Status:** TODO · **Effort:** ~1 week · **Deps:** M1.6 (requireUser sweep)
**What/How (from AUDIT-A5 plan):**
- Step 2: implement NextAuth (Auth.js) credentials provider + manual user creation flow
  (per user decision: no self-serve signup yet).
- Step 3: swap the INTERNALS of require-user.ts / require-admin.ts / middleware.ts from Clerk
  to NextAuth session — **preserving the admin dual-gate** (memory: admin matchers evaluated
  BEFORE public-route bypass).
- Step 4: replace ClerkProvider/UserButton/sign-in pages with NextAuth equivalents.
**Done when:** sign-in works end-to-end on NextAuth in production; Clerk receives zero traffic.
**DO NOT:** delete Clerk packages/webhook yet (that's M3.6 after backfill).
**Source:** AUDIT-A5 migration steps 2-4.

---

### M2.6 — Lead provenance/freshness chips + Signal Source analytics
**Status:** TODO · **Effort:** 3-4 days · **Deps:** none
**Why:** Trust in scraped data requires receipts. No lead currently says which scraper produced
its signals or when. And the Analytics "Marketing" tab is structural fiction (hardcoded ad-spend
on a platform that buys no ads).
**What/How:**
1. Per-signal source + capture-date chips in LeadDetailSheet + properties/[id] (data exists:
   BulkIngestJob + capturedAt fields).
2. Staleness states from ScrapeRegistry.lastSuccessAt vs expected cadence; "data current as of" header.
3. Replace Analytics Marketing tab with **Signal Source Performance**: funnel segmented by
   scraper source; attribute only REAL spend (skip-trace $0.20/record, proxy bandwidth).
   The ~$0 cost-per-lead stat is the killer number — show it.
**Done when:** every lead shows its receipts; Marketing-tab fiction is gone.
**Source:** AUDIT-A4 misfits #4 #5.

---

### M2.7 — SDF sale-history backfill (2009-2023) + Dixie County fix
**Status:** TODO · **Effort:** 2-3 days (mostly runtime) · **Deps:** none
**Why:** ParcelSale spans only 2024-01→2026-02; the plan promised 2009+. Sale-history depth
directly feeds AVM quality (M3.3) and time-on-market features. Dixie (12029) has zero rows.
**What/How:** prior-vintage FL DOR SDF files (same ingester, older vintages); investigate the
Dixie gap (missing file vs parse failure). Respect ingest perf patterns from memory.
**Done when:** ParcelSale spans ≥2015+; 67/67 counties have rows.
**Source:** AUDIT-A1 gap #3.
