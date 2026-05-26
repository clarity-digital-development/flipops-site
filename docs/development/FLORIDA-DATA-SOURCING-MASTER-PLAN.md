# Florida Data-Sourcing Master Plan

**Author:** CTO (synthesized from PM + 2 Senior Devs + Junior Dev)
**Date:** 2026-05-26
**Status:** Approved direction — supersedes the per-county assumptions in SCRAPER-COVERAGE.md for Florida

---

## Executive summary — the strategic shift

The team's research produced one finding that changes everything: **Florida publishes every county's assessment + ownership data as a single free statewide download.** We do NOT scrape 67 county appraiser sites. We download one dataset.

Specifically (Senior Dev 1, verified):
- **FL Dept of Revenue NAL/SDF/NAP files** — every county's certified tax roll, submitted under §193.114 F.S., republished free as statewide CSV. Owner name, mailing + situs address, just/assessed/taxable value, DOR land-use code, year built, living area, **sale price + date history (SDF, 2009→present)**. All 67 counties. Annual refresh.
- **FloridaGIO statewide parcels** — 10.8M parcels with geometry, free, CSV/Shapefile/GeoJSON + a queryable FDOT REST FeatureServer. Annual refresh (~May).

This means **assessment + ownership + sale history + parcel geometry for all of Florida = one annual bulk ingest, zero scraping, zero per-page cost.** That's the bulk of what Cotality's Property Domain sells.

The Junior Dev's recon **confirms why this matters**: the top-12 county appraiser sites are a mess to scrape — Miami-Dade is an Angular SPA with no stable parcel URL, Brevard 403s on direct hits, Pinellas/Volusia are session-driven with no deep-links. Scraping them per-county would be painful and brittle. **The DOR bulk download sidesteps all of it.**

What's left to scrape is only the **distress layer** (not in the annual roll): tax delinquency/certificates, foreclosure filings, recorded liens. And per Senior Dev 1, those run on just **~3 vendor platforms** statewide.

**Net: Florida is coverable with ~1 bulk ingester + ~3 distress scrapers — not 67 county scrapers.**

---

## 1. The Florida data architecture

| Layer | Source | Method | Coverage | Build unit |
|---|---|---|---|---|
| **Assessment, ownership, value, land use, year built, sale history** | FL DOR NAL/SDF (statewide CSV) | Annual bulk download → CSV ingester | **All 67 counties** | 1 ingester |
| **Parcel geometry (map pins/boundaries)** | FloridaGIO + FDOT FeatureServer | Annual bulk / REST API | All 67 counties | reuse ingester |
| **Tax delinquency + certificate sales** | LienHub/TaxSys (Grant Street, ~30 cos) + RealTaxLien | Scrape sale lists | ~30+ counties | 1 scraper |
| **Foreclosure (lis pendens) + tax-deed auctions** | RealAuction (`*.realforeclose.com` / `*.realtaxdeed.com`) | Scrape auction calendars | dozens of counties | 1 scraper |
| **Recorded liens / deeds (lis pendens detail)** | Civitek / MyFloridaCounty Official Records Index | Scrape ORI search | near-statewide | 1 scraper (+ OCR later) |

**Total distinct build units for the whole state: 1 bulk ingester + 3 distress scrapers + optional metro one-offs.**

### Why this is dramatically better than the original per-county plan
- Assessment layer: **$0 and instant** (download vs 67 scrapers)
- Distress layer: 3 platform scrapers instead of 67 bespoke ones (RealAuction's subdomain pattern alone covers dozens of counties with one parser)
- No fighting Miami-Dade's SPA or Brevard's bot-blocking for the high-volume fields
- Florida's Sunshine Law means everything we need is Tier 1-2 (open) — **zero paid subscriptions required**

---

## 2. Revised build sequence

This replaces the "onboard counties one-by-one" sequence for Florida. CTO-ordered by value-per-effort:

### Phase F1 — Statewide bulk ingest (Week 1-2) ← **START HERE**
- [ ] Build `lib/data-sources/bulk/fl-dor-ingester.ts` — download + parse DOR NAL (assessment/owner) + SDF (sales) fixed-schema CSV
- [ ] Build `lib/data-sources/bulk/fl-parcels-ingester.ts` — pull FloridaGIO/FDOT parcel geometry, attach lat/lng to Property records
- [ ] Map DOR fields → `Property` + `PropertyDataPoint` (source tag `bulk:fl-dor-2026`)
- [ ] Run for all 67 counties; this populates the Leads map statewide on day one
- **Exit criteria:** every FL parcel queryable with owner, value, beds/baths/sqft, last sale, and lat/lng. Map shows real statewide coverage.

### Phase F2 — Distress scrapers (Week 3-6)
Built on the existing Firecrawl `CountyScraper` engine, in priority order:
- [ ] **RealAuction parser** — `*.realforeclose.com` (foreclosure) + `*.realtaxdeed.com` (tax deed). One parser, dozens of counties via subdomain pattern. Highest distress ROI.
- [ ] **LienHub/TaxSys parser** — tax certificate / delinquency lists (~30+ counties)
- [ ] **Civitek/MyFloridaCounty ORI parser** — recorded lis pendens + liens (near-statewide)
- **Exit criteria:** distress flags (tax_delinquent, foreclosure/lis_pendens, has_lien) populated and refreshing on the cadence in §4.

### Phase F3 — Engine hardening (parallel with F2, see §3)
The architecture review surfaced gaps that must be fixed before this scales. Non-negotiable ones are starred.

### Phase F4 — Liens detail via OCR (Week 7+, deferred)
- Recorded lien/deed *documents* are image PDFs. Build the OCR pipeline (Firecrawl PDF ingest or AWS Textract) only after F1-F3 prove out. This is "the deferred half of distress" and it's OK to defer.

---

## 3. Engine improvements required (from Senior Dev 2's architecture review)

The architecture is sound (CountyScraper → vendor engine → data-sources facade is correctly factored). But these gaps must be addressed. CTO prioritization:

### Must-fix before scaling (★)
1. **★ Per-field history/versioning.** Current `PropertyDataPoint` unique key `(propertyId, field, source)` means a re-scrape *overwrites* the prior value. But the distress signal IS the transition (current→delinquent, listed→lis-pendens). We're throwing away exactly the signal we're building this for. Add append-only history (make `fetchedAt` part of the key, or a `PropertyDataPointHistory` table).
2. **★ Delta/incremental refresh.** Today `bulkPull()` re-pulls the *full* list every run. Senior Dev 2's cost model shows daily full-pull tax-delinquency is THE Firecrawl cost driver (~6,000 credits/county/mo). Content-hash list pages, only extract changed rows. **This is the single biggest cost lever — build it before porting anything to cheerio.**
3. **★ Shared, user-less property store.** The `system+scrapers@flipops.io` ownership hack collides with the multi-tenant `(userId, address...)` unique constraint — a real user adding a scraped address creates a duplicate instead of linking. Scraped public records aren't tenant data; make `Property.userId` nullable (or a shared reference table user Properties point to).
4. **★ Geocoding enrichment.** `ScrapedProperty` has no lat/lng; the map-first UX needs it. (For Florida, F1's parcel ingest gives us geometry free. For scraped-only records elsewhere, use the free Census batch geocoder.)

### Should-fix soon
5. **Address normalization + APN-preferred dedup** — "123 OAK ST" vs "123 Oak Street" from two sources = two rows today. Normalize + prefer APN identity before upsert.
6. **Pagination generator in the base class** — `maxPages` is declared but never read; `bulkPull` returns one page. Centralize loop+termination so every engine inherits it.
7. **`confidence` + bounds-checking on extracted values** — Firecrawl LLM extraction occasionally mis-keys numbers; sanity-bound assessed values, flag low-confidence.
8. **Memoize `resolveSystemUserId`** — currently an N-query-per-run lookup.

### Cost reality correction (Senior Dev 2)
Firecrawl is **not** ~1 credit/page for our usage. JSON structured-extraction + browser `actions` (form-fill on ASP.NET postbacks) bills at **~5 credits/page** and consumes browser-minutes. Pricing is a **step function in plan tier** ($83/100k → $333/500k → $599/1M), not linear. **Implication:** delta refresh (gap #2) matters more than cheerio porting. Don't optimize parsers until delta refresh is in and a county sustains >10k credits/mo.

**Note for Florida specifically:** the F1 bulk ingester is plain CSV/REST — **no Firecrawl credits at all** for the entire assessment layer. Firecrawl cost only applies to the 3 distress scrapers, which are list-based and ideal for delta refresh. Florida's Firecrawl burn will be low.

---

## 4. Refresh cadence & definition of done

| Category | Source | Cadence | DoD |
|---|---|---|---|
| Assessment/owner/value/sales | DOR bulk | Annual (+ check for mid-year corrections) | All 67 counties; freshness = current roll year |
| Parcel geometry | FloridaGIO | Annual | lat/lng on every parcel |
| Tax delinquency | LienHub/RealTaxLien | Daily during cert-sale season (Apr-Jun), weekly otherwise | `tax_delinquent` + amount + **history of the transition** |
| Foreclosure / lis pendens | RealAuction + Civitek ORI | Weekly | foreclosure flag + filing date |
| Recorded liens (detail) | Civitek ORI + OCR | Monthly (Phase F4) | lien type + claimant + recording date |

"**Florida complete**" = F1 done (all 67 counties, assessment+geometry) + F2 done (3 distress scrapers live, refreshing) + F3 must-fix items shipped. Liens-detail (F4) is explicitly out of the "complete" bar.

---

## 5. County recon reference (Junior Dev — top 12 verified)

Used for the optional metro appraiser one-offs and for the distress scrapers' per-county endpoint config. Full table in the agent output; key facts:

- **Tax certificates:** mostly **LienHub** (`lienhub.com/county/{county}/certsale/main`), EXCEPT Palm Beach + Polk use **RealTaxLien** (`{county}.realtaxlien.com`).
- **Foreclosure auctions:** overwhelmingly **`{county}.realforeclose.com`** (Miami-Dade, Broward, Palm Beach, Hillsborough, Orange, Pinellas, Lee, Polk, Brevard, Pasco). Exceptions: Volusia (RealAuction custom URL), Seminole (self-hosted `webapps.seminoleclerk.org/ForeclosureSales/`), Brevard judicial foreclosures are **in-person** (only tax deeds online).
- **Official Records platforms:** AcclaimWeb (Broward, Brevard, Volusia), Landmark Web (Palm Beach, Lee), DuProcess (Seminole), plus custom (Miami-Dade, Hillsborough, Pinellas, Pasco, Polk, Orange).
- **Appraiser detail-URL gotchas (if we ever need live appraiser data):** Pasco (`search.pascopa.com/parcel.aspx?parcel={n}`), Lee (`leepa.org/Display/DisplayParcel.aspx?Strap={STRAP}`), Orange (`.aspx/PID/{id}`), Polk, Seminole (`parceldetails.scpafl.org`) have stable deep-links. Miami-Dade, Pinellas, Brevard, Volusia are SPA/session-driven with NO stable URL — **another reason to use DOR bulk, not scrape these.**

---

## 6. Rollout waves & timeline (PM)

Because F1 covers all 67 counties at once, "waves" now apply to **distress-scraper validation + QA**, not assessment onboarding.

| Milestone | Target | Criteria |
|---|---|---|
| **M1: Statewide bulk live** | Week 2 | DOR + FloridaGIO ingested; all 67 counties have assessment + geometry; map populated |
| **M2: RealAuction distress live** | Week 4 | Foreclosure + tax-deed auctions scraping for top-10 metros; delta refresh working |
| **M3: Full distress layer** | Week 6 | LienHub + Civitek ORI live; distress flags on all major counties |
| **M4: Engine hardened** | Week 6 | All ★ must-fix items shipped (history, delta, shared store, geocoding) |
| **M5: Florida complete** | Week 8 | F1+F2+F3 done; QA >90% accuracy on 10-address samples across 10 counties; ScrapeJob error rate <2% |
| **M6: National gate review** | Week 9 | Transition criteria evaluated (§8) |

Faster than the original 20-week per-county plan because bulk ingest collapses 67 county onboards into one.

---

## 7. Cost model

| Component | Florida monthly |
|---|---|
| DOR + FloridaGIO bulk ingest | **$0** (free downloads) |
| Firecrawl (3 distress scrapers, delta-refreshed) | ~$83 (Standard tier, low burn with delta refresh) |
| Residential proxy (if a distress site blocks) | ~$75 (Smartproxy) only if needed |
| Census geocoder | $0 (free) |
| **Florida total** | **~$83-160/mo for the entire state** |

vs Cotality $54k for 5 counties, or BatchData $0.30/call. Florida statewide for ~$100/mo.

**Guardrails (PM):** migrate a distress scraper to cheerio if it sustains >10k Firecrawl credits/mo; total infra hard-cap $1,000/mo triggers an optimization pass before adding scope.

---

## 8. Risk register (top items, PM)

| Risk | Mitigation |
|---|---|
| County site redesign breaks a distress scraper | Firecrawl AI extraction degrades gracefully; ScrapeJob error alerting; 48hr fix SLA |
| DOR schema changes year-to-year | Pin to the published NAL/SDF User's Guide per year; ingester validates column count on load |
| IP blocking on distress scrapers | politeFetch rate limits; residential proxy hook ready |
| Losing the transition signal (no history) | ★ Fixed by history/versioning (F3 #1) |
| Firecrawl cost runaway | ★ Fixed by delta refresh (F3 #2); bulk layer is $0 |
| Scraped-record dedup/ownership collision | ★ Fixed by shared user-less store (F3 #3) |
| Liens locked behind PDF | Accepted — deferred to F4, not in "complete" bar |

---

## 9. National expansion criteria & first moves

Florida → national gate (must all be true):
- F1+F2+F3 complete for Florida; ScrapeJob error rate <2% over 30 days
- Delta refresh proven (cost stays flat as data grows)
- ≥1 paying user in a non-FL market with documented demand

**First national moves when the gate opens:**
1. **qPublic/Schneider parser** — Senior Dev 2's #1 leverage finding: ~1,100+ govts (~20% of US counties) on one consistent `Application.aspx?App=…` pattern, includes large metros. Highest-ROI parser to build.
2. **Check each new state for a DOR-equivalent bulk roll** — Florida's statewide-roll model exists in some other states (not all). Always look for the bulk shortcut first before scraping.
3. RealAuction + Grant Street parsers already built for FL **carry over nationally** — both are multi-state platforms.

**Standing principle (CTO):** for every new state, the first question is "is there a statewide bulk roll?" before "which counties do we scrape?" Florida proved the bulk-first approach is 50x cheaper than per-county scraping where it's available.

---

## Appendix — key verified sources

- DOR roll portal: https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
- NAL/SDF/NAP User's Guide (2025): https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/User%20Guides/2025%20Users%20guide%20and%20quick%20reference/2025_NAL_SDF_NAP_Users_Guide.pdf
- FloridaGIO statewide parcels: https://geodata.floridagio.gov/ · https://www.floridagio.gov/datasets/FGIO::florida-statewide-parcels
- FDOT parcel FeatureServer: https://gis.fdot.gov/arcgis/rest/services/Parcels/FeatureServer
- qPublic/Schneider: https://qpublic.schneidercorp.com/
- LienHub/Grant Street: https://www.grantstreet.com/clients/client-site-directory/
- RealAuction: https://realauction.com/
- MyFloridaCounty ORI (Civitek): https://www3.myfloridacounty.com/ori/index.do
