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

## AVM v2 — the SDF deep-history retrain (NEGATIVE RESULT, 2026-06-13)

After the M2.7 SDF backfill deepened `ParcelSale` to **2009 → 2026** (~18.7M
rows), we ran the prescribed temporal retrain to test the OPS-7 hypothesis that
deeper history improves the AVM. **It does not.** The eval gate did its job:
v2 was not promoted; **v1 (recency-only) remains the production model.**

### What we built (kept — reusable infra)

- `export-avm-training.ts --since YYYY-MM-DD` windows the frame; the comp pool
  is now a **once-per-county indexed staging table** (`flipops."_AvmCompPool"`)
  instead of a per-page re-`MATERIALIZE` — ~**50× faster** (485k rows in ~6 min
  vs the old ~3 h/county). `--comp-months N` switches the neighborhood-comp
  window from the legacy **±90d symmetric** to a **trailing-N-month** window
  (leakage-safe + direction-matched to serving).
- `train_avm.py --temporal` adds a per-county **HPI monthly $/sqft index** (built
  from train rows only), **time-adjusts** price + comp $/sqft to an as-of month,
  and evaluates on an **out-of-time + out-of-parcel** holdout. `--adjust`,
  `--recency-months N`, `--min-month-n N` select the arm. Index math is
  unit-tested in `--self-test`.
- `compare_holdout.py` / `probe-temporal.ts` — per-ZIP tail diff + volume probe.

### The experiment (3 arms, identical holdout)

Metros 12086 + 12011, window 2019+, out-of-time + out-of-parcel holdout =
arms-length sales on/after **2025-06** whose parcel is unseen in train
(**n = 11,396**, large enough that median-APE noise is «1%). Leak-free frame
(trailing-18mo comps, matching the serving exporter exactly).

| Arm | Recipe | Out-of-time median APE |
|-----|--------|------------------------|
| **C — control** | recency 24mo, no adjustment (= v1's recipe) | **0.1262 (best)** |
| B — naive | full 2019+ history, no adjustment | 0.1269 |
| A — v2-adjusted | full 2019+ history, HPI time-adjusted | 0.1320 |
| baseline | assessed-ratio (`assessed / r`) | ~0.3215 |

**Findings.** (1) Recency-only wins; deeper history adds noise, not signal — the
recent 24mo cross-section already covers the present-value surface. (2) HPI
time-adjustment **hurts** (a county-level index applies one factor across
segments that appreciated differently → multiplicative noise on old rows). (3)
The earlier "deep history helps thin ZIPs" signal was a **leakage artifact** of
the legacy **±90d symmetric** comp window (a near-cutoff train row's window
reached forward into holdout sales); on the leak-free frame the thin-ZIP edge
vanishes. (4) The assessed-ratio baseline collapses to ~32% on this holdout
because out-of-parcel selection favors long-held, **homestead-capped** parcels
whose assessed value badly understates market — a real Save-Our-Homes effect.

### Honest accuracy number

v1's headline **9.72% median APE is the grouped-by-parcel holdout** (random
parcels, same period — *interpolation* accuracy). The **out-of-time forward**
accuracy — value a sale we couldn't have seen, on a parcel we've never seen — is
**~12.6%**. Both are legitimate and both are reported by commercial AVMs; the
out-of-time figure is the conservative, DD-proof one. Prefer it (or present
both) in any external accuracy claim.

### Known limitation this surfaced (v1, not introduced by v2)

v1 trains the comp feature on a **±90d symmetric** window but is *served* against
the predict exporter's **trailing-18mo** window — a real train/serve direction
skew. Arm **C** (recency-24mo + trailing-18mo comps) is the skew-fixed model and
is drop-in (same 16-feature list; serving pipeline already trailing-18mo). It is
**ready** if/when a deliberate AVM refresh re-scores `ParcelValuation`; deferred
on its own to avoid churning 1.5M live valuations for an unmeasured-magnitude
gain.

### Reproduce

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
npx tsx scripts/ml/avm/export-avm-training.ts --metros 12086,12011 \
  --since 2019-01-01 --comp-months 18 --batch 8000 --out scripts/ml/avm/out/avm-frame-v2c.csv
P=.venv-ml/Scripts/python
$P scripts/ml/avm/train_avm.py --temporal --adjust          --train ...avm-frame-v2c.csv --holdout-since 2025-06 --out-dir ...model-v2c-adjusted
$P scripts/ml/avm/train_avm.py --temporal                   --train ...avm-frame-v2c.csv --holdout-since 2025-06 --out-dir ...model-v2c-naive
$P scripts/ml/avm/train_avm.py --temporal --recency-months 24 --train ...avm-frame-v2c.csv --holdout-since 2025-06 --out-dir ...model-v2c-control
$P scripts/ml/avm/compare_holdout.py --a ...control/holdout-eval.csv --a-label control --b ...adjusted/holdout-eval.csv --b-label v2adj
```
