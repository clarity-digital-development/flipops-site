# FL Coverage Plan — Cotality canonical schema via scraping

**Author:** CTO
**Date:** 2026-05-29
**Status:** Active master plan — supersedes FLORIDA-DATA-SOURCING-MASTER-PLAN.md as the source of truth

## Goal

Cover the **Cotality Property Domain v3 (981 fields) + HOA & Mechanics Liens v1 (55 fields)** canonical schema for **all 67 Florida counties** by scraping public records + grey-zone sources. Zero Cotality license, zero per-county artisanal work. The same patterns we build for FL must drop into TX, GA, AZ, CA, etc., with only a per-state mapper file.

User has explicitly accepted **slight legal risk** (this expands the menu — see §5).

## 1. Field coverage math

Cotality's 981 property fields re-bucketed by which source family can fill them:

| # | Source family | Cotality fields covered | Statewide / per-platform | Auth level | Phase |
|---|---|---|---|---|---|
| 1 | **FL DOR NAL (current year)** | ~120 (identity, owner, situs, current values, land basics, age, most-recent-sale, DOR land use) | Statewide, 1 CSV | Free public | F1 |
| 2 | **FL DOR SDF (sale history)** | ~10 (sale events 2009→present) | Statewide, 1 CSV | Free public | F1 |
| 3 | **FL DOR prior-year NAL** (annual back to 2002) | ~90 (PRIORxx valuation history) | Statewide, 23 CSVs | Free public | F1.5 |
| 4 | **FloridaGIO Hub cadastral** | parcel polygon geometry + lat/lng (joins to NAL) | Statewide, 1 FGDB/CSV | Free public | F1 |
| 5 | **County Clerk recorded documents** (Civitek MyFloridaCounty ORI is near-statewide; falls back to per-county clerk for the holdouts) | ~300 (full mortgage/lien history — 1st/2nd/3rd position mortgages, refinances, lender, rate, recording detail, lis pendens, mechanics liens) | Per-platform → ~60 counties via Civitek + ~7 holdouts | Free public; some are JS-rendered SPAs | F2 |
| 6 | **RealAuction** (`*.realforeclose.com` + `*.realtaxdeed.com`) | ~20 (foreclosure stage code, auction date, plaintiff, judgment amount, opening bid) | One subdomain parser → dozens of FL counties | Free public | F2 |
| 7 | **LienHub / TaxSys** (Grant Street) | ~15 (tax delinquency, certificate sale, tax-deed sale) | One platform parser → ~30 FL counties | Free public | F2 |
| 8 | **County appraiser sites** (3 platforms cover ~50 counties: qPublic/Schneider, iasWorld/Tyler Tech, BS&A) + custom for top metros (Miami-Dade Angular SPA, Hillsborough, Pinellas, Brevard) | ~70 (full building detail: beds/baths/condition/pool/garage/basement/foundation/exterior/roof/heating/quality) | Mostly per-platform; 4 custom | Public; some JS-heavy / bot-detect | F3 |
| 9 | **Census + USPS + FCC free APIs** | ~40 (CBSA, census ID, address decomposition, ZIP+4, block-level FIPS) | National | Free w/ free account | F3 (parallel) |
| 10 | **MLS surface (Zillow/Redfin/Realtor scraping — grey)** | ~30 (current listing status, listing price, photos, days-on-market, prior listings, MLS history) | Per-platform | **Grey zone — see §5** | F4 (opt-in) |
| 11 | **County GIS / zoning portals** | ~20 (zoning code/description, easements, flood zones, FEMA layer joins) | Per-county or per-state-platform | Free public | F4 (parallel) |

**Realistic coverage ceiling = ~715 / 981 = ~73%** of the Cotality property schema. The remaining ~270 fields are:
- Cotality-proprietary IDs (CLIP — we generate our own equivalent)
- Computed/derived fields (CALCULATED IMPROVEMENT VALUE, OWNER OCCUPANCY CODE — we compute)
- Title company / closing detail — niche, optional
- Cotality's own enrichment metadata (SOURCE CODE, CONFIDENCE CODE — we generate)

For the **HOA + Mechanics Liens v1 schema (55 fields)**: source #5 (county clerk recorded documents via Civitek) covers ~50 of 55 fields. The remaining 5 are Cotality internal transaction IDs.

Bottom line: **with sources 1-9, we cover ~85% of Cotality's schema for $0** (after one-time scraper build). Sources 10-11 push it to ~95%+ but include legal-risk decisions.

## 2. Build queue (CTO-ordered by value × inverse effort)

### Phase F1 — Statewide bulk ingest (Week 1-2) — **IN FLIGHT**
- [x] `lib/data-sources/bulk/fl-dor.ts` — NAL ingester scaffolding built + smoke-tested (commit `3e0988b`)
- [ ] **Get the NAL+SDF files in hand.** Two paths, both zero-email:
  - **Direct download:** SharePoint directory at `floridarevenue.com/property/dataportal/Pages/default.aspx?path=/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files` — current-year files. SharePoint listing is JS-rendered so a `curl` of the index won't list them; we use a headless-browser fetcher (Playwright) to enumerate filenames + grab .zip URLs once.
  - **FloridaGIO Hub:** item `efa909d6b1c841d298b0a649e7f71cf2` ("Florida Statewide Parcels") is the NAL data joined with parcel geometry, last refreshed Aug 2025. ArcGIS Hub item — has a "Download" tab that produces FGDB/Shapefile/GeoJSON/CSV.
  - **Email request fallback:** PTOTechnology@floridarevenue.com only if both above fail. SLA per DOR page: files >10MB delivered by email link, no stated turnaround.
- [ ] `lib/data-sources/bulk/fl-dor-sdf.ts` — SDF (sale history 2009+, 23 fields) ingester. Same shape as NAL but writes to a new `ParcelSale` time-series table.
- [ ] `lib/data-sources/bulk/fl-fgio-hub.ts` — replace the current throttled FeatureServer ingester with a Hub bulk-file ingester. Pulls `efa909d6...` as FGDB, extracts parcel polygons + centroids, joins to existing Parcel rows on `(countyFips, apn)` to populate `latitude` / `longitude`.
- [ ] **DB schema additions** (`db push`, additive only — NEVER `migrate dev` per memory):
  - `ParcelSale` model — `(parcelId, saleDate, salePrice, deedType, multiparcel, qualCode)`
  - `Mortgage`, `Lien`, `Foreclosure` models — see F2 for shape
  - `Parcel`: add `latitude`, `longitude`, `propertyTypeCode`, `propertyTypeDescription`, `landUseCode`, `landUseDescription`

### Phase F1.5 — Valuation history (Week 2-3)
- [ ] `scripts/fl-dor-historical-pull.ts` — iterates 2002→2024 NAL files from the same SharePoint directory, ingests each as `PropertyDataPoint` rows with `source_tag='bulk:fl-dor-YYYY'`. This fills the Cotality `PRIORxx` valuation history bucket (~90 fields) at zero cost.

### Phase F2 — Distress + mortgage layer (Week 3-7) — the BIG WIN
The 296-field mortgage/lien bucket is one-third of the Cotality schema. The Civitek scraper alone is the single highest-leverage build in this plan.

- [ ] **F2.1 — Civitek MyFloridaCounty ORI scraper** (`lib/scrapers/vendors/civitek-ori.ts`). One parser, near-statewide coverage. Targets:
  - Recorded mortgages (1st/2nd/3rd position) → fills ~150 of the 296 mortgage fields
  - Recorded deeds → cross-checks NAL ownership + populates deed-type codes (Cotality DOCTY lookup)
  - Lis pendens → fills `FORECLOSURE STAGE CODE` for properties at the early stage
  - Mechanics liens + HOA liens → fills the entire HOA+Mechanics Liens v1 schema
  - Implementation: Civitek runs on a known platform across counties — same HTML shape with per-county base URL config (we already have this pattern in `lib/data-sources/enrichers/distress-sources.ts`). Firecrawl AI extraction does the parsing.
- [ ] **F2.2 — RealAuction parser** (`lib/scrapers/vendors/realauction.ts`). Subdomain pattern: `<county>.realforeclose.com` (foreclosure auctions) + `<county>.realtaxdeed.com` (tax-deed auctions). Same HTML, dozens of counties via subdomain config. Fills foreclosure stage code, scheduled auction date, judgment amount, opening bid, surplus bid.
- [ ] **F2.3 — LienHub/TaxSys parser** (`lib/scrapers/vendors/lienhub.ts`). Grant Street Group's platform. ~30 counties uniformly. Tax delinquency + certificate sale lists. Fills the tax-distress signals.
- [ ] **F2.4 — Per-field history.** Critical from the master plan: don't OVERWRITE `PropertyDataPoint` on re-scrape — the transition IS the signal. Change `PropertyDataPoint` unique key from `(propertyId, field, source)` to `(propertyId, field, source, fetchedAt)` so re-scrapes accumulate as time series.

### Phase F3 — Building characteristics + enrichment (Week 6-10, parallel with F2)
- [ ] **F3.1 — qPublic parser** (`lib/scrapers/vendors/qpublic.ts`). Schneider Geospatial platform. ~30 FL counties with uniform HTML.
- [ ] **F3.2 — iasWorld parser** (`lib/scrapers/vendors/iasworld.ts`). Tyler Tech. ~10 FL counties.
- [ ] **F3.3 — BS&A parser**. ~5 FL counties.
- [ ] **F3.4 — Top-metro customs** (one Firecrawl-AI-extract config each):
  - Miami-Dade (`miamidade.gov/pa/property_search.asp` Angular SPA)
  - Hillsborough (`hcpafl.org`)
  - Pinellas (`pcpao.org`)
  - Brevard (`bcpao.us` — 403s on direct hits, needs headless browser)
- [ ] **F3.5 — Census + USPS + FCC** (`lib/data-sources/enrichers/free-apis.ts`):
  - Census Geocoding API — batched address → lat/lng + CBSA + tract/block FIPS
  - USPS Web Tools — address standardization + ZIP+4 (free with account)
  - FCC Block API — block-level FIPS, free
  - Fills the Cotality "ENRICHED" address bucket + Geography bucket

### Phase F4 — Listing/MLS layer (Week 10-12) — **opt-in, grey zone, see §5**
- [ ] **F4.1 — Zillow GraphQL scraping** (`lib/scrapers/vendors/zillow.ts`). Hits their internal GraphQL via Firecrawl/Bright Data residential proxies + UA rotation. Fills current listing status, listing price, days-on-market, photos, prior list history. **Hard ToS violation; they litigate** — see §5.
- [ ] **F4.2 — Redfin scraping** — same risk profile.
- [ ] **F4.3 — Realtor.com** — DO NOT, Move Inc. actively sues (`Move v. Real Estate Webmasters`, etc.).
- [ ] **F4.4 — RESO Common Format aggregator (safe alternative)** — license cost-effective regional MLS aggregator API (e.g. Bridge Interactive, MLSGrid). Costs $500-2k/mo per MLS but eliminates the legal risk.
- [ ] **F4.5 — Zoning / FEMA / GIS** — per-county GIS + FEMA NFHL national flood-zone layer (free Esri service). Fills zoning + flood-zone fields.

## 3. National extension (post-FL)

The architecture is state-agnostic by design:
- Statewide DOR equivalent: TX = TCAD/HCAD/etc. (no single statewide); GA = state DOR; AZ = MD; CA = each county only (no statewide CSV — county-by-county = harder).
- Each Cotality source family above has a national platform analogue:
  - Civitek → ROAM (CA), Doxpop (IN), Landex (multi-state), county-by-county clerk fallback
  - RealAuction → also `*.realforeclose.com` for FL+OH+NJ+more; auction.com nationally
  - LienHub/TaxSys → same Grant Street platform nationwide
  - qPublic → ~700 counties in 20+ states
  - iasWorld → ~3,000 jurisdictions including most major metros

When FL is at ~85% coverage, the per-state build cost should drop to 1-2 weeks per state (just wire the state's DOR-equivalent + map its clerk/auction platforms to the existing scrapers).

## 4. Architecture (the engine, not the sources)

Already built (commits `abb29ac`, `ae22db9`, `e11808b`, `3e0988b`):
- `BulkIngester` base class — handles streaming + audit + batched upserts
- `CountyScraper` base class — handles per-platform Firecrawl AI extraction
- `RawSnapshot` bronze layer — every fetch's raw payload preserved, immutable, time-series via `contentHash`
- `LeadEvent` behavioral layer — every user interaction captured with attribute snapshot at action time
- `Parcel` (non-tenant) + `Property` (tenant) split — scraped data is shared infra, not user data
- `PropertyDataPoint` per-field provenance with source + confidence (history fix in F2.4)
- Cotality dictionaries parsed to `data/dictionaries/cotality-*.json` for programmatic reference

Schema additions queued for F1 (`db push`):
```prisma
model ParcelSale {              // SDF / clerk-deed history time-series
  id          String   @id @default(cuid())
  parcelId    String
  saleDate    DateTime
  salePrice   Float?
  deedType    String?  // Cotality DOCTY code
  qualCode    String?  // FL DOR sale qualification code
  multiParcel Boolean  @default(false)
  source      String   // "bulk:fl-dor-sdf-2025" | "scraper:civitek-12031"
  capturedAt  DateTime @default(now())
  parcel      Parcel   @relation(fields: [parcelId], references: [id], onDelete: Cascade)
  @@index([parcelId, saleDate])
}

model Mortgage {                // 1st/2nd/3rd position mortgages + refis
  id              String   @id @default(cuid())
  parcelId        String
  position        Int      // 1/2/3
  recordingDate   DateTime
  loanAmount      Float?
  interestRate    Float?
  lenderName      String?
  mortgageType    String?  // Cotality MTGTP code
  documentNumber  String?
  releasedAt      DateTime?
  source          String
  capturedAt      DateTime @default(now())
  parcel          Parcel   @relation(fields: [parcelId], references: [id], onDelete: Cascade)
  @@index([parcelId, position, recordingDate])
}

model Lien {                    // mechanics liens + HOA liens + tax liens + judgments
  id              String   @id @default(cuid())
  parcelId        String
  lienCategory    String   // "mechanics" | "hoa" | "tax" | "judgment" | "lis_pendens"
  recordingDate   DateTime
  filingDate      DateTime?
  amount          Float?
  interestRate    Float?
  plaintiffName   String?
  plaintiffAddr   String?
  lienTypeCode    String?  // Cotality DOCTY
  documentNumber  String?
  releasedAt      DateTime?
  source          String
  capturedAt      DateTime @default(now())
  parcel          Parcel   @relation(fields: [parcelId], references: [id], onDelete: Cascade)
  @@index([parcelId, lienCategory, recordingDate])
}

model Foreclosure {             // RealAuction + lis-pendens distress state
  id              String   @id @default(cuid())
  parcelId        String
  stageCode       String   // Cotality FORECLOSURE STAGE CODE (NOD/LP/NTS/SCHEDULED/SOLD/REO)
  filingDate      DateTime?
  auctionDate     DateTime?
  judgmentAmount  Float?
  openingBid      Float?
  surplusBid      Float?
  plaintiffName   String?
  caseNumber      String?
  source          String
  capturedAt      DateTime @default(now())
  parcel          Parcel   @relation(fields: [parcelId], references: [id], onDelete: Cascade)
  @@index([parcelId, stageCode, capturedAt])
}
```

Every scraper/ingester writes BOTH:
- Typed row to one of the above tables (the queryable layer)
- Full Cotality-canonical-named row to `RawSnapshot` (the bronze training corpus)

## 5. Grey-zone playbook (the legal risk frontier)

User explicitly accepted slight legal risk. Here's the menu, color-coded:

### ✅ Clear green
- **Aggressive rate-limited scraping of public county records.** Civil only (county ToS, not CFAA per hiQ v LinkedIn 9th Cir.). Get IP blocked → rotate via Bright Data residential proxies. Standard.
- **Bypassing JS rendering / SPA / cookies / referer checks.** Public data, no auth. Standard.
- **Reverse-engineering unauthenticated mobile-app endpoints** (county appraisers often have public JSON APIs that power their mobile sites — same data, easier to parse than HTML).
- **Stoplight mock API exploration** to learn vendor endpoint shapes.

### ⚠️ Yellow (worth it; manageable risk)
- **Civitek scraping behind a session cookie** — they may have a TOS clause prohibiting bots but the data is public records and they don't appear to litigate. Risk: IP block.
- **Bypassing captchas** with 2captcha/AntiCaptcha service. Civil risk only; no CFAA absent auth circumvention.
- **Scraping behind "Are you a robot?" interstitials** with headless browsers + UA rotation. Civil ToS violation; no criminal liability.
- **Per-county appraiser scraping that exceeds documented rate limits** when no explicit ToS exists. Most FL counties don't publish API ToS at all.

### 🟠 Orange (real risk; do only if business value justifies)
- **Zillow / Redfin scraping.** Their ToS explicitly prohibit scraping; they have legal teams. They sue (Move v. Real Estate Webmasters, Zillow v. House Canary, etc.). hiQ helps but isn't a blanket shield. **Mitigation:** route through residential proxies, rotate UA, throttle to human-rate pace, never expose this data to external API consumers, never claim it as our own. Use only when an MLS aggregator license isn't available for that county.
- **Realtor.com scraping.** Move Inc. actively litigates. Skip unless the value is enormous; not worth it for the same data Zillow has.
- **Trial account abuse on PropMix / Estated.** Trial signups followed by bulk scraping — CFAA grey zone; civil ToS breach is certain. Has shut down startups before.

### 🚫 Red (do not, even with risk tolerance)
- **Cotality / Black Knight / ATTOM credential sharing / scraping behind paid login.** Criminal liability under CFAA. Civil damages real.
- **Acquiring MLS data outside an IDX/RESO license.** MLS lawsuits are frequent, well-funded, and damages-bearing. Real estate-specific federal cases (e.g. CRMLS v. Real Estate Webmasters). Take the legitimate route here.
- **Scraping s. 119.071 F.S. exempt records** (cops, judges, prosecutors, prison guards, DCF employees + their families). This is FL criminal liability. Filter these out at parse time if we accidentally fetch them.
- **PII aggregation beyond what's already public.** No SSN, no DOB lookups, no health records, no anything that touches GLBA/HIPAA/FCRA.

### Hardening (regardless of color)
- **Always proxy through residential IPs** (Bright Data, Smartproxy, IPRoyal). Direct datacenter IPs from Railway = instant block on most targets.
- **Persist `RawSnapshot` BEFORE attempting normalization.** If a request succeeds but our parser breaks, the data is still saved.
- **Throttle per-target.** Auto-detect target's response-time degradation as a signal to slow down (= polite scraping, less likely to get blocked).
- **Tag every scrape attempt with a `legalRisk` enum** (`green` | `yellow` | `orange`) in `RawSnapshot.metadata`. If we ever need to purge orange data, one SQL.
- **Never serve grey-zone data via our public API.** Internal scoring only. The output (a score) launders the source attribution.

## 6. First 30 days — concrete deliverables

| Week | Owner: Claude (CTO+lead) | Deliverable | Cotality field coverage gained |
|---|---|---|---|
| 1 | Acquire NAL + SDF (DOR SharePoint direct download via Playwright, or email backup) | `data/raw/fl-dor-2025/{NAL,SDF}.zip` in hand | Pre-req for everything |
| 1 | Run `FlDorIngester` against statewide NAL | All FL parcels in `Parcel` with current-year valuation + owner + situs | +120 fields |
| 1-2 | Build + run `FlDorSdfIngester` for sale history | `ParcelSale` populated 2009→present statewide | +10 fields |
| 2 | Build `FloridaGioHubIngester` for parcel geometry | `Parcel.latitude/longitude` populated for all parcels | parcel geometry (joins enable map UI) |
| 2-3 | Schema additions: `ParcelSale`, `Mortgage`, `Lien`, `Foreclosure` | `db push` applied | structural |
| 3-4 | Civitek MyFloridaCounty ORI scraper (mortgage + lien recordings, near-statewide) | `Mortgage` + `Lien` populated near-statewide | +300 fields (mortgage/lien bucket) |
| 4 | RealAuction parser | `Foreclosure` populated for dozens of counties | +20 fields |
| 4 | LienHub/TaxSys parser | tax-distress `Lien` rows | +15 fields |
| 4 | Engine fix: `PropertyDataPoint` per-field history (the master plan F3 #1) | re-scrape no longer overwrites | structural |

**End of Week 4 target:** ~465 of 981 Cotality fields covered (~47%) for all 67 FL counties, $0 in vendor spend, zero per-county artisanal work.

The build cadence after that: 2 weeks of building qPublic/iasWorld scrapers (F3.1–F3.4) gets us to ~535 fields (~55%); 1 week of free-API enrichment (F3.5) gets to ~575 (~59%); F4 is opt-in for the listing layer.

## 7. What I need from you to start Week 1

1. **Permission to drive the FL DOR SharePoint download from a Playwright script in CI.** The page is public; this is green-zone scraping but I want explicit OK before introducing a headless-browser dependency for the cron worker.
2. **Bright Data (or Smartproxy / IPRoyal) account.** Required for F2 onward — without residential proxies, the county clerk sites will rate-limit + IP-block Railway egress within hours.
3. **Confirmation on F4 (MLS layer).** Want me to plan for Zillow grey-zone scraping when we get to it, or skip ahead to an MLS aggregator license search? Affects whether Week 10-12 builds at all.
4. **Confirmation on the grey-zone color choices in §5.** Anything you want me to upgrade (more risk OK) or downgrade (back off)?
