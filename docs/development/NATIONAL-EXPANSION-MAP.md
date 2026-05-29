# National Expansion Map — per-state F1 source inventory

**Author:** CTO
**Status:** Working doc — populated state-by-state as we ship each phase
**Purpose:** When FL hits coverage ceiling (per [FL-COVERAGE-PLAN.md](FL-COVERAGE-PLAN.md)), this is the lookup that drives the per-state F1 (statewide bulk ingest) build for every other state.

The pattern is state-agnostic. Each state needs:
- **F1 — Statewide bulk source(s)** for assessment + ownership + sale history (NAL/SDF equivalent)
- **F1 — Statewide geometry source** (parcel polygons + lat/lng)
- **F2 — Per-platform scrapers** for distress (clerk recordings, foreclosure auctions, tax delinquency) — many states share platforms with FL
- **Per-state mapper file** (~200 lines) maps the source's column names → Cotality canonical field names

The engineering work per state is **just the F1 mapper + URL discovery**. F2 scrapers built for FL (RealAuction, Grant Street, Civitek where multi-state) carry over as-is.

---

## Tier 1 — High-priority states (year 1)

These five states cover ~40% of US real-estate investor activity. Build order: FL → TX → GA → AZ → NC.

### Florida (FL) — IN PROGRESS ✅
- **F1:** FL DOR NAL + SDF + NAP statewide CSV. Free. Annual. SharePoint REST API works (no Playwright needed). See [fl-dor-portal.ts](../../lib/data-sources/bulk/fl-dor-portal.ts), [fl-dor.ts](../../lib/data-sources/bulk/fl-dor.ts), [fl-dor-sdf.ts](../../lib/data-sources/bulk/fl-dor-sdf.ts).
- **F1 geometry:** FloridaGIO Hub item `efa909d6...` — NAL data joined with parcel polygons. FGDB/Shapefile/CSV/GeoJSON. (Hub bulk file ingester is a TODO.)
- **F2:** Civitek-shape clerks (county-specific), RealAuction (16 counties confirmed), Grant Street LienHub (~30 counties), Civitek MyFloridaCounty ORI (near-statewide).
- **Status:** F1 complete + verified (1194 rows/sec on Railway PG). F2.1 + F2.2 scaffolded; live verification pending.

### Texas (TX) — Year 1, Q2
- **F1:** NO statewide tax roll. Each appraisal district publishes its own. Largest:
  - **HCAD** (Harris County / Houston): https://pdata.hcad.org — bulk file downloads, free, annual
  - **DCAD** (Dallas) / **TCAD** (Travis/Austin) / **TAD** (Tarrant/Fort Worth) / **BCAD** (Bexar/San Antonio) all publish bulk files
  - 254 counties total but the **5 metro CADs cover ~70% of TX population** — high pareto frontier
- **F1 geometry:** TxDOT GIS Open Data — statewide parcel layer (limited attribution) + per-CAD detailed
- **F2:** Per-county clerk sites are diverse; **PropertyRadar / Foreclosure.com** are the de facto distress aggregators. RealAuction is NOT widely used in TX.
- **TX-specific:** Foreclosure auctions are NOT judicial — they're at courthouse steps on the first Tuesday of every month, posted as **NTSA (Notice of Trustee Sale)** filings. Each county clerk handles NTSAs independently. Substantial per-county scraping required.
- **Estimated build:** 3-4 weeks (5 metro CADs + NTSA scrapers for top 10 counties)

### Georgia (GA) — Year 1, Q3
- **F1:** Georgia DOR statewide property tax roll. Each county submits annually; DOR aggregates.
  - Portal: https://dor.georgia.gov/local-government-services
  - Format: CSV per county, annual
- **F1 geometry:** GA GIO statewide parcel layer (similar to FloridaGIO)
- **F2:** **Garaventa Software** runs most GA clerk-of-superior-court sites — shared platform (similar pattern to FL Civitek). One scraper, ~80 of 159 counties.
- **Foreclosure:** Non-judicial like TX. **Foreclosure-listings published in legal newspapers** weekly. We scrape via the legal-newspaper aggregator at https://www.gpinfo.org for unified coverage.
- **Estimated build:** 2 weeks (DOR file + Garaventa scraper + legal-paper scrape)

### Arizona (AZ) — Year 1, Q4
- **F1:** Arizona Department of Revenue Property Tax Division publishes a statewide-equivalent dataset. Each county also publishes.
  - Maricopa (Phoenix) is the dominant market — handles 60%+ of AZ activity alone
  - **Maricopa Assessor:** https://mcassessor.maricopa.gov — bulk file download, free
- **F1 geometry:** Maricopa GIS + AZGEO (statewide)
- **F2:** **PropertyRadar** dominates here too. AZ has **judicial foreclosure** (lis pendens recorded) which gives us the Civitek/clerk pattern back.
- **Estimated build:** 1-2 weeks (Maricopa-only first, then 4 more metros)

### North Carolina (NC) — Year 1, Q4
- **F1:** NC Office of the State Auditor publishes county tax-roll exports. Less unified than FL but each county uploads in roughly the same format.
  - **Wake** (Raleigh): https://www.wake.gov/departments-government/tax-administration — open data portal
  - **Mecklenburg** (Charlotte): https://www.mecknc.gov/AssessorsOffice
- **F1 geometry:** NC OneMap statewide parcel layer
- **F2:** NC has **judicial foreclosure** in some counties, **non-judicial** in others (Power of Sale). Per-county clerk sites; **TruWeb** runs ~30 counties.
- **Estimated build:** 2-3 weeks

---

## Tier 2 — Year-2 expansion (top metros only)

| State | Tier-2 metros | F1 source | Notes |
|---|---|---|---|
| **California (CA)** | LA, San Diego, SF Bay, Sacramento, San Bernardino | County-by-county — NO statewide; LA Assessor open data is the dominant single source | Heavy proposition-13 rules; legal complexity |
| **New York (NY)** | NYC (5 boroughs), Westchester, Long Island | NYC DOF Real Property Assessment Data — single bulk file covers 5 boroughs | NYC alone = ~5% of US transactions |
| **Illinois (IL)** | Cook (Chicago), DuPage, Lake | Cook County Assessor open data | Cook = 5M+ parcels by itself |
| **Pennsylvania (PA)** | Philadelphia, Allegheny (Pittsburgh) | Per-county; Phila open data is excellent | |
| **Ohio (OH)** | Cuyahoga (Cleveland), Franklin (Columbus), Hamilton (Cincinnati) | Each county has open data portal | |
| **Michigan (MI)** | Wayne (Detroit), Oakland | County-level; many use BS&A platform | BS&A scraper from FL plan reusable here |
| **New Jersey (NJ)** | Statewide via NJ Treasury | NJ has the cleanest statewide format we've seen in any state | Possibly faster than FL — one parser does all |

---

## Tier 3 — National coverage (year-3 fill-out)

Remaining states. Lower investor volume each but together = important national coverage. Pareto-prioritize within each by metro population:
- **Massachusetts, Connecticut, Maryland, Virginia, Washington, Oregon, Colorado, Tennessee, Indiana, Missouri, Minnesota, Wisconsin, Kentucky, Alabama, Louisiana, South Carolina, Oklahoma, Kansas, Iowa, Nevada, Utah, Idaho, Arkansas, Mississippi, New Mexico, Hawaii, Alaska, West Virginia, Maine, Vermont, New Hampshire, Rhode Island, Delaware, Montana, Wyoming, North Dakota, South Dakota, Nebraska, DC**
- For each: identify F1 statewide source (or county-list) + map any FL-built F2 scrapers that work.

---

## F2 platform reusability matrix (FL-built scrapers that carry over)

| Platform (FL scraper) | Other states using same platform |
|---|---|
| **Civitek MyFloridaCounty ORI** | FL only |
| **RealAuction** (`*.realforeclose.com`, `*.realtaxdeed.com`) | FL, OH, NJ, AL, GA (limited), AZ (limited) |
| **Grant Street LienHub / TaxSys** | FL, NC (parts), GA (parts), CA (parts), CO (parts), NV |
| **qPublic / Schneider Geospatial** | ~700 counties across FL, GA, AL, TN, KY, MS, NC, SC, VA, WV — single biggest reuse |
| **iasWorld / Tyler Tech** | ~3,000 jurisdictions nationally — most-common appraiser platform in US |
| **BS&A** | MI dominant; some IL, OH, IN |
| **TruWeb** | NC, SC (smaller) |
| **Garaventa Software** | GA dominant |
| **Civitek (general civitek.com)** | FL only |

**Implication:** the F2.x scrapers (clerk-recordings, RealAuction, LienHub, qPublic, iasWorld) built for FL **already cover much of TX, GA, NC, AL, OH, NJ, MI distress data** with only URL list expansion (no new parser code).

---

## Per-state build template

When adding state X:

1. **Discover F1 source(s).** Search "{state} DOR property tax roll bulk download" + check the state's open-data portal. Document URLs + access pattern + format + cadence.
2. **Identify the geometry source.** Each state has a GIS clearinghouse — find their parcel layer.
3. **Build the per-state mapper.** Copy `fl-dor-mapper.ts` → `{state}-dor-mapper.ts`; map THIS state's column names to Cotality canonical fields.
4. **Build the per-state ingester.** Copy `fl-dor.ts` → `{state}-dor.ts`; ~50 lines of state-specific quirks (state code, FIPS crosswalk file, any header-row variation).
5. **Wire FIPS crosswalk** for the new state's counties.
6. **Expand the F2 scraper county lists** — for each shared-platform scraper (qPublic, iasWorld, RealAuction, etc.), add the state's covered counties to its registry.
7. **Build state-specific F2 scrapers** for whatever platforms don't carry over (e.g., TX needs NTSA scrapers).
8. **Run statewide ingest** via the existing `fl-dor-ingest-statewide.ts` pattern (rename to `{state}-dor-ingest-statewide.ts`).

Estimated **per-state ETA after the first one**: 1-3 weeks depending on how much of the state's F2 platform mix carries over from FL.
