# Property-Data Expansion — every public attribute worth grabbing

> Scoping doc (2026-06-13). Goal: capture every **publicly available** property attribute that
> either (a) lowers AVM median APE or (b) enriches the user-facing property profile. Grounded in
> research on FL county sources, FL public datasets, and industry AVM/investor-platform feature sets.
> Two metros to prove on first: **Miami-Dade (12086) + Broward (12011)** (our AVM eval frame).

## TL;DR — the three reframes

1. **We're closer than the "9.3%" framing implied.** Industry *off-market* AVMs (the honest comparison) run ~7% median error (Zillow 7.0–7.2%, Redfin 7.28%, HouseCanary pre-list ~7.5%); *on-market* (with live listing/photos) is ~2%. Our **single-family out-of-time is 9.38%** — already in the off-market vendor ballpark. The gap to best-in-class is **condition + condos**, not raw data volume.
2. **The industry's #1 recent accuracy lever is CONDITION/QUALITY**, which vendors derive via **computer vision on listing photos** (HouseCanary, CoreLogic, Quantarium → As-Is/As-Repaired/As-Renovated). We have no MLS photos — so our **public proxies for condition are (a) building permits and (b) the appraiser's improvement-quality grade.**
3. **Free win already in hand:** the FL DOR NAL file we already ingest carries **`EFF_YR_BLT` (effective year built — captures renovation)** and **`IMP_QUAL` (improvement quality grade 1–6)** and **`SPEC_FEAT_VAL` (extra-feature $ lump)**. The AVM uses **none of them** today. Capturing + adding these is a $0-acquisition feature test we can run immediately.

## What the AVM uses today vs. the canonical feature set

Current 16 features: `squareFeet, lotSize, ageYears, propertyType, ownerOccupied, outOfStateOwner, situsZip, lat, lng, zipMedianSalePrice, zipPricePerSqft, zipSaleVelocity12mo, zipTrend12moPct, neighborhoodPricePerSqft, neighborhoodCompCount, saleMonth`.

Industry AVM driver ranking (synthesized from Zillow/Redfin/CoreLogic/HouseCanary/Quantarium/FHFA): **location $/sqft → GLA/sqft → comp recency/density → property type → beds/baths → condition(C1–C6) + quality(Q1–Q6) → age/effective-age → lot → renovation/permits → waterfront/view/pool/garage → last sale.** We're missing the **bold** middle of that list.

---

## Inventory A — Structural / building characteristics (the AVM gap)

Have? = in our `Parcel` table today. Source = best FL public path.

| Attribute | Have? | AVM | User | FL public source |
|---|---|---|---|---|
| Living/heated sqft | ✅ (TOT_LVG_AR) | core | ✅ | DOR NAL statewide |
| Lot size | ✅ | high | ✅ | DOR NAL |
| Year built | ✅ (ACT_YR_BLT) | high | ✅ | DOR NAL |
| **Effective year built** | ❌ (in NAL, dropped) | **high** (renovation) | ✅ | **DOR NAL `EFF_YR_BLT` — free now** |
| **Improvement quality grade (1–6)** | ❌ (in NAL, dropped) | **high** (condition proxy) | med | **DOR NAL `IMP_QUAL` — free now** |
| Extra-feature value ($ lump) | ❌ (in NAL) | med | low | DOR NAL `SPEC_FEAT_VAL` — free now |
| **Bedrooms** | ❌ | **high** | ✅✅ | **Miami-Dade free ArcGIS; Broward scrape; per-county** |
| **Bathrooms (full/half)** | ❌ | **high** | ✅✅ | Miami-Dade free ArcGIS; Broward scrape |
| Stories / floor count | ❌ | med | ✅ | Miami-Dade `FLOOR_COUNT`; per-county |
| Units in building | ❌ (have NO_RES_UNTS in NAL) | med | ✅ | DOR NAL `NO_RES_UNTS` + county |
| Heated vs gross vs adjusted sqft | partial | med | med | Miami-Dade ships 5 sqft measures |
| Garage (type/spaces), carport | ❌ | med | ✅✅ | county CAMA / permits; rarely bulk |
| Pool (+ type) | ❌ | med | ✅✅ | county extra-features / permits |
| Patio / porch / deck / **balcony** | ❌ | low-med | ✅ | county extra-features (often desc-only) |
| Dock / boatlift / seawall (waterfront) | ❌ | **high (waterfront mkts)** | ✅✅ | county extra-features + waterfront flag |
| Roof type/material/age, ext wall, foundation, HVAC, fireplace, flooring | ❌ | med | med | **mostly NOT public in bulk** (internal CAMA; sometimes via permits) |
| Construction quality (Q1–Q6) / condition (C1–C6) | ❌ | **highest recent lever** | ✅✅ | **not public** — derive from permits + IMP_QUAL + (future) CV on photos |

**Per-county acquisition tiers** (building chars are inherently per-county CAMA — no statewide shortcut beyond the thin DOR roll):
- 🟢 **Miami-Dade** — free open ArcGIS REST (`gisweb.miamidade.gov/.../MapServer/24`): beds, baths, half-baths, floors, units, 5 sqft measures, year built — 942k records, no login, paginated. **Best free building layer in FL. Build first.**
- 🟢 **Hillsborough** (HCPAFL GeoHub), **Pinellas** (PCPAO open data) — open bulk/GeoHub exports.
- 🟡 **Palm Beach / Orange / Duval** — GIS + downloadable; building detail via export/property-card.
- 🔴 **Broward** — GIS exposes geometry+folio only; building data via per-parcel AJAX scrape (`web.bcpa.net/BcpaClient/search.aspx/getParcelInformationByFolioNumber`: year built, eff year, adj/under-air sqft, units/beds/baths combined, extra-feature descriptions) or paid bulk. No roof/wall/construction public.
- ⚪ **Long tail (60+)** — most expose year built + heated sqft + use code; beds/baths county-by-county; granular structure usually records-request only.

---

## Inventory B — Non-structural public datasets (risk, regulatory, neighborhood, income)

| Dataset | Have? | AVM | User | FL public source |
|---|---|---|---|---|
| **Building permits** (renovation/condition proxy) | ❌ | **high** | **high** | Miami-Dade ArcGIS FeatureServer (free, EstProjectCost+dates+contractor); Broward ePermits (scrape); cities on Accela/eTRAKiT |
| **FEMA flood zone + BFE** | ❌ | **high** (coastal discount) | **high** | FEMA NFHL REST (free, no key) — point-in-polygon per parcel |
| FL storm-surge / evac zone (SLOSH) | ❌ | med-high | **high** | FDEM `maps.floridadisaster.org` |
| Sinkhole / subsidence | ❌ | med | high | FDEP/FGS open data (call-in caveat) |
| **Septic vs sewer (FLWMI)** | ❌ | med | **med-high** (rehab cost) | FDOH FLWMI REST — per-parcel, all 67 counties, free |
| **CDD non-ad-valorem assessment** | partial (on tax roll) | med-high (carrying cost) | **high** | rides the NAL/tax roll we already pull — near-$0 |
| Zoning / land use | ❌ | med | med | per-county ArcGIS (no statewide) |
| **STR (Airbnb) legality** | ❌ | low | **high** (flippers) | *derived* per parcel from zoning + local ordinance (F.S. 509.032; SB280 vetoed) — manual ordinance map per metro |
| School zones + FL DOE grades | ❌ | med | **high** | district GIS + `fldoe.org` grades (free); NCES SABS |
| Census demographics (income, owner-occ, vacancy) | ❌ | high | high | Census ACS API (free) |
| HUD-USPS vacancy | partial | med | high | HUD USPS vacant-address data |
| Crime / walkability | ❌ | med | high | FBI CDE API (agency-level); EPA Walkability Index |
| Broadband availability | ❌ | low-med | med | FCC National Broadband Map |
| **Rent estimate / HUD FMR (SAFMR ZIP)** | ❌ | n/a | **high** (buy-hold) | HUD FMR API (free ZIP baseline); RentCast (paid) for parcel-level |
| Distress (lis pendens / foreclosure / tax-delinq / probate / liens / code) | ✅ mostly | high | high | clerk records — already in pipeline (Pinellas bulk, RealAuction, tax-delinquent, probate) |

---

## Inventory C — User-facing "table-stakes" profile (what PropStream/BatchData/DealMachine/Privy show)

Users now expect a full property card: **summary** (type, beds/baths, sqft+lot, year, stories, garage, pool, photos) · **valuation** (AVM + range/confidence, assessed/market, equity %, LTV, **ARV**) · **ownership** (true owner behind LLC/trust, absentee vs owner-occ, tenure) · **contact** (skip-traced phones/emails) · **mortgage/lien** (loans, balance, rate, lender; 2nds; tax/HOA/mechanic's liens) · **tax** (annual + delinquent) · **distress** (pre-fc/auction/vacant/probate/code) · **transaction history** · **comps** ($/sqft, sold+active, before/after renovated) · **rental/income** (rent estimate, cap rate, cash-flow proforma). We already have a chunk (ownership, distress, comps, valuation, tax-delinq); the gaps mirror Inventories A+B.

---

## Condo fix (the single biggest AVM-accuracy gap)

Condos = 14% APE because the model is blind to **floor/level, unit line/stack, view, end-unit, building, HOA fee/reserves/special-assessment/% owner-occ**, and because **same-building comp pools are thin**. The fix is two-part: (1) capture floor/line/view/building/HOA attributes (Miami-Dade exposes floor/units; HOA/floor-line often need the CAMA card or listing data), and (2) **run condos through a same-building/same-line comp restriction**, not the SFR radius-comp path. This is a distinct modeling track from SFR.

---

## Build architecture + phased plan

Pattern mirrors the existing per-county scrapers (tax-delinquent / clerk). New `Parcel` columns (nullable, per-county populated): beds, baths, halfBaths, stories, unitsInBuilding, effectiveYearBuilt, impQuality, heatedSqft, garageType, garageSpaces, hasPool, waterfront, + a `building_permits` relation + flood/risk fields (or a `ParcelRisk` table). AVM: add to `export-avm-training.ts` → retrain → re-run the existing out-of-time eval to measure lift per feature.

**Phase 0 — free wins (days, $0 acquisition):**
- Add `EFF_YR_BLT`, `IMP_QUAL`, `SPEC_FEAT_VAL`, `NO_RES_UNTS` from the NAL we already pull → Parcel columns → AVM features → re-eval. Measures the renovation/quality lift for zero scraping.
- CDD non-ad-valorem from the tax roll → carrying-cost field.

**Phase 1 — Miami-Dade (the easy metro, free ArcGIS):**
- Ingest beds/baths/floors/units/5-sqft from the open layer → AVM features + UI.
- Ingest Miami-Dade building permits (free FeatureServer) → renovation/condition signal + `effectiveAge` proxy.
- FEMA NFHL flood zone + FLWMI septic (both free, statewide REST) — universal, do once.
- Re-run out-of-time eval; quantify the lift vs the 9.38% SFR / 13.97% condo baseline.

**Phase 2 — Broward + condo track:**
- Broward per-parcel BCPA scrape (yellow-zone hardening) for beds/baths/sqft/eff-year.
- Condo same-building comp restriction + floor/line/HOA capture; separate condo eval.

**Phase 3 — statewide + user profile:**
- Roll the free statewide layers (FEMA, FLWMI, census, FL DOE, HUD FMR, CDD) across all 67 counties; county-by-county CAMA for beds/baths where open (Hillsborough/Pinellas/PB/Orange next).
- Surface the full property card in the leads/underwriting UI.
- (Longer-horizon) computer-vision condition scoring once a photo source exists.

## Key source URLs
- DOR NAL/SDF guide (EFF_YR_BLT/IMP_QUAL/SPEC_FEAT_VAL defs): floridarevenue.com/property/Pages/DataPortal.aspx
- Miami-Dade building chars (free): gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/24
- Miami-Dade permits (free): services.arcgis.com/lQySeXwbBg53XWDi/arcgis/rest/services/building_permits/FeatureServer/0
- BCPA per-parcel: web.bcpa.net/BcpaClient/search.aspx/getParcelInformationByFolioNumber
- FEMA NFHL: hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- FLWMI septic/sewer: gis.floridahealth.gov/server/rest/services/FLWMI/FLWMI_Wastewater/MapServer
- HUD FMR API: huduser.gov/portal/dataset/fmr-api.html · Census ACS: api.census.gov · FL DOE grades: fldoe.org/accountability/data-sys
