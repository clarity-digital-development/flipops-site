# AVM v1 — Automated Valuation Model (M3.3)

A versioned, eval-gated estimate of **market value** per parcel. Lives alongside
the M2.4 propensity loop (`scripts/ml/`) and follows the same contract
(`docs/roadmap/SCORING-ARCHITECTURE.md`): every stored estimate carries the
`ModelVersion` that produced it, and a version is `promoted` only after it beats
the assessed-ratio baseline on holdout.

The propensity model answers *"will this distressed parcel sell soon?"*. The AVM
answers *"what is it worth?"* — the ARV/value anchor the Underwriting page and
MAO waterfall need, computed from our own sale comps instead of a dead vendor.

## Pipeline (mirrors `scripts/ml/README.md`)

```
ParcelSale (arms-length) ─┐
ParcelFeature (chars+zip) ─┼─▶ export-avm-training.ts ──▶ avm-frame.csv
                          ┘
avm-frame.csv ──▶ train_avm.py ──▶ model.txt + metrics.json + holdout-eval.csv
metrics.json ──▶ register-model-version.ts (--metrics) ──▶ ModelVersion row
ParcelFeature ──▶ (predict step) ──▶ predictions.csv ──▶ apply-avm.ts ──▶ ParcelValuation
                                                          (DEFERRED — table not pushed)
```

### Step 1 — Export the training frame

```bash
cd flipops-site
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
npx tsx scripts/ml/avm/export-avm-training.ts \
  --metros 12086,12011 \
  --out scripts/ml/avm/out/avm-frame.csv
```

- One row per **arms-length** `ParcelSale` (`qualCode IN ('01','02')` — same
  filter as `/api/comps`), price floor `$20k`, joined to `ParcelFeature`.
- Computes a **distance-weighted neighborhood comp $/sqft** (other same-ZIP
  arms-length sales within ±90 days, inverse-distance weighted by lat/lng) and
  **sale-month seasonality**. The neighborhood comp is leakage-safe: it excludes
  the subject's own APN and only uses same-ZIP neighbors.
- Keyset-paginated on `ParcelSale.id`, county at a time (Railway-proxy rule).
  The county comp pool is built once per page via a `MATERIALIZED` CTE — use a
  large `--batch` (default 1500) to amortize that build.

### Step 2 — Train + eval

```bash
# one-time: python -m venv .venv-ml && .venv-ml/Scripts/pip install -r scripts/ml/requirements.txt
.venv-ml/Scripts/python scripts/ml/avm/train_avm.py \
  --train scripts/ml/avm/out/avm-frame.csv \
  --out-dir scripts/ml/avm/out/model-v1
```

- LightGBM regressor on **log(salePrice)** (relative-error loss — the correct
  objective for value across a 10× price range).
- **Eval = median Absolute Percentage Error (APE)**, overall and **by ZIP**
  (`metrics.json.byZip`). Median APE is the industry-standard AVM accuracy metric
  (Zillow/Redfin publish median error).
- **Baseline to beat = assessed-ratio estimator**: `assessedValue / r` where
  `r = median(assessedValue/salePrice)` on the fit split. This is the
  "assessed-ratio baseline" from SCORING-ARCHITECTURE invariant #2, in price
  space. FL assessed values track market at a stable county ratio, so it is a
  genuinely strong free baseline — the model **must** beat its median APE.
- Stdlib self-test (no deps): `python scripts/ml/avm/train_avm.py --self-test`.

### Step 3 — Eval gate (before promoting)

Promote only if:
1. `metrics.medianAPE < metrics.baselineMedianAPE` (`beatsBaseline: true`).
2. `byZip` is sane — no large ZIP with a wild APE (>0.5) on decent `n`.
3. (retrains only) beats the incumbent promoted `avm-v1` `medianAPE`.

### Step 4 — Register the ModelVersion

```bash
npx tsx scripts/ml/register-model-version.ts \
  --metrics scripts/ml/avm/out/model-v1/metrics.json \
  --promote \
  --notes "AVM v1 first run, Miami-Dade+Broward arms-length 2024-2025"
```

> Reuses the **shared** `register-model-version.ts` — it reads `modelKey` from
> `metrics.json` (`"avm-v1"`) and versions within that key independently of
> `propensity-v1`. The incumbent gate there compares `auc`; for the AVM the
> meaningful gate is `medianAPE` (lower is better) — register WITHOUT `--promote`
> if you want to inspect first, then promote manually after confirming
> `beatsBaseline`. (A follow-up can teach the registry an APE-aware gate; for v1
> the gate is enforced by reading `beatsBaseline` before passing `--promote`.)

### Step 5 — Apply (DEFERRED to the build wave)

`scripts/ml/avm/apply-avm.ts` writes `ParcelValuation`, but that table lives in
`prisma/schema.patch.avm.prisma` and is **not pushed yet**. The script is
`information_schema`-guarded: it no-ops (exit 0) until the patch lands. After the
orchestrator pushes it:

```bash
# (predict step emits predictions.csv: countyFips,apn,estimatedValue)
npx tsx scripts/ml/avm/apply-avm.ts \
  --predictions scripts/ml/avm/out/model-v1/predictions.csv \
  --model-version-id <ModelVersion.id> \
  --band <metrics.residualBandPct> \
  --chunk 150000        # OPERATIONS.md: chunk big UPDATEs, proxy kills silent statements
```

It refuses to write from an unpromoted `ModelVersion` (invariant #2) and UPSERTs
on `(countyFips, apn)`. `low/high` estimate default to `pred × (1 ∓ band)` where
`band = metrics.residualBandPct` (holdout median APE — honest data-driven
uncertainty) when the predictions CSV omits explicit bounds.

## Files

| File | Role |
|------|------|
| `prisma/schema.patch.avm.prisma` | `ParcelValuation` model (NOT pushed — orchestrator reviews) |
| `export-avm-training.ts` | arms-length sale frame export (raw SQL, keyset-paginated) |
| `train_avm.py` | LightGBM log-price regressor + median-APE-vs-baseline eval |
| `apply-avm.ts` | guarded chunked UPSERT to `ParcelValuation` (deferred) |
| `out/` | gitignore'd artifacts (frame, model, metrics, predictions) |

## Honest note on expected improvement (OPS-7)

`ParcelSale` currently spans **2024-01 → 2025-12** — a ~2-year cross-section.
That is fine for a value model (an AVM is cross-sectional; it does not need long
history the way the propensity hazard does), and Miami-Dade + Broward each
contribute ~58k arms-length sales that join a `ParcelFeature` row, so v1 trains
on a real, sizeable frame.

The known weaknesses, and how **OPS-7 (SDF sale-history backfill to ~2009)**
fixes them:

- **Thin/old comps in slow ZIPs.** The neighborhood-comp feature uses a ±90-day
  window; in low-turnover ZIPs few comps fall in-window, so the model leans on
  the ZIP aggregate instead. Deeper history → more in-window comps → tighter
  per-ZIP APE, especially in the long tail of small ZIPs.
- **No time-adjustment / seasonality depth.** With only 2 years, `saleMonth`
  captures intra-year seasonality but not multi-year price trend. Backfilled
  history lets a future version add a proper time-of-sale price index
  (HPI-style) and report APE on a true out-of-time holdout, not just grouped
  out-of-parcel.
- **Tail coverage.** Unusual property types and luxury/teardown segments are
  sparsely sampled in 2 years; more history shrinks their variance.

Expected effect when OPS-7 lands: a modest but real median-APE improvement
(comps deepen, time-trend becomes learnable) — **re-run steps 1–4 and let the
eval gate decide whether v2 promotes over v1.** Do not hand-wave a number;
the gate is the source of truth.
