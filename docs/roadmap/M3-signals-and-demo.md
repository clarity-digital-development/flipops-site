# M3 — New Signals, the AVM, and the Investor Demo

> Days 61-90. Probate + code enforcement need M2's CONDITION_FAMILY + clerk-pattern work;
> the AVM needs M1.3 geocode + M2.3 feature mart. The demo assets compound into one investor
> walkthrough: signal appears → score explains itself with a calibrated probability → one click
> to underwriting with real comps → guardrailed rehab → disposition.

---

### M3.1 — B1: Probate scrapers, top-6 metro clerks
**Status:** TODO · **Effort:** 1-2 weeks · **Deps:** M2.1 clerk-platform experience helps
**Why:** THE gold-standard motivated-seller lead type — heirs are non-occupant and emotionally
done. The INHERITED/DEATH_TRANSFER signals exist in the scorer and have NEVER seen real data.
Goliath charges +$600/mo for probate lists; we ship it in core at ~$0 COGS.
**What/How:**
1. Targets: Duval (CORE — pattern already proven in prod), Miami-Dade (MyClerk),
   Broward (Web2), Orange (myeclerk), Hillsborough, Pinellas probate dockets.
2. New `ProbateCase` table: county, caseNumber, decedentName, personalRepresentative, filedAt,
   status, matchedParcelIds (fuzzy decedent-name → Parcel.ownerName join with confidence).
3. New scorer signals: PROBATE_OPEN (high), PROBATE_PR_APPOINTED (peak motivation window).
4. Fast-follows on the SAME dockets later: eviction filings (landlord fatigue), partition
   actions, guardianship — log as backlog items when the adapter lands.
**Done when:** probate cases flow for ≥3 metros; matched leads carry the signal + boost.
**Source:** AUDIT-A2 build B1.

---

### M3.2 — B3: Code-enforcement violations (open-data first)
**Status:** TODO · **Effort:** ~1 week · **Deps:** M2.2's CONDITION_FAMILY scaffolding
**What/How:**
1. Phase 1 (100% green): Jacksonville + Miami-Dade + Orlando publish violation feeds as
   open data (Socrata/ArcGIS bulk) — F1-style ingest, zero scrape risk.
2. Phase 2 (yellow): one Accela Citizen Access adapter unlocks Pinellas/Tampa/Hillsborough/
   Brevard + dozens more — and Accela reuses nationally for the TX/GA/AZ/NC expansion.
3. Signals: CODE_VIOLATION_OPEN, CODE_VIOLATION_MULTI (3+), CODE_LIEN. 4-10% of cited
   properties sell within a year; multi-violation + lien is strong.
**Done when:** violations flow for the 3 open-data cities; CONDITION_FAMILY live in scorer.
**Source:** AUDIT-A2 build B3.

---

### M3.3 — AVM v1 + ParcelValuation
**Status:** TODO · **Effort:** 1-2 weeks · **Deps:** M1.3, M2.3, ideally M2.7 (sale depth)
**What/How:**
1. LightGBM on log(price) over arms-length ParcelSale joins: sqft, lot, age, beds/baths when
   present, ZIP aggregates, distance-weighted neighborhood comps, sale-date seasonality.
2. Eval: median APE by ZIP vs the assessed-ratio baseline (must beat it to ship).
3. Batch-precompute into `ParcelValuation` (parcelId, estimatedValue, low, high, modelVersion,
   computedAt) for active metros.
4. Underwriting consumes it as the ARV PRIOR (anchors the comps-based number; flag big gaps).
5. ZIP liquidity grades + data-driven holding-period defaults → Exit Scenarios / MAO
   (replaces the static 90-day rehab default with per-ZIP reality).
**Done when:** AVM beats assessed-ratio baseline on holdout; underwriting shows it with a
confidence range; MAO holding costs are ZIP-aware.
**Source:** AUDIT-A3 model (b) + (c).

---

### M3.4 — Property Signals Timeline + auction calendar
**Status:** TODO · **Effort:** ~1 week · **Deps:** none (data all exists)
**Why:** "Sold 2019 $180K → tax delinquent 2024 → lis pendens Mar 2026 → auction Jul 8" is
the single most persuasive screen the data can produce.
**What/How:**
1. Timeline component in `/app/properties/[id]`: merge ParcelSale + Foreclosure + AuctionSummary
   + TaxDelinquencySummary (+ ProbateCase/violations when M3.1/M3.2 land) into one dated stream.
2. Auction calendar view: the 14 RealAuction counties' upcoming sales (AuctionSummary
   nextAuctionDate is already materialized) — month grid, county filter, click→property.
**Done when:** both render from real data; timeline shows ≥3 event types on a real property.
**Source:** AUDIT-A4 missing surfaces #2 #4.

---

### M3.5 — Buyers → Disposition pivot
**Status:** TODO · **Effort:** ~1 week · **Deps:** none
**Why:** Flippers sell on MLS via agents — the Buyers page is a wholesaler artifact; its
Campaigns tab POSTs to a nonexistent endpoint and 404s.
**What/How:** Rename surface to **Disposition**, flipper-primary: listing prep (fed from
Renovations completion), agent handoff tracking, list-price-vs-ARV tracking, sale-side net
sheet. Demote Buyers to a tab (wholesalers/hybrid still need it). DELETE the Campaigns tab.
**Done when:** flipper-persona default shows Disposition; Campaigns 404 path is gone.
**Source:** AUDIT-A4 misfit #3.

---

### M3.6 — NextAuth migration steps 5-6 (completion)
**Status:** TODO · **Effort:** 2-3 days · **Deps:** M2.5 running stable ≥1 week
**What/How:** backfill User auth fields; drop `clerkId` via `prisma db push`; delete
webhooks/clerk route, Clerk scripts, and the 3 Clerk package deps; remove Clerk env vars
from Railway (flipops-site + worker-bullmq) and env.sample.
**Done when:** zero Clerk references in repo; Railway has no CLERK_* vars; sign-in unaffected.
**Source:** AUDIT-A5 migration steps 5-6.

---

### M3.7 — Investor-readiness package
**Status:** TODO · **Effort:** ~1 week · **Deps:** everything above (it's the capstone)
**What/How:**
1. **TCPA substantiation**: document consent capture (ConsentRecord), DNC scrub, quiet-hours
   enforcement with evidence — "TCPA-safe by construction" must become audited fact, not intent.
2. **Scraper ops runbooks**: per-source runbook (what it scrapes, cadence, failure modes,
   how to re-run, who/what depends on it) — de-tribalize the scraper estate.
3. **The deck**, built on AUDIT-A6: three-part moat vs Goliath (parcel-universe depth,
   included-vs-add-on economics, lifecycle), $0-COGS margin story, templated FL→TX→GA→AZ→NC
   expansion (1-3 wk/state), $99/$299/$599 pricing, honest risks slide (scraper fragility,
   single-state concentration, FL flip-volume decline → sequence TX fast).
4. **The demo script**: coverage page → signal appears → calibrated propensity tooltip →
   one-click underwriting with real comps → guardrailed rehab → disposition.
5. Scope the marketing site's "nationwide coverage" claim to FL-only reality.
**Done when:** a cold investor walkthrough runs end-to-end without a single fabricated number.
**Source:** AUDIT-A6 + synthesis Month-3.
