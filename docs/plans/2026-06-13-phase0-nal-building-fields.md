# Plan — Phase 0: capture the free NAL building fields (AVM data expansion)

Part of the property-data expansion ([../development/PROPERTY-DATA-EXPANSION.md](../development/PROPERTY-DATA-EXPANSION.md)).
**Statewide** (all 67 counties) — these fields are in the FL DOR NAL roll we already ingest, at $0.

## Problem
The AVM (12.6% out-of-time; SFR 9.4%, condo 14%) is blind to condition/renovation. Three high-value
signals are **already in the NAL file we pull** but were dropped on ingest and unused by the AVM:
`EFF_YR_BLT` (effective year built — renovation-aware age), `IMP_QUAL` (1–6 quality grade — condition
proxy), `SPEC_FEAT_VAL` ($ lump for pool/dock/extras), `NO_RES_UNTS`. Capture them, add as AVM
features, and measure the lift — for $0 acquisition, before any scraping.

## Key design driver — geocode-safe backfill (the landmine)
A full NAL re-ingest is NOT a safe backfill: `bulk-ingester.ts` upserts `SET <col> = EXCLUDED.<col>`
for **every** column incl. `latitude`/`longitude`, and the NAL mapper emits `latitude=null` (geometry
is joined later by `fl-fgio-bulk.ts`). So a re-ingest would **wipe the 94.8% geocode backfill**.
→ The backfill is a **targeted `UPDATE … FROM (VALUES …)` of only the 4 new columns** (+ updatedAt),
never touching geocode/anything else. `ownerOccupied` is already safe (not in the NAL column set).

## Steps
1. **Schema** — `Parcel` += `effectiveYearBuilt Int?`, `improvementQuality Int?`, `specialFeatureValue Float?`, `numResUnits Int?`. `db push` (additive). ✅
2. **Forward-capture** — `nalRowToParcelRecord` maps the 4 NAL columns; `bulk-ingester.ts` `cols`/values/`ParcelRecord` carry them → future full ingests capture them statewide. ✅
3. **Backfill** — `scripts/backfill-nal-building-fields.ts` reads the on-disk NAL CSVs (`data/raw/fl-dor-2025/extracted/NAL_2025_co<NN>/`) and targeted-UPDATEs the 4 columns. Run Miami-Dade (12086) + Broward (12011) first (the AVM eval frame), then all 67.
4. **AVM** — add the 4 features to `export-avm-training.ts` + `train_avm.py` feature list → re-export the 2-metro frame → retrain control (recency-24mo) → re-run the out-of-time eval (`holdout-since 2025-06`). Measure the lift vs the 9.38% SFR / 13.97% condo / 12.61% all-types baseline.
5. **Decide** — if positive, run the statewide backfill (all 67) + promote. Roll the feature into the served model on the next deliberate AVM refresh (bundle with Arm C).

## Verification / test plan
- `db push` additive (verified via `migrate diff`); `typecheck` exit 0.
- Backfill: coverage probe — % of 12086/12011 parcels now carrying each field.
- AVM: out-of-time median APE delta, overall + by segment (SFR/condo/price-band). Honest reporting — a null result is a valid result (we keep the fields for UI value regardless).

## Non-goals
- Per-county CAMA scraping for beds/baths (Phase 1). Computer-vision condition (later). Re-scoring the live 1.5M `ParcelValuation` rows (defer to the deliberate AVM refresh).
