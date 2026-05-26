# FlipOps Data Sourcing — Master Plan

**Owner:** CTO (synthesized from team: PM, Senior Dev 1 [FL sourcing], Senior Dev 2 [architecture/national], Junior Dev [recon])
**Date:** 2026-05-26
**Goal:** Source all possible property + distress data by county — Florida first, then national — for a fraction of Cotality ($54k/5 counties) or BatchData ($0.30/call).

---

## CTO summary & decisions

The team's research produced one paradigm-shifting finding and a clean architecture to exploit it:

**Florida is ~90% solved by FREE bulk public data, not scraping.** Because of the Sunshine Law, the Florida DOR republishes every county's certified tax roll as free statewide CSVs, and FloridaGIO publishes statewide parcel geometry. **Assessment + ownership + geometry for all 67 counties is a single bulk download — zero scraping.** Only the *distress layer* (delinquency, foreclosure, liens) needs scraping, and it runs on ~3 platforms. **Florida = 1 bulk ingester + ~3 platform parsers, not 67 scrapers.**

### Locked CTO decisions
1. **Adopt a `BulkIngester` as a first-class source modality** beside `CountyScraper`. Our current architecture only knows how to scrape per-county over HTTP — it has no home for bulk files. This is the central build.
2. **Add a non-tenant `Parcel` reference table.** Statewide bulk ingests must NOT mint ~10M `system`-owned `Property` rows (the current `resolveSystemUserId` hack). Bulk data lands in `Parcel` (keyed `countyFips+apn`); a tenant `Property` links to a `Parcel` only when a user works that lead.
3. **Make field resolution category-aware.** `assessed_value` resolves from cheap statewide bulk even when a fresh scrape exists; `tax_delinquent` resolves from a scraper because bulk never carries it. The distress layer is irreducibly scrape-only everywhere.
4. **Sequence nationally by bulk-availability.** FL → NY/MA/MT (also free statewide rolls) are near-free wins. TX/CA are fragmented (scraper-only). Platform-cluster parsers (qPublic, iasWorld, RealAuction) beat per-county work everywhere.
5. **Source-priority order (canonical):** statewide bulk file > statewide REST/GIS API > platform-cluster scraper > per-county Firecrawl > paid API fallback. Cost rises down the ranks; freshness is non-monotonic, so it's resolved per-field-category.

---

## 1. The strategic model: bulk "what/who" vs scraped "in trouble now"

Every property data point falls into one of two layers:

| Layer | Fields | Source | Changes |
|---|---|---|---|
| **Static identity** | owner, mailing addr, situs, assessed/just value, land use, year built, sqft, last sale, parcel geometry | **Bulk file** where a state publishes one; else platform scraper | Annually |
| **Live distress** | tax delinquency, tax certificates, foreclosure/lis pendens, mechanics/HOA liens, code violations | **Scraping only — no bulk shortcut exists anywhere** | Daily/weekly |

This split is **national, not FL-specific.** Bulk gets you the "what and who" of every parcel cheaply; scrapers get you the time-sensitive "is this owner in trouble right now" that drives lead quality. Our distress scorer's high-weight signals (pre-foreclosure, auction, liens) live entirely in the scrape-only layer.

---

## 2. Florida plan (flagship — execute first)

### 2a. Static layer — bulk, zero scraping

**FL DOR certified tax roll (NAL + SDF)** — the crown jewel. Free statewide CSV, all 67 counties, owner/address/value/land-use/year-built/last-sale. Annual (counties submit ~July, DOR posts ~August). NAL back to 2002, SDF to 2009.
- Access: https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
- Files >10MB delivered by email link; bulk requests to PTOTechnology@floridarevenue.com
- Layout doc: https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/User%20Guides/2025%20Users%20guide%20and%20quick%20reference/2025_NAL_SDF_NAP_Users_Guide.pdf

**FloridaGIO statewide parcels** — 10.8M parcels with geometry + the same roll attributes. Mapbox-ready boundaries for free.
- **Live FeatureServer (verified):** `https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0`
- Per-county query (Duval = CO_NO 16): `.../query?where=CO_NO=16&outFields=CO_NO,PARCEL_ID,OWN_NAME,PHY_ADDR1,JV,AV_SD,DOR_UC,ACT_YR_BLT,TOT_LVG_AR,SALE_PRC1,SALE_YR1&f=json&resultRecordCount=1000&resultOffset=0` (paginate via resultOffset)
- Bulk download (FGDB/Shapefile/GeoJSON/CSV): https://geodata.floridagio.gov/datasets/FGIO::florida-statewide-parcels/about

**NAL → ScrapedProperty field map** (exact CSV column names, verified from the live GIS schema):

| NAL field | Our field |
|---|---|
| `CO_NO` | (→ FIPS via lookup) |
| `PARCEL_ID` | apn |
| `OWN_NAME` | ownerName |
| `OWN_ADDR1`/`OWN_CITY`/`OWN_STATE`/`OWN_ZIPCD` | ownerMailingAddress |
| `PHY_ADDR1`/`PHY_CITY`/`PHY_ZIPCD` | address (situs) |
| `JV` | marketValue |
| `AV_SD` | assessedValue |
| `LND_VAL` | landValue |
| `DOR_UC` / `PA_UC` | propertyType (land-use code) |
| `ACT_YR_BLT` | yearBuilt |
| `TOT_LVG_AR` | squareFeet |
| `LND_SQFOOT` | lotSize |
| `SALE_PRC1` / `SALE_YR1`+`SALE_MO1` | lastSalePrice / lastSaleDate |

### 2b. Distress layer — ~3 platform parsers cover the state

| Platform | Covers | Pattern | Notes |
|---|---|---|---|
| **RealAuction** | foreclosure + tax-deed auctions, dozens of FL counties | `<county>.realforeclose.com` / `<county>.realtaxdeed.com`; calendar at `?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=` | One parser → many counties. Verified subdomains: alachua, bay, broward, citrus, hillsborough, marion, miamidade, pasco, santarosa, pinellas (realtaxdeed) |
| **LienHub / Grant Street TaxSys** | tax delinquency + certificates, ~30 FL counties | `lienhub.com/county/<slug>` | Verified: alachua, brevard, charlotte, citrus, clay, hillsborough, indianriver, lake, miamidade, orange, seminole. Canonical per-county list: DOR 2025 Tax Cert Sale PDF |
| **Civitek / MyFloridaCounty** | Official Records: lis pendens, liens, deeds — near-statewide | `myfloridacounty.com/ori/index.do` → `/orisearch/<countyCode>` | Searchable by doc type = LIS PENDENS + date range. Per-county form params vary; Civitek platform is consistent |

**Exceptions:** Palm Beach uses Grant Street (not RealAuction) for tax deeds; Miami-Dade has its own clerk foreclosure system. Handle as metro one-offs.

### 2c. Top-8 metro property-appraiser registry (for sub-annual refresh / direct lookup)

| County | FIPS | CO_NO | Appraiser URL | Platform | GET-addressable? |
|---|---|---|---|---|---|
| Miami-Dade | 12086 | 29 | apps.miamidadepa.gov/propertysearch | Custom React SPA | No (JS render) |
| Broward | 12011 | 13 | web.bcpa.net/BcpaClient | Custom ASP.NET | Yes — `gisweb-adapters.bcpa.net/...?FOLIO=` |
| Palm Beach | 12099 | 60 | pbcpao.gov | Custom (PAPA) | Yes — `/Property/RenderPrintSum?parcelId=` |
| Hillsborough | 12057 | 21 | gis.hcpafl.org/propertysearch | Custom GIS | No clean GET |
| Orange | 12095 | 37 | ocpaweb.ocpafl.org | Custom | Verify current pattern |
| Pinellas | 12103 | 52* | pcpao.gov/quick-search | Custom | Legacy viewer uses PARCELID |
| Duval | 12031 | 16 | paopropertysearch.coj.net/Basic/Detail.aspx | Custom ASP.NET | **Yes — `?RE=` (WORKING)** |
| Lee | 12071 | 25 | leepa.org/search/propertysearch.aspx | Custom ASP.NET | Yes — `DisplayParcel.aspx?FolioID=` |

\* verify Pinellas CO_NO; junior dev flagged a collision in the partial table.

**Florida needs ~4-6 build units total:** 1 DOR/FloridaGIO bulk ingester + RealAuction parser + LienHub parser + Civitek ORI parser + (optional) qPublic parser (~30 small counties) + a few metro one-offs. **Everything is Tier 1-2 (open); no paid subscriptions.**

---

## 3. National generalization

The FL bulk pattern partially generalizes. The partial-ness IS the sequencing map:

| Tier | States | What's available | Effort |
|---|---|---|---|
| **FL-like (free statewide bulk: assessment + ownership)** | **FL, NY** (data.ny.gov, 4.7M parcels), **MA** (MassGIS, 2×/yr), **MT** (MSL cadastral + DOR Orion CAMA, monthly) | One bulk ingester lights up the whole state's static layer | ~2-3 days/state (reuse abstraction) |
| **Partial (statewide GIS geometry, thin assessment)** | NC (OneMap), WI (SCO), OR (ORMAP) | Geometry + identity cheap; assessment needs platform scraper or county join | Medium |
| **Fragmented (per-county only)** | **TX** (254 appraisal districts, no statewide roll), **CA** (ParcelQuest sells it, no free roll) | Lean on platform-cluster parsers + Firecrawl | High — scraper-only |

**National vendor-platform leverage** (write a parser per *platform*, not per *county*):
- Assessment/CAMA: **Schneider qPublic/Beacon (~600-800 counties)**, Tyler iasWorld (~400), Manatron (~200), Patriot (~150), Vision (~80), DEVNET (~100+)
- Tax/delinquency: **Grant Street TaxSys/LienHub** (large counties incl. FL majors)
- Foreclosure/auction: **RealAuction (hundreds of counties nationally)**, GovEase (Southeast), Grant Street DeedAuction (CA/FL)

**~8-10 platform parsers + ~4 statewide bulk ingesters + Firecrawl for the long tail = national coverage in low-double-digit code artifacts, not 3,100 county scrapers.** That ratio is what keeps the economics at ~$5k/yr vs $54k+ Cotality.

---

## 4. Architecture changes (Senior Dev 2's design, approved)

### 4a. `DataSource` modality + `BulkIngester`
```ts
// lib/scrapers/base/data-source.ts
export type SourceModality = "scraper" | "bulk" | "api";
export interface DataSource {
  readonly modality: SourceModality;
  readonly sourceTag: string;       // canonical PropertyDataPoint.source
  readonly coverage: CoverageScope; // {state} | {state, countyFips[]} | nationwide
  readonly categories: ScrapeCategory[];
}
```
`CountyScraper` already effectively implements this. Add the sibling:
```ts
// lib/scrapers/base/bulk-ingester.ts
export abstract class BulkIngester implements DataSource {
  readonly modality = "bulk" as const;
  protected abstract mapRow(row: RawRow): ParcelRecord | null;
  protected abstract sourceTagFor(row: ParcelRecord): string; // "bulk:fl-dor-nal-2026"
  async ingest(opts?): Promise<BulkIngestResult> {
    // stream → parse (csv-parse / fixed-width / ogr2ogr for GIS) →
    // batch ~5k rows → COPY/createMany into staging table →
    // set-based merge into Parcel → emit PropertyDataPoint provenance.
    // NEVER materialize the whole file; checkpoint into a BulkIngestJob row.
  }
}
```

### 4b. New `Parcel` reference table (the biggest schema change)
- Non-tenant, keyed `@@unique([countyFips, apn])`, holds assessment/characteristics/ownership/last-sale/geometry.
- Bulk ingesters write here via set-based upsert (millions of rows, no per-row `$transaction`).
- `Property` (tenant-owned) gains optional `parcelId` FK; a `Property` is created/linked only when a user works a lead — kills the `system+scrapers` row-explosion.
- **Provenance stays unified** in `PropertyDataPoint` (`source: "bulk:..."` vs `"scraper:..."` vs `"batchdata"`). Keep that table — it's the best primitive we have.

### 4c. Fix the facade resolution
`resolveField` (`lib/data-sources/index.ts:73`) currently prefers any `scraper:` over any API blindly. Make it field-category-authority-aware via a `FIELD_AUTHORITY` map: static fields prefer bulk; distress fields prefer scraper (bulk has none). Add a `BulkIngestJob` model + `refreshBulkSource(tag)` cron sibling running on publication cadence (annual/monthly), not scrape cadence.

### 4d. Known scale fixes
- `upsertOne` per-property `$transaction` (`county-scraper.ts:275`) is fine for live scrapes but fatal at roll scale — bulk path uses batched/staged writes.
- Document the `source` tag taxonomy so the facade can reason about tiers.

---

## 5. Phased rollout & timeline (PM, approved)

| Weeks | Phase | Exit criteria | Owner |
|---|---|---|---|
| 1-2 | **P1: FL bulk** — DOR NAL/SDF ingester + FloridaGIO geometry + `Parcel` table + `BulkIngester` abstraction | All 67 counties' owner/value/geometry in DB, monthly cron, idempotent | SD1 + JD |
| 3-4 | **P2: RealAuction parser** — foreclosure + tax-deed statewide | ≥90% FL counties; distress linked to parcels; weekly cron | SD1 |
| 4-5 | **P3: LienHub parser** — delinquency + certificates | ≥30 FL counties | SD2 |
| 5-7 | **P4: Civitek ORI** — lis pendens + liens | near-statewide; lis pendens within 24h of filing; daily cron | SD2 |
| 7-8 | **P5: FL mop-up** — qPublic + metro one-offs + monitoring | **"Florida complete":** 67 counties static + ≥60 with ≥1 distress signal; all parsers health-monitored | JD + SD1 |
| 7-8 (parallel) | National state-tier audit | NY/MA/MT ingesters scoped | SD2 + JD |
| 9-14 | **P6: National bulk-shortcut states** (NY/MA/MT) + platform-cluster parsers | rolling state batches | SD2 leads |
| 15+ | National long tail via playbook | top 100 counties / ~60% US population | all |

**FL complete: ~Week 8. National MVP: ~Week 18-20.**

### County/source onboarding playbook (repeatable)
1. Identify source + tier (JD, 2-4h) → 2. Platform match check (30min — existing parser = config only, 1-2h) → 3. New parser/ingester build (SD, 2-4 days new platform / 2-3 days new bulk state) → 4. Verify against 20-50 known records (2h) → 5. Cron register (cadence: bulk monthly, auctions weekly, ORI daily) → 6. Health-monitor hookup.

---

## 6. Risk register (top items)

| Risk | Impact | Mitigation |
|---|---|---|
| Bulk file schema drift (breaks a whole state at once) | High | Schema validation every run; alert on unexpected columns; pin known-good layout version |
| Platform redesign breaks parser (affects all counties on it) | Medium | Weekly health checks; Firecrawl prompt-extraction is layout-resilient; monitor record-count anomalies |
| DB write perf at 10M+ rows | Medium | `Parcel` staging table + set-based merge; index on (countyFips, apn); test full FL load before national |
| Firecrawl cost at scale | Medium | Bulk ingesters use $0 direct HTTP; Firecrawl only for bespoke long tail; monthly credit budget alert |
| Distress staleness (missed signal) | High | Daily ORI refresh, weekly auctions; alert if last-success > threshold |
| Legal/TOS | Low (FL public data, no TOS) | Audit TOS before any national parser; never login-walled bidding flows, only public read |

---

## 7. Operations
- **Refresh cadence:** bulk rolls monthly · geometry quarterly · auctions weekly · Official Records daily.
- **Health dashboard:** per-source last-run / record-count / status (green/yellow/red) / consecutive-failure count. Alert on zero records, >30% WoW drop, ≥2 consecutive failures, schema-validation failure.
- **Cost tracking:** Firecrawl credits per job; bulk ingesters excluded; 80%-of-budget alert.

---

## Immediate next build (P1)

1. Add `Parcel` model + `BulkIngestJob` model to `prisma/schema.prisma`; `db push`.
2. Build `lib/scrapers/base/bulk-ingester.ts` + `lib/data-sources/bulk/fl-dor.ts` (NAL/SDF CSV ingester using the verified field map in §2a).
3. Build `lib/data-sources/bulk/fl-gio.ts` (FloridaGIO FeatureServer per-county pull for geometry).
4. Wire monthly cron; validate against Duval (already proven) as ground truth.
5. Make `resolveField` category-aware so bulk wins on static fields.

All verified URLs, field names, and county registry rows are in §2. The team's full reports are the working appendix; this document is the canonical plan.
