# Plan — Deliberate AVM refresh (Phase 0 NAL features + Arm C train/serve fix)

**Date:** 2026-06-15 · **Branch:** new `feat/avm-refresh` off current · **Status:** awaiting approval

Ships the two deferred AVM wins to the *served* model in one pass, then re-scores the
1.5M `ParcelValuation` rows. Phase 0 (free NAL building fields) is committed (`c893582`) and
backfilled statewide; this plan promotes it into production alongside the Arm C comp-window fix.

## Problem
The production AVM (`avm-v1`, 1.5M `ParcelValuation` rows, Dade+Broward) was trained with two
known weaknesses:
1. **No condition/renovation signal** — Phase 0 captured 4 free NAL fields (eff-age, quality,
   special-feature-$, units) that cut out-of-time APE **12.62% → 11.89%, SFR 9.38% → 8.59%**, but
   they only feed the *training* exporter; the served model has never used them.
2. **Train/serve comp-window skew** — v1 trains the neighborhood-comp feature on a **±90d
   symmetric** window but is served against a **trailing-18mo** window (`export-predict-features.ts`
   `COMP_WINDOW_MONTHS=18`). Arm C (recency-24mo + trailing-18mo comps) is the drop-in fix
   (out-of-time control 12.62%, leak-free).

## Non-goals
- **Statewide AVM.** `ParcelFeature` (the silver mart the exporters read) is populated only for
  12086 + 12011, so the refresh stays **2-metro** (apples-to-apples re-score of the existing 1.5M).
  Statewide serving is blocked on building `ParcelFeature` statewide — a separate initiative.
- **HPI time-adjustment** (Arm A) — already proven negative (2026-06-13), excluded.
- **New model architecture** — same LightGBM log-price regressor, same eval gate.

## Premises (verified against code 2026-06-15)
- ✅ `export-avm-training.ts` emits the 4 NAL features via `LEFT JOIN flipops."Parcel" pcl`:
  `effectiveAgeYears` (= saleYear − EFF_YR_BLT, guarded 1800–2100), `improvementQuality`,
  `specialFeatureValue`, `numResUnits`. Committed `c893582`.
- ❌ **`export-predict-features.ts` does NOT emit them** — hardcoded 16-col `CSV_COLUMNS`, reads
  `ParcelFeature f` only, no `Parcel` join. `train_avm.py --predict` fails loud on the missing
  columns ("train/serve skew"). **→ the one code change this plan requires.**
- ✅ NAL fields live on `Parcel` (statewide, 67/67, ~80% coverage); both exporters must `JOIN Parcel`
  for them (NOT `ParcelFeature`).
- ✅ `--comp-months 18` (trailing, leakage-safe) wired in the training exporter; `train_avm.py
  --temporal --recency-months 24` is the Arm C recipe. featureList derives from CSV columns, so no
  Python feature-list edit is needed.
- ✅ `apply-avm.ts` UPSERTs `ParcelValuation` on (countyFips,apn), chunked, **refuses unpromoted
  ModelVersion**; the table exists (1.5M rows). Re-score is reversible (re-apply prior model).
- ✅ Phase 0 + recency-24mo eval POSITIVE out-of-time (11.89% all / 8.59% SFR) — `project_avm_phase0`.

## Design / approach
- **Serve-parity fix** (`export-predict-features.ts`): add `LEFT JOIN flipops."Parcel" pcl` and 4
  columns with names/units **identical to training**: `effectiveAgeYears` =
  `EXTRACT(YEAR FROM NOW())::int − pcl."effectiveYearBuilt"` (same 1800–2100 guard; as-of-now is the
  serving analog of the per-sale saleYear), `improvementQuality`, `specialFeatureValue`,
  `numResUnits`. Add the 4 to `CSV_COLUMNS`. (predict() selects by name, so order is non-critical,
  but keep it adjacent to `ageYears` for readability.)
- **Promote gate = out-of-time temporal eval, NOT grouped.** v1's 9.72% headline is a grouped
  (interpolation) holdout on the *leaky* ±90d frame; a grouped holdout on the leak-free
  trailing-18mo frame is not comparable (can read higher despite a better model). The valid
  apples-to-apples comparison is out-of-time: incumbent ~12.6% → refresh target ~11.89%. The
  `--temporal --recency-months 24 --holdout-since 2025-06` run supplies BOTH the gate and the band.
- **Serving model** = same temporal recipe; one deep frame (`--since 2019 --comp-months 18`, NAL
  baked in) feeds both runs — no separate grouped path. Freshness decision below.
- **Residual band (honest uncertainty)** = the out-of-time median APE (~11.89%) → underwriting
  low/high reflect real forward error, not a grouped band that understates it.
- **Scope** = 12086, 12011 (current served footprint).

## Failure modes + mitigations
- **Train/serve skew** (predict-frame missing the 4 cols) → the serve-parity fix; predict() fails
  loud as a backstop; verify with a real predict run before promote.
- **Condo / segment regression** → per-segment APE gate; do NOT promote if condo or any large ZIP
  regresses materially vs v1. (NAL helps SFR most; condo eff-age is sparser.)
- **`effectiveAgeYears` as-of skew** (train saleYear vs serve currentYear, ~1–2yr) → negligible on a
  0–100+yr feature; same as-of handling as `ageYears`/`saleMonth`. Accept + note.
- **1.5M re-score churn** → reversible (re-apply prior promoted model); founder-gated; chunk 150k
  (Railway proxy rule); `--dry-run` + spot-check first.
- **Mis-gating on v1's 9.72%** → that figure is grouped on the leaky ±90d frame; gate on out-of-time
  only (incumbent ~12.6%), per Design. Treat `beatsBaseline` (assessed-ratio) as a floor, not the gate.
- **Two promoted `avm-v1` versions** → underwriting/`/api/properties` resolve "the promoted avm-v1";
  if `register-model-version --promote` doesn't demote the incumbent, the read is ambiguous. Verify
  demote-on-promote before step 8 (apply uses an explicit `--model-version-id`, so apply itself is safe).

## Test plan
1. `train_avm.py --self-test` (stdlib).
2. `tsc --noEmit` after the serve-exporter edit.
3. Export frame → sane row count + neighborhood-comp coverage %.
4. Gate run (temporal, recency-24mo, holdout-since 2025-06) → out-of-time `medianAPE` < incumbent
   v1 out-of-time (~12.6%) AND < the 12.62% Arm-C-control (expect ~11.89%) AND `beatsBaseline`
   (assessed-ratio ~32% out-of-time, a floor) AND no large ZIP/segment (SFR/condo) regression vs control.
5. Confirm `metrics.json.featureList` = the 20 features incl. the 4 NAL — this is what the predict
   frame must match exactly.
6. **Predict run completes with no missing-column error** (proves serve parity).
7. `apply-avm.ts --dry-run` → spot-check 5–10 parcels (new vs old valuation plausible) → apply.
8. Underwriting ARV-prior card reads the new estimate + band; `/api/properties` unaffected.

## Ordered steps
1. **Branch/commit**: keep the probate feature UNCOMMITTED (option B). Stay on the current branch
   (Phase 0 `c893582` already lives here) — the serve-parity edit is the only new commit; the probate
   changes ride along uncommitted.
2. **Serve-parity code**: edit `export-predict-features.ts` (+`LEFT JOIN Parcel` +4 cols, names/units
   matching training). `tsc --noEmit`. (Commit after step 7 proves parity.)
3. **Export ONE deep frame**: `export-avm-training.ts --metros 12086,12011 --since 2019-01-01
   --comp-months 18 --batch 8000 --out out/avm-frame-refresh.csv` (NAL baked in).
4. **Gate run**: `train_avm.py --temporal --recency-months 24 --holdout-since 2025-06 --train
   out/avm-frame-refresh.csv --out-dir out/model-gate`. Read the gate (Test-plan #4). STOP if it
   fails or any segment regresses.
5. **Serving model** (freshness decision): reuse `out/model-gate/model.txt` (validated, ~1yr stale)
   OR `train_avm.py --temporal --recency-months 24 --train out/avm-frame-refresh.csv
   --out-dir out/model-serve` (no holdout → latest 24mo). featureList must match step 4.
6. **Register + promote**: `register-model-version.ts --metrics out/model-gate/metrics.json
   --promote --notes "AVM refresh: Phase0 NAL + ArmC trailing-18mo"`. **Pre-promote: verify the
   registry demotes the incumbent avm-v1 (only one promoted).**
7. **Predict**: `export-predict-features.ts --metros 12086,12011 --out out/predict-frame.csv` →
   `train_avm.py --predict --model out/model-serve/model.txt --features out/predict-frame.csv
   --out out/predict-refresh.csv`. **Must complete with no missing-column error (proves parity).**
   Then commit the serve-parity edit.
8. **Re-score (FOUNDER GATE)**: `apply-avm.ts --predictions out/predict-refresh.csv
   --model-version-id <id> --band <out-of-time APE from step 4> --chunk 150000` (after `--dry-run`).
9. **Verify** + update roadmap Direction Log and `scripts/ml/avm/README.md`.

## Open decisions for the founder
- **Serving freshness**: no-holdout temporal retrain on the latest 24mo (recommended — freshest;
  metrics + band still taken from the gate run) vs. reuse the gate `model.txt` (~1yr stale, fully
  consistent). Same Arm-C + NAL recipe either way.
- **Go/no-go on the 1.5M re-score** (step 8) — the deliberate churn you previously deferred.
