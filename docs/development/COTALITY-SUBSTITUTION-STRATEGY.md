# Cotality Substitution Strategy

**Status:** Strategic plan — implementation comes after vendor decisions
**Author:** FlipOps engineering
**Date:** 2026-04-28
**The problem we're solving:** Cotality quoted $54,000 / 12 months for FIVE counties. Scaling to all 3,100 US counties = ~$33M/year. Cotality is uneconomical for FlipOps at any stage short of late-stage growth.

**Source data analyzed:** Three Cotality data dictionaries provided by user (Property Domain v3, Tax Liens v1, HOA and Mechanics Liens v1) — combined ~1,100 fields across property characteristics, mortgage/lien tracking, tax data, and lien filings.

---

## TL;DR

**Cotality's data is 95% aggregated public records.** Their actual moat is:
- (a) the aggregation across 3,100 counties at scale,
- (b) proprietary entity-resolution (CLIP ID linking person + property records across systems),
- (c) ML propensity scores (refinance, list-for-sale, HELOC, purchase-mortgage).

**FlipOps does NOT need (b) or (c) for beta.** Real estate investors making cash offers don't care about CLIP linkage or HELOC propensity — they need to know: *is this property distressed, who owns it, how do I reach them?*

**Recommended path:**
1. **API supplements (already cheap):** BatchData PAYG ($0.30/call) + ATTOM (already wired) = covers ~70% of what investors actually use from Cotality
2. **Per-county scrapers (build as users onboard):** Tax delinquency, mechanics liens, HOA liens, foreclosure filings, code violations. Top 50 metros first. Build per-county; respect robots.txt; cache aggressively.
3. **Skip the rest:** No 15-year tax history, no 4-position open-lien tracking with ARM details, no propensity ML scores, no premium owner identifiers. Replace with our own scoring engine on the data we do have.

**Expected cost:** $650–$1,000/month at beta scale (vs $54k for 5 counties via Cotality, or $33M/yr if scaled nationally).

**What we lose vs Cotality:**
- Comprehensive open-mortgage-lien tracking with servicer balance updates
- 15-year tax history with 22 fields per year
- ML propensity scores (we replace with our own)
- CLIP-style entity resolution across millions of property records

**What this costs operationally:** ~6–10 weeks of engineering to build the scrapers + normalization layer for the top 50 markets. After that it's largely auto-pilot with periodic per-county maintenance.

---

## 1. Field-by-field sourcing matrix

Mapping every major Cotality data category to a viable substitute.

### 1a. Property characteristics (beds, baths, sqft, year built, structure details)

**Cotality coverage:** STRUCTURE SIZE V3 (12 fields), STRUCTURE - INTERIOR (10), STRUCTURE - EXTERIOR (17), STRUCTURE - ROOMS (10), STRUCTURE - AGE (2), construction details (CNSTR, FOUND, FRAME, RFCO, etc.) — total ~80 fields.

**Substitution:**
| Field | Cheap source | Notes |
|---|---|---|
| Beds, baths, sqft, year built | **ATTOM** (already integrated) | Full coverage, ~155M parcels |
| Lot size, acreage | **ATTOM** + county assessor | Free if scraped |
| Construction type, foundation, frame, roofing | **County assessor** | Public, scrape per market. ATTOM has partial coverage. |
| Universal building sqft, gross/adjusted area | **County assessor** | Specific to assessor methodology — can derive from raw |

**Coverage achievable:** 90–95% of fields, immediate via ATTOM + scraping for the long tail.

### 1b. Tax data (TAX V3 + 15 years of TAX_V2 history)

**Cotality coverage:** Current tax + 15 priors × 22 fields each = ~330 fields.

**Substitution:**
| Field | Source | Notes |
|---|---|---|
| Calculated/assessed/market values (current) | **County assessor**, ATTOM | Public |
| Tax amount, exemptions, jurisdiction | **County assessor** | Public, scrapeable per county |
| Tax history (3+ years) | **Scrape historical assessor rolls** | Most counties publish current + several years; deep historical is harder |
| 15-year tax history | **Skip for beta** | Real estate investors care about *current* delinquency, not 2011's tax bill |

**Coverage achievable:** 100% of current data via assessor scraping. We trim history to 3 years instead of 15 and call it done.

### 1c. Tax liens (the standalone Tax Liens dictionary)

**Cotality coverage:** 77 fields covering tax lien filings — federal, state, county tax liens. Includes lien transaction details, taxpayer info, lien amounts, refiling/extension dates.

**Substitution:**
| Source | What it covers | Cost |
|---|---|---|
| **County treasurer / tax collector websites** | Current delinquency, certificate sales, tax lien sales | Free, scrapeable |
| **County recorder/clerk** | Recorded tax lien documents (federal IRS liens, state liens) | Free, scrapeable (often as PDFs) |
| **PACER** (federal) | Federal tax liens via court records | $0.10/page |
| **BatchData** | `taxDelinquent` boolean flag | Already integrated |

**Specific scraping difficulty per county:** Tax delinquency lists are typically the EASIEST to scrape — most counties publish them publicly and update monthly. Sites like Realauction, GovEase, and Bid4Assets aggregate auctioned liens.

**Coverage achievable:** 95%+ for active delinquencies. Historical tax lien refiling/extension dates are harder but rarely operationally relevant.

### 1d. Mechanics liens & HOA liens (the third dictionary)

**Cotality coverage:** 54 fields per lien type — claimant info, contractor info, claim amounts, recording dates, document types, alias linkage.

**Substitution:**
| Source | What it covers | Difficulty |
|---|---|---|
| **County recorder/clerk filings** | Both lien types are recorded as documents at the county level | Hard — most counties have these as PDF images, not structured data |
| **PropertyShark, FreeRealEstate.io, etc.** | Some aggregators sell pre-parsed mechanics lien feeds | $50–$300/mo per state |
| **DataTree (FNF)** | Sells mechanics lien lists | Subscription, $$$ |

**Realistic approach:** This is the HARDEST category to replicate. Recorded liens are often PDFs requiring OCR. Recommendation:
- **Phase A (now):** Skip mechanics/HOA lien data entirely. Real estate investors mostly use these for niche distressed-buyer strategies; not core to wholesaling/flipping
- **Phase B (post-beta):** Subscribe to a pre-parsed feed (DataTree, PropertyRadar) for the markets where users want mechanics lien plays
- **Phase C (later):** Build OCR pipeline on county recorder PDFs if it becomes a competitive advantage

**Coverage achievable in beta:** 0% — and that's fine.

### 1e. Mortgage / open-lien data (FIRST through FOURTH POSITION)

**Cotality coverage:** 4 mortgage positions × ~30 fields each = ~120 fields. Includes loan amount, term, rate, ARM details, origination lender, current balance, modifications, servicer.

**This is Cotality's actual moat.** They have direct servicer feeds + recorder cross-referencing across the country, refreshed regularly. Our cheap alternatives:

| Source | What we get | What we DON'T get |
|---|---|---|
| **County recorder filings** | Loan amount at origination, lender, recording date, mortgage doc type | Current balance, payment history, modifications, refinances after origination |
| **ATTOM mortgage data** | Origination + some refinance tracking | Current balance, ARM payment schedules |
| **MERS** (Mortgage Electronic Registration Systems) | Active mortgage servicer lookup (free for mortgages registered with MERS) | Only ~70% of mortgages are MERS; not balance |
| **BatchData** | High-equity / free-clear flag (binary) | The actual numbers behind the flag |

**The unsolvable problem:** Current outstanding balance and payment status. To know "this owner has $185k left on a $300k loan," you need servicer data, which is what Cotality buys at scale.

**Workaround for FlipOps's actual use case:**
- For **wholesale/cash offer** workflows, you need rough equity, not exact. Use: `estimated_value − last_sale_price = rough_equity`. This overestimates equity (ignores subsequent refinances) but is functionally correct for most distressed sellers (long-term owners with appreciation).
- For **risk underwriting** (lending), you'd need accurate lien tracking and we'd need Cotality. We're not doing this.

**Coverage achievable:** 60–70% of what an investor needs for cash-offer math. Skip the rest.

### 1f. Owner data + premium owner identifiers

**Cotality coverage:** OWNER (PREMIUM) V3, OWNER PREMIUM IDENTIFIERS, OWNER MAILING (PREMIUM) — ~30 fields. Includes owner names (4 owner positions), corporate indicators, mailing addresses, vesting type codes, ETAL relationship codes.

**Substitution:**
| Source | What we get |
|---|---|
| **County assessor** | Current owner name, mailing address — public |
| **BatchData / ATTOM** | Owner name, mailing, absentee/in-state flag |
| **Skip trace via BatchData** | Phone + email for owner |

**What we lose:** Cotality's "Premium Owner Identifier" cross-references owners across multiple properties — useful for spotting portfolio owners. We can build this ourselves by joining on owner name + mailing address (fuzzy matching). Not perfect but workable.

**Coverage achievable:** 95% of the operationally-useful data.

### 1g. Equity, LTV, AVM

**Cotality coverage:** Multiple THVX (Total Home Value Index) products for marketing/originations/consumers, OPEN LIEN EQUITY AND LTV, propensity scores.

**Substitution:**
| Field | Source |
|---|---|
| Estimated value (AVM) | **ATTOM** (built-in AVM), **Zillow Zestimate** (scraping or unofficial API), our own comps engine |
| Equity (rough) | `AVM − last_sale_price` |
| Equity (precise) | Requires open-lien tracking we don't have — skip |
| Combined LTV | `(sum_origination_loans / AVM)` from county recorder data + ATTOM |

**Coverage achievable:** 80% accurate for the operational use case. Off by ~10–15% in cases where owner has refinanced or paid down significantly.

### 1h. Propensity scores (PURCHASE MORTGAGE / LIST FOR SALE / LIST FOR RENT / HELOC / REFINANCE)

**Cotality coverage:** 5 ML scores predicting likelihood of household action.

**Substitution: Build our own.** This is what FlipOps's existing Distress Scoring algorithm (`lib/reapi/utils/distress-scorer.ts` v2.0) already does at a basic level. We extend it with:
- "Likely to sell" score (existing)
- "Likely to accept cash offer" score (new — based on equity, distress signals, time owned, owner type)
- We don't need separate purchase/refinance/HELOC scores — those are for lenders, not investors

**Coverage achievable:** Different angle than Cotality, more aligned with investor use case. Net win.

### 1i. Foreclosure data

**Cotality:** Not in the three dictionaries provided, but typically in their core product.

**Substitution:**
| Source | Coverage |
|---|---|
| **BatchData** `preForeclosure`, `foreclosure` flags | Already wired |
| **County clerk court records** (NOD, NOTS filings) | Public, scrapeable per county |
| **PropertyRadar** | $99/mo for targeted foreclosure lists, very high quality |
| **PACER** for federal foreclosure cases | $0.10/page |

**Coverage achievable:** 95%+ via BatchData alone for beta.

### 1j. Bankruptcy

**Substitution:**
| Source | Coverage |
|---|---|
| **PACER** | Authoritative federal bankruptcy records |
| **BatchData** `bankruptcy` flag | Already wired, less detail than PACER |

**Coverage achievable:** 90%+ via BatchData. PACER for cases where deeper detail matters.

### 1k. Code violations & permits

**Substitution:**
| Source | Coverage |
|---|---|
| **Municipal open data portals** | NYC, Chicago, LA, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Austin all publish via Socrata or similar | Scrapeable, free, structured |
| **City-by-city scraping** | For cities without open data portals, scrape city building/permit dept websites | Per-city engineering effort |

**Coverage achievable:** 80%+ for top 30 metros within 1–2 weeks of scraper engineering each.

### 1l. Geospatial / parcel boundaries

**Substitution:**
| Source | Coverage |
|---|---|
| **County GIS** (parcel shapefiles) | Free or token cost in nearly every county |
| **OpenStreetMap** | Boundaries, roads |
| **Mapbox** (already using for Leads page) | Tile rendering |

**Coverage achievable:** 100% via county GIS downloads.

---

## 2. The scraping infrastructure plan

We don't build 3,100 county scrapers. We build **infrastructure that makes adding a county fast** and **prioritize the markets where users actually operate**.

### 2a. Per-county scraper architecture

```
lib/scrapers/
  base/
    county-scraper.ts          # abstract base class with common patterns
    proxy-rotator.ts           # rotates Bright Data / Smartproxy residential IPs
    scrape-cache.ts            # 24-72hr cache to avoid hammering county sites
    rate-limiter.ts            # respects robots.txt + polite delays
    pdf-ocr.ts                 # tesseract.js for recorder PDFs (fallback)
  counties/
    fl-duval/                  # one folder per county
      assessor.ts              # property characteristics
      treasurer.ts             # tax delinquency
      recorder.ts              # liens, deeds, mortgages
      clerk.ts                 # court records (foreclosure, bankruptcy)
    fl-orange/...
    fl-broward/...
```

**Common county-website vendors** (reduces scraper count):
- **Iasworld** (Tyler Technologies): used by ~400 counties — one parser handles them all
- **Patriot Properties**: ~150 counties
- **Vision Government Solutions**: ~80 counties
- **Manatron**: ~200 counties
- **Custom per-county sites**: the long tail, ~50–60% of counties

A single Iasworld parser unlocks ~13% of US counties at once. 5–6 vendor-specific parsers cover ~50% of the country. The remaining counties get one-off parsers as users request markets.

### 2b. Cron-driven refresh

```
lib/cron/scrape/
  daily-tax-delinquency.ts     # Re-scrape active markets daily
  weekly-foreclosure.ts        # Foreclosure filings weekly
  monthly-assessment.ts        # Assessment data monthly
  on-demand-lookup.ts          # User searches an address → fetch live
```

Stored in `Property` + new `PropertyDataPoint` table that tracks per-field source + freshness:

```prisma
model PropertyDataPoint {
  id          String   @id @default(cuid())
  propertyId  String
  field       String   // "tax_delinquent", "open_mortgage_balance", etc.
  value       String   // JSON-encoded value
  source      String   // "batchdata" | "attom" | "scraper:fl-duval-treasurer" | "manual"
  fetchedAt   DateTime
  expiresAt   DateTime?
  property    Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, field, source])
  @@index([propertyId])
  @@index([fetchedAt])
}
```

This lets the property record show a unified view, but we know exactly where each field came from and when it was fetched — important for audit and re-scraping.

### 2c. Legal stance on scraping

Public records are public. Scraping them is **legally permissible** in nearly all jurisdictions when you:
- Respect robots.txt
- Use polite rate limits (≥1 req/sec, never burst)
- Don't bypass paywalls or auth
- Don't violate computer fraud laws by exploiting vulnerabilities
- Don't redistribute the data verbatim — we transform/score/derive it

**hiQ Labs v. LinkedIn (2022)** established that scraping publicly accessible data isn't a CFAA violation. **Van Buren v. United States (2021)** narrowed CFAA further. We're on solid ground for public-records scraping.

What we should NOT do:
- Scrape data behind login walls (paid county subscriptions, MLS)
- Aggressive scraping that DOSes a county website
- Resell raw scraped data (we use it internally for our users' deal analysis)

---

## 3. Phased rollout

### Phase 1 — Stay on APIs only (now → beta launch)
- BatchData PAYG continues as primary distress + skip-trace data ($450/mo at target volume)
- ATTOM continues as property characteristics + AVM (already wired)
- Document sourcing matrix in CLAUDE.md so future engineering knows what we have
- **No scraping built yet.** Beta operates entirely on third-party APIs.
- **Expected coverage:** 70% of what Cotality offers, at <$500/mo

### Phase 2 — Scraper infrastructure + top 5 markets (post-beta, ~6 weeks)
- Build `lib/scrapers/base/` infrastructure (proxy, rate limit, cache, PDF OCR)
- Implement Iasworld + Patriot Properties parsers (covers ~550 counties — biggest leverage per parser)
- Pick top 5 user-requested counties (likely FL: Duval, Orange, Broward; TX: Harris, Travis based on demo data)
- Tax delinquency + assessment scrapers per county
- Per-field freshness tracking via `PropertyDataPoint` model
- **Expected new coverage:** Tax delinquency at 10× freshness vs BatchData refresh cycle, plus full assessor data for those counties
- **Engineering:** ~6 weeks for 1 senior engineer

### Phase 3 — Foreclosure + lien scrapers (Q2)
- County clerk court record scrapers (foreclosure NOD/NOTS filings)
- Recorder lien scrapers (mechanics liens, HOA liens — PDF OCR pipeline)
- PACER integration for federal liens + bankruptcy
- Top 20 markets covered
- **Expected new coverage:** Mechanics/HOA liens (Cotality's third dictionary, 95% covered)

### Phase 4 — Code violations + permits (Q3)
- Municipal open data portal scrapers (top 30 metros)
- Custom scrapers for cities without open data
- **Expected new coverage:** Code violation flag becomes a real distress signal in our scoring

### Phase 5 — National scale (Q4+)
- Roll out vendor-specific parsers as users onboard new markets
- Long-tail one-off scrapers
- Target: 100 counties covered, encompassing 60% of US population
- **At this point, FlipOps offers comparable distress + property data to Cotality at ~3% of their cost**

---

## 4. What we explicitly skip

These exist in Cotality's dictionaries but aren't worth replicating:

| Skipped | Why |
|---|---|
| 15-year tax history (330 fields) | Real estate investors care about current delinquency, not 2011's tax bill |
| 4 mortgage positions × ARM details (120 fields) | Cash-offer investors don't underwrite mortgages; rough equity is enough |
| 5 propensity ML scores | We build our own scoring on data we have; investor-relevant scoring not lender-relevant |
| CLIP cross-property linkage | We do simple owner-mailing-address fuzzy matching, "good enough" for portfolio detection |
| Loan modification tracking | Not relevant for cash-offer use case |
| Tax exemption details (homestead, senior, veteran) | Useful for some niche plays, not core |
| Premium owner identifiers (cross-system entity resolution) | Skip-trace + BatchData covers operational need |

If a power user demands one of these, we add it surgically — not by buying Cotality's $33M product.

---

## 5. Cost model — substitution vs Cotality

| Component | Cotality (5 counties) | Cotality (national) | FlipOps stack |
|---|---|---|---|
| Property data | included in $54k contract | ~$33M extrapolated | $0–450/mo (BatchData + ATTOM PAYG) |
| Tax data + lien tracking | included | included | $0 (scraping) + $200/mo proxy infra |
| Mechanics/HOA liens | included | included | $0 (skip for beta) → $50/mo per state aggregator (Phase 3) |
| Foreclosure/bankruptcy | included | included | $0 (BatchData) → +$99/mo PropertyRadar for power users |
| Skip trace | NOT included | NOT included | $150/mo (BatchData PAYG) |
| Propensity scores | included | included | $0 (build our own) |
| **Total monthly** | **$4,500/mo** | **~$2.75M/mo** | **$650–1,000/mo** |
| **First-year total** | **$54,000** | **~$33M** | **$8,000–12,000** |

**The math is brutal in our favor.** We give up ~30% of Cotality's depth to save 99.6% of their cost.

---

## 6. Engineering implications for FlipOps

### Schema additions (Phase 2)

```prisma
model PropertyDataPoint {
  id          String   @id @default(cuid())
  propertyId  String
  field       String
  value       String   // JSON-encoded
  source      String   // "batchdata" | "attom" | "scraper:fl-duval-treasurer"
  fetchedAt   DateTime
  expiresAt   DateTime?
  confidence  Float?   // 0-1, lower for scraped/inferred fields
  property    Property @relation(fields: [propertyId], references: [id])

  @@unique([propertyId, field, source])
  @@index([propertyId])
}

model CountyScraper {
  id              String   @id @default(cuid())
  countyFips      String   @unique  // "12031" for Duval, FL
  state           String
  county          String
  status          String   // "active" | "broken" | "pending"
  scraperType     String   // "iasworld" | "patriot" | "custom"
  lastRunAt       DateTime?
  lastSuccessAt   DateTime?
  errorCount      Int      @default(0)
  notes           String?
}
```

### New code modules

- `lib/scrapers/base/` — infrastructure
- `lib/scrapers/counties/<state>-<county>/` — per-county scrapers
- `lib/scrapers/vendors/iasworld.ts`, `patriot.ts` — vendor-specific parsers
- `lib/cron/scrape/` — cron jobs that run scrapers on schedule
- `lib/data-sources/` — unified API for "fetch field X for property Y from cheapest available source"

### UI surfaces affected

- **Leads page property detail** — show source per field (badge: "BatchData" / "Scraped: Duval Tax Office" / "ATTOM AVM")
- **Settings → Data sources** — admin view showing which counties are scraped, last refresh, error rates
- **Onboarding** — when a user picks markets, queue scrapers for those counties' data refresh

---

## 7. Verdict + immediate actions

**Ship beta on BatchData PAYG + ATTOM. Don't build scrapers yet.**

This delivers ~70% of Cotality coverage at ~$450/mo. Real estate investors will not notice the missing 30% in beta because that 30% is corner-case enterprise stuff (precise mortgage balance, 15-year tax history, propensity scores) that wholesalers and flippers don't actually use.

**Post-beta (when we have ~50 paying users + actual market signal), build the scraping infrastructure for top 5–10 markets.** That delivers 90% Cotality coverage at ~$650–1,000/mo, which is sustainable indefinitely and scales linearly with user count, not data volume.

**Cotality is correct to charge what they do.** Their product is genuinely valuable for institutional buyers (banks, hedge funds, REITs) doing risk underwriting. FlipOps is a small-investor tool. The economics never align. Don't sign.

### Immediate actions
1. **Document this decision in CLAUDE.md** so future engineering doesn't relitigate
2. **Continue current BatchData/ATTOM integration** — no changes needed
3. **Build a `data-sources` mental model** — when users ask "where did this data come from?", we have a clean answer per field
4. **Defer scraping to post-beta** — don't burn engineering on something that isn't blocking revenue

### Items still requiring user decision
- ~~Cotality contract~~ — pass
- BatchData remains primary data layer — confirmed in [VERSIUM-EVALUATION.md](./VERSIUM-EVALUATION.md)
- ATTOM remains primary AVM + property characteristics layer — already integrated
- Skip mechanics/HOA lien data for beta? Confirm OK
- Phase 2 scraping: defer until paying-user signal emerges (Q3 earliest)

---

*Source dictionaries: Cotality Property Domain v3 (1,072 rows / 980 fields), Tax Liens v1 (94 rows / 77 fields), HOA and Mechanics Liens v1 (69 rows / 54 fields). All © Cotality / CoreLogic.*
