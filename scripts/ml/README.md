# ML training loop — M2.3 foundations / M2.4 propensity v1

Contract: `docs/roadmap/SCORING-ARCHITECTURE.md` (two-tier learned scoring).
Architecture invariant #4: **batch, not online** — export TS → train Python →
apply TS → PG. No model server.

```
TaxDelinquencySummary × ParcelSale × Parcel
        │  export-training-data.ts            (TS, raw SQL, keyset-paginated)
        ▼
training-frame.csv          one row per (delinquent parcel, quarter-at-risk)
        │  train_propensity.py                (Python: LightGBM + isotonic)
        ▼
model.txt + calibration.json + metrics.json + predictions.csv
        │  eval gates (below) → ModelVersion row → promote
        │  apply-predictions.ts               (TS, chunked raw-SQL UPDATEs)
        ▼
TaxDelinquencySummary.propensity12mo (+ propensityModelVersionId provenance)
```

## Prerequisites (one-time)

1. Apply `prisma/schema.patch.ml.prisma` to `prisma/schema.prisma`
   (3 new models + 2 columns on TaxDelinquencySummary), then
   `npx prisma db push` (NEVER `migrate dev`) and `npx prisma generate`.
2. Python deps: `pip install -r scripts/ml/requirements.txt` (Python 3.11).
   `python scripts/ml/train_propensity.py --self-test` runs on bare stdlib.

## The loop

### 1. Export

```bash
DATABASE_URL=... npx tsx scripts/ml/export-training-data.ts \
  --metros 12031,12086 \
  --out scripts/ml/out/training-frame.csv
# Smoke first: add --limit 5000. Flags: --label-start (default 2024-01-01,
# the ParcelSale coverage floor until M2.7 SDF backfill), --max-quarters 20,
# --batch 2000.
```

Sanity-check the printed base rate: a healthy frame is low-single-digit %
positives per quarter. ~0% → label join broken; >20% → at-risk window bug.
(Miami-Dade smoke 2026-06-10: 500 parcels → 1,964 rows, 0.65%/quarter.)

**Data reality (2026-06-10):** counties whose delinquency capture starts at
tax year 2025 — all of Duval — have onset 2026-04-01 and therefore ZERO
completed at-risk quarters yet; they contribute ~no rows until quarters
elapse or older certificate years are scraped. Miami-Dade (39K parcels at
earliestYear=2024 → 4 quarters each) and Broward (6K+) are the viable v1
frame; `--metros 12086,12011` is the recommended first training run.

### 2. Train

```bash
python scripts/ml/train_propensity.py \
  --train scripts/ml/out/training-frame.csv \
  --out-dir scripts/ml/out/model-v1
```

Split is grouped by parcel (deterministic hash), isotonic calibration is fit
on a slice of train, all reported numbers are from the untouched holdout.

### 3. Eval gates (SCORING-ARCHITECTURE invariant #2 — ALL must pass)

- **Calibration by decile is sane:** `metrics.json.calibrationByDecile` —
  meanPredicted ≈ observedRate per decile, observedRate roughly monotone.
- **Beats the floor:** `auc > baselineAuc` (assessed-ratio baseline).
- **Beats the incumbent:** `auc` > the promoted ModelVersion's
  `metrics->>'auc'` for the same `modelKey` (skip for the very first version).

### 4. Record the ModelVersion row

```bash
DATABASE_URL=... npx tsx scripts/ml/register-model-version.ts \
  --metrics scripts/ml/out/model-v1/metrics.json \
  --promote --notes "first training run, Miami-Dade+Broward frame"
# --promote ONLY after the step-3 gates pass. It also demotes every other
# version of the same modelKey and refuses to promote over a better incumbent.
```

Or insert metrics.json verbatim by hand (psql):

```sql
SET search_path TO flipops, public;
INSERT INTO "ModelVersion" ("id", "modelKey", "version", "trainedAt", "metrics", "featureList", "promoted", "notes")
VALUES (
  'mv_' || md5(random()::text),          -- or a cuid from app code
  'propensity-v1',
  1,                                      -- next integer for this modelKey
  now(),
  '<metrics.json contents>'::jsonb,
  '<metrics.json featureList array>'::jsonb,
  false,                                  -- promote AFTER gates pass
  'first training run, Duval+Miami-Dade frame'
);
-- Promotion (exactly one promoted version per modelKey — demote first):
UPDATE "ModelVersion" SET "promoted" = false WHERE "modelKey" = 'propensity-v1';
UPDATE "ModelVersion" SET "promoted" = true  WHERE "modelKey" = 'propensity-v1' AND "version" = 1;
```

### 5. Apply

```bash
# LIMIT-test first (11M-row DB, Railway proxy kills long statements —
# the script chunks at 500 rows/statement, but verify before the full run):
DATABASE_URL=... npx tsx scripts/ml/apply-predictions.ts \
  --in scripts/ml/out/model-v1/predictions.csv \
  --model-version <ModelVersion.id> --limit 1000
# then the full run (drop --limit)
```

The script refuses unpromoted versions without `--force`, and exits with
instructions if the schema patch hasn't been pushed.

### 6. Verify in PG

```sql
SELECT COUNT(*) FILTER (WHERE "propensity12mo" IS NOT NULL) AS scored,
       AVG("propensity12mo") AS mean_p, MAX("propensity12mo") AS max_p
FROM flipops."TaxDelinquencySummary";
```

Mean propensity should land near the frame's annualized base rate. All-1.0 or
all-0.0 means calibration or hazard composition broke — do not ship.

## Cadence + rollback

- Retrain monthly or on major data lands (Civitek, M2.7 SDF backfill) —
  SCORING-ARCHITECTURE "Cadence".
- Rollback = re-apply the prior version's predictions.csv (artifacts are kept
  per out-dir) and flip `promoted` back. Scorer v2.1 remains the cold-start /
  regression fallback and is never deleted (invariant #5).

## Files

| File | Role |
|---|---|
| `build-zip-market-stats.ts` | ZipMarketStats mart refresh (single FL-wide UPSERT) |
| `build-parcel-features.ts` | ParcelFeature mart populate (per-county, ~150K/chunk) |
| `export-training-data.ts` | frame export (raw SQL only — runs pre-patch) |
| `train_propensity.py` | LightGBM discrete-time hazard + isotonic + eval |
| `register-model-version.ts` | ModelVersion insert + gated promote/demote |
| `apply-predictions.ts` | chunked UPSERT of propensities (preflight-guarded) |
| `requirements.txt` | Python deps (`--self-test` needs none) |
| `../../prisma/schema.patch.ml.prisma` | ParcelFeature / ZipMarketStats / ModelVersion + TDS columns |

First real run (2026-06-10, ModelVersion `cmq8xlc5u0000mfi8wj3sb93h` = propensity-v1 v1,
promoted): 12086+12011 frame 184,413 rows / 1,135 positives (0.62%/q); holdout AUC
0.8281 vs assessed-ratio baseline 0.5155; calibration monotone (obs 0 → 0.0195 across
deciles); 45,983 propensities applied. Known v1 artifact: isotonic top step saturates
12 parcels at exactly 1.0 (one high-turnover Miami Beach condo building) — revisit with
per-county shrinkage in the full M2.4 build.

Compile check (no generated-model deps, runs pre-patch):

```bash
npx tsc --noEmit --strict --esModuleInterop --skipLibCheck \
  --target es2020 --module commonjs --moduleResolution node \
  scripts/ml/export-training-data.ts scripts/ml/apply-predictions.ts
```
