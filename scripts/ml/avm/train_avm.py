#!/usr/bin/env python3
"""M3.3 AVM v1 — LightGBM price regressor on log(salePrice), eval = median APE.

Trains on the frame produced by export-avm-training.ts (one row per
arms-length ParcelSale) and writes:

    <out-dir>/model.txt          LightGBM booster (text format)
    <out-dir>/metrics.json       median APE overall + by ZIP, the assessed-ratio
                                 baseline APE, residual band, feature list
                                 (feed verbatim into the ModelVersion row —
                                  see scripts/ml/avm/README.md step 4)
    <out-dir>/holdout-eval.csv   per-holdout-sale actual/predicted/APE

Usage:
    python scripts/ml/avm/train_avm.py \
        --train scripts/ml/avm/out/avm-frame.csv --out-dir scripts/ml/avm/out/model-v1

    python scripts/ml/avm/train_avm.py --self-test   # stdlib only, no deps

Modeling notes (SCORING-ARCHITECTURE — versioned, eval-gated):
  * Target is log(salePrice). LightGBM minimises L2 on the log, which is
    equivalent to relative (percentage) error in price space — the right loss
    for an AVM where a $50k miss on a $2M home ≠ a $50k miss on a $150k home.
  * Eval metric = median Absolute Percentage Error (APE) = median(|pred-actual|
    / actual), reported OVERALL and BY ZIP. Median (not mean) APE is the
    industry-standard AVM accuracy metric (Zillow/Redfin publish median error)
    — robust to the heavy tail of unusual sales.
  * BASELINE (the floor v1 must beat to promote): the assessed-ratio estimator.
    Pred_baseline = assessedValue / r, where r = median(assessedValue/salePrice)
    on the FIT split (FL assessed values track market at a stable county ratio,
    so this is a genuinely strong, free baseline — exactly the "assessed-ratio
    baseline" named in SCORING-ARCHITECTURE invariant #2, here in price space).
    Promote ONLY if model median APE < baseline median APE (overall).
  * Split is GROUPED by (countyFips, apn) — a parcel's multiple sales must never
    straddle train/holdout, or the neighborhood-comp feature leaks the holdout.
  * residualBandPct = median APE on holdout → apply-avm.ts uses it to set
    low/high estimate = pred * (1 ∓ band). Honest, data-driven uncertainty.

Heavy deps (pandas/lightgbm/numpy — see ../requirements.txt) are imported
lazily inside train() so --self-test runs on a bare Python 3.11.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import random
import sys
from datetime import datetime, timezone

TARGET_COL = "salePrice"
ID_COLS = ["countyFips", "apn", "saleId", "saleDate"]
CATEGORICAL_COLS = ["countyFips", "propertyType", "situsZip", "saleMonth"]
# Columns that are references/identifiers, never model features:
#   salePrice  -> target (log)
#   assessedValue/marketValue -> baseline only (assessedValue would leak; it is
#     derived from the same appraisal that anchors many sales)
NON_FEATURE_COLS = set(ID_COLS) | {TARGET_COL, "assessedValue", "marketValue"}


# --------------------------------------------------------------------------
# Pure-stdlib helpers (unit-tested by --self-test; reused by the real path)
# --------------------------------------------------------------------------

def median(xs: list[float]) -> float:
    """Median of a list. NaN on empty (callers guard)."""
    s = sorted(x for x in xs if x is not None and not _isnan(x))
    n = len(s)
    if n == 0:
        return float("nan")
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def _isnan(x: float) -> bool:
    return isinstance(x, float) and math.isnan(x)


def ape(pred: float, actual: float) -> float:
    """Absolute percentage error |pred-actual|/actual. NaN when actual<=0."""
    if actual is None or actual <= 0 or pred is None or _isnan(pred):
        return float("nan")
    return abs(pred - actual) / actual


def median_ape(pairs: list[tuple[float, float]]) -> float:
    """Median APE over (pred, actual) pairs, skipping non-finite."""
    vals = [ape(p, a) for p, a in pairs]
    vals = [v for v in vals if not _isnan(v)]
    return median(vals)


def ape_by_zip(rows: list[tuple[str, float, float]]) -> list[dict]:
    """rows = (zip, pred, actual). Median APE + n per ZIP, sorted by n desc."""
    buckets: dict[str, list[tuple[float, float]]] = {}
    for z, p, a in rows:
        buckets.setdefault(z or "UNKNOWN", []).append((p, a))
    out = []
    for z, pairs in buckets.items():
        out.append({"zip": z, "medianAPE": median_ape(pairs), "n": len(pairs)})
    out.sort(key=lambda d: d["n"], reverse=True)
    return out


def assessed_ratio_baseline(
    fit_assessed: list[tuple[float, float]],
    holdout: list[tuple[float, float, float]],
) -> tuple[float, list[tuple[float, float]]]:
    """Fit the county assessed/sale ratio on FIT, predict price on HOLDOUT.

    fit_assessed = (assessedValue, salePrice) on the fit split.
    holdout      = (assessedValue, salePrice, _placeholder) on holdout.
    Returns (ratio, [(pred, actual)]). ratio = median(assessed/sale).
    """
    ratios = [a / p for a, p in fit_assessed if a and p and p > 0 and a > 0]
    r = median(ratios)
    preds: list[tuple[float, float]] = []
    if _isnan(r) or r <= 0:
        return r, preds
    for assessed, sale, _ in holdout:
        if assessed and assessed > 0 and sale and sale > 0:
            preds.append((assessed / r, sale))
    return r, preds


def stable_group_split(county: str, apn: str, holdout_frac: float, seed: int) -> bool:
    """True → holdout. Deterministic per parcel so retrains are comparable."""
    h = hashlib.sha256(f"{seed}:{county}:{apn}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 2**32 < holdout_frac


# --------------------------------------------------------------------------
# Real training path (pandas / lightgbm / numpy — ../requirements.txt)
# --------------------------------------------------------------------------

def train(args: argparse.Namespace) -> None:
    import numpy as np
    import pandas as pd
    import lightgbm as lgb

    df = pd.read_csv(args.train, dtype={"apn": str, "situsZip": str, "countyFips": str})
    if TARGET_COL not in df.columns:
        sys.exit(f"--train CSV missing target column {TARGET_COL!r}")
    df = df[df[TARGET_COL] > 0].copy()
    if df.empty:
        sys.exit("[avm-train] no rows with salePrice > 0 — empty frame")

    # Postgres booleans export as "true"/"false" → numeric (NaN = NULL).
    skip = set(CATEGORICAL_COLS) | NON_FEATURE_COLS
    for c in df.columns:
        if c not in skip and df[c].dtype == object:
            df[c] = df[c].map(
                {"true": 1.0, "false": 0.0, "t": 1.0, "f": 0.0}
            ).astype(float)

    # saleMonth is a small-cardinality categorical (seasonality), keep as string
    if "saleMonth" in df.columns:
        df["saleMonth"] = df["saleMonth"].astype("Int64").astype(str)

    feature_cols = [c for c in df.columns if c not in NON_FEATURE_COLS]
    for c in CATEGORICAL_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    y_log = np.log(df[TARGET_COL].to_numpy(dtype=float))

    holdout_mask = df.apply(
        lambda r: stable_group_split(
            str(r["countyFips"]), str(r["apn"]), args.holdout_frac, args.seed
        ),
        axis=1,
    ).to_numpy()
    fit_mask = ~holdout_mask

    X_fit = df.loc[fit_mask, feature_cols]
    X_hold = df.loc[holdout_mask, feature_cols]
    yfit, yhold = y_log[fit_mask], y_log[holdout_mask]
    print(
        f"[avm-train] fit={len(X_fit)} holdout={len(X_hold)} "
        f"features={len(feature_cols)} median_price={df[TARGET_COL].median():,.0f}"
    )

    params = {
        "objective": "regression_l2",
        "metric": "l2",
        "learning_rate": 0.03,
        "num_leaves": 63,
        "min_data_in_leaf": 100,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "verbosity": -1,
        "seed": args.seed,
    }
    # Small internal validation slice (deterministic) for early stopping.
    val_mask = np.array(
        [
            stable_group_split(str(c), str(a), 0.15, args.seed + 7)
            for c, a in zip(df.loc[fit_mask, "countyFips"], df.loc[fit_mask, "apn"])
        ]
    )
    booster = lgb.train(
        params,
        lgb.Dataset(X_fit[~val_mask], label=yfit[~val_mask]),
        num_boost_round=3000,
        valid_sets=[lgb.Dataset(X_fit[val_mask], label=yfit[val_mask])],
        callbacks=[lgb.early_stopping(120, verbose=False)],
    )

    # Holdout eval (back-transform from log to price space).
    pred_log = booster.predict(X_hold, num_iteration=booster.best_iteration)
    pred_price = np.exp(pred_log)
    actual = df.loc[holdout_mask, TARGET_COL].to_numpy(dtype=float)
    zips = df.loc[holdout_mask, "situsZip"].astype(str).to_numpy()

    model_pairs = list(zip(pred_price.tolist(), actual.tolist()))
    model_median_ape = median_ape(model_pairs)
    by_zip = ape_by_zip(list(zip(zips.tolist(), pred_price.tolist(), actual.tolist())))

    # Assessed-ratio baseline (the floor to beat).
    fit_assessed = list(
        zip(
            df.loc[fit_mask, "assessedValue"].fillna(0).tolist(),
            df.loc[fit_mask, TARGET_COL].tolist(),
        )
    )
    hold_assessed = list(
        zip(
            df.loc[holdout_mask, "assessedValue"].fillna(0).tolist(),
            df.loc[holdout_mask, TARGET_COL].tolist(),
            [0.0] * int(holdout_mask.sum()),
        )
    )
    ratio, base_pairs = assessed_ratio_baseline(fit_assessed, hold_assessed)
    baseline_median_ape = median_ape(base_pairs) if base_pairs else float("nan")

    beats = (
        not _isnan(model_median_ape)
        and (_isnan(baseline_median_ape) or model_median_ape < baseline_median_ape)
    )

    os.makedirs(args.out_dir, exist_ok=True)
    booster.save_model(
        os.path.join(args.out_dir, "model.txt"), num_iteration=booster.best_iteration
    )

    metrics = {
        "modelKey": "avm-v1",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "medianAPE": _finite(model_median_ape),
        "baselineMedianAPE": _finite(baseline_median_ape),
        "beatsBaseline": bool(beats),
        "assessedRatio": _finite(ratio),
        # residualBandPct: serving uncertainty band = holdout median APE.
        "residualBandPct": _finite(model_median_ape),
        "byZip": [
            {"zip": _safe_zip(d["zip"]), "medianAPE": _finite(d["medianAPE"]), "n": d["n"]}
            for d in by_zip
        ],
        "nFitRows": int(len(X_fit)),
        "nHoldoutRows": int(len(X_hold)),
        "bestIteration": int(booster.best_iteration or 0),
        "params": params,
        "metros": sorted(df["countyFips"].astype(str).unique().tolist()),
        "trainCsv": os.path.abspath(args.train),
    }
    with open(os.path.join(args.out_dir, "metrics.json"), "w") as f:
        # allow_nan=False → never emit bare NaN/Infinity (invalid JSON that
        # register-model-version.ts' JSON.parse rejects). _finite/_safe_zip
        # already scrub values, this is the belt-and-suspenders guard.
        json.dump({**metrics, "featureList": feature_cols}, f, indent=2, allow_nan=False)

    # Per-holdout-sale eval dump (debugging / audit).
    with open(os.path.join(args.out_dir, "holdout-eval.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["countyFips", "apn", "situsZip", "actual", "predicted", "ape"])
        apns = df.loc[holdout_mask, "apn"].astype(str).to_numpy()
        cfips = df.loc[holdout_mask, "countyFips"].astype(str).to_numpy()
        for i in range(len(actual)):
            w.writerow(
                [
                    cfips[i],
                    apns[i],
                    zips[i],
                    f"{actual[i]:.0f}",
                    f"{pred_price[i]:.0f}",
                    f"{ape(pred_price[i], actual[i]):.4f}",
                ]
            )

    print(
        f"[avm-train] holdout median APE={model_median_ape:.4f}  "
        f"baseline(assessed-ratio) median APE={baseline_median_ape:.4f}  "
        f"beats={beats}"
    )
    print(f"[avm-train] assessed/sale ratio={ratio:.4f}  band+/-={model_median_ape*100:.1f}%")
    print(f"[avm-train] top ZIPs by sample (model median APE):")
    for d in by_zip[:10]:
        print(f"  {d['zip']:>7}  APE={d['medianAPE']:.4f}  n={d['n']}")
    print(f"[avm-train] artifacts -> {args.out_dir}")


def _finite(x: float):
    """JSON can't hold NaN/inf — emit null instead."""
    return None if (x is None or _isnan(x) or math.isinf(x)) else float(x)


def _safe_zip(z) -> str:
    """ZIP keys that are NaN/None (rows with null situsZip stringify to 'nan')
    become a stable 'UNKNOWN' label so json.dump never emits a bare NaN token."""
    s = str(z)
    return "UNKNOWN" if s in ("nan", "None", "NaN", "") else s


# --------------------------------------------------------------------------
# --self-test: stdlib-only checks of the math the loop depends on
# --------------------------------------------------------------------------

def self_test() -> None:
    # 1. median
    assert median([3, 1, 2]) == 2
    assert median([4, 1, 2, 3]) == 2.5
    assert _isnan(median([]))

    # 2. ape / median_ape
    assert abs(ape(110, 100) - 0.1) < 1e-12
    assert abs(ape(90, 100) - 0.1) < 1e-12
    assert _isnan(ape(100, 0))
    perfect = [(100.0, 100.0)] * 20
    assert abs(median_ape(perfect)) < 1e-12
    mixed = [(110.0, 100.0), (90.0, 100.0), (100.0, 100.0)]
    assert abs(median_ape(mixed) - 0.1) < 1e-12  # median of {0.1,0.1,0}

    # 3. ape_by_zip partitions and computes per-zip
    rows = [("A", 110, 100), ("A", 90, 100), ("B", 200, 100)]
    tbl = ape_by_zip(rows)
    assert sum(d["n"] for d in tbl) == 3
    a = next(d for d in tbl if d["zip"] == "A")
    b = next(d for d in tbl if d["zip"] == "B")
    assert abs(a["medianAPE"] - 0.1) < 1e-12
    assert abs(b["medianAPE"] - 1.0) < 1e-12

    # 4. assessed-ratio baseline recovers a clean ratio and predicts
    #    fit: assessed is always 0.8 * sale → ratio 0.8 → perfect holdout preds
    fit = [(80.0, 100.0), (160.0, 200.0), (240.0, 300.0)]
    hold = [(400.0, 500.0, 0.0), (800.0, 1000.0, 0.0)]
    r, preds = assessed_ratio_baseline(fit, hold)
    assert abs(r - 0.8) < 1e-12, r
    assert abs(median_ape(preds)) < 1e-9  # assessed/0.8 == sale exactly

    # 5. group split: deterministic + roughly the requested fraction
    flags = [stable_group_split("12086", f"apn{i}", 0.2, 7) for i in range(20000)]
    frac = sum(flags) / len(flags)
    assert 0.18 < frac < 0.22, frac
    assert flags == [stable_group_split("12086", f"apn{i}", 0.2, 7) for i in range(20000)]

    # 6. _finite scrubs NaN/inf
    assert _finite(float("nan")) is None
    assert _finite(float("inf")) is None
    assert _finite(0.5) == 0.5

    print("[self-test] all stdlib checks passed")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--train", help="avm-frame CSV from export-avm-training.ts")
    ap.add_argument("--out-dir", default="scripts/ml/avm/out/model-v1")
    ap.add_argument("--holdout-frac", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument(
        "--self-test",
        action="store_true",
        help="run stdlib-only sanity checks and exit (no deps needed)",
    )
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.train:
        ap.error("--train is required (or use --self-test)")
    train(args)


if __name__ == "__main__":
    main()
