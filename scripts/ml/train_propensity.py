#!/usr/bin/env python3
"""M2.4 Layer-1 propensity model — discrete-time hazard, LightGBM, isotonic.

Trains on the frame produced by export-training-data.ts (one row per
(delinquent parcel, quarter-at-risk), label = soldThisQuarter) and writes:

    <out-dir>/model.txt          LightGBM booster (text format)
    <out-dir>/calibration.json   isotonic step function {x: [...], y: [...]}
    <out-dir>/metrics.json       AUC + calibration-by-decile + feature list
                                 (feed this verbatim into the ModelVersion row
                                  — see scripts/ml/README.md step 4)
    <out-dir>/predictions.csv    per-parcel calibrated P(sale within 12mo)
                                 (countyFips, apn, propensity12mo) — input to
                                 apply-predictions.ts

Usage:
    python scripts/ml/train_propensity.py \
        --train scripts/ml/out/training-frame.csv --out-dir scripts/ml/out/model-v1

    python scripts/ml/train_propensity.py --self-test   # stdlib only, no deps

Modeling notes (SCORING-ARCHITECTURE Layer 1):
  * Discrete-time hazard: the binary classifier learns h(q) = P(sale in
    quarter q | at risk at q). 12-month propensity for a parcel currently at
    quarter k since onset is 1 - prod_{j=1..4} (1 - h(k + j)).
  * Split is GROUPED by (countyFips, apn) — a parcel's quarters must never
    straddle train/holdout or AUC is inflated by parcel memorization.
  * Calibration: isotonic regression fit on a calibration slice of train,
    evaluated on the untouched holdout (predicted vs observed by decile).
  * Per-county hierarchical effects (Glades-vs-Miami-Dade shrinkage) are
    deferred to the full M2.4 build; v1 passes countyFips as a categorical
    and relies on LightGBM's min_data_in_leaf to avoid small-county overfit.
  * Eval gate (invariant #2): promote only if holdout AUC beats BOTH the
    incumbent ModelVersion and the assessed-ratio baseline reported in
    metrics.json["baselineAuc"].

Heavy deps (pandas/lightgbm/sklearn — see requirements.txt) are imported
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

LABEL_COL = "soldThisQuarter"
ID_COLS = ["countyFips", "apn", "quarterStart"]
CATEGORICAL_COLS = ["countyFips", "propertyType", "situsZip"]
# Everything else in the frame is a numeric feature. Keep ordering stable:
# metrics.json["featureList"] is the serving contract (ModelVersion.featureList).
HORIZON_QUARTERS = 4  # 12 months


# --------------------------------------------------------------------------
# Pure-stdlib helpers (unit-tested by --self-test; reused by the real path)
# --------------------------------------------------------------------------

def propensity_from_hazards(hazards: list[float]) -> float:
    """P(event within the horizon) from per-quarter hazards: 1 - prod(1-h)."""
    surv = 1.0
    for h in hazards:
        if not 0.0 <= h <= 1.0:
            raise ValueError(f"hazard out of [0,1]: {h}")
        surv *= 1.0 - h
    return 1.0 - surv


def rank_auc(pairs: list[tuple[float, int]]) -> float:
    """ROC AUC via the rank-sum (Mann-Whitney) formula. pairs = (score, label)."""
    pos = sum(1 for _, y in pairs if y == 1)
    neg = len(pairs) - pos
    if pos == 0 or neg == 0:
        return float("nan")
    ranked = sorted(pairs, key=lambda p: p[0])
    # average ranks for ties
    rank_sum_pos = 0.0
    i = 0
    while i < len(ranked):
        j = i
        while j + 1 < len(ranked) and ranked[j + 1][0] == ranked[i][0]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1.0  # 1-based
        for k in range(i, j + 1):
            if ranked[k][1] == 1:
                rank_sum_pos += avg_rank
        i = j + 1
    return (rank_sum_pos - pos * (pos + 1) / 2.0) / (pos * neg)


def decile_table(pairs: list[tuple[float, int]]) -> list[dict]:
    """Calibration by decile: sort by predicted, split in 10, compare means."""
    if not pairs:
        return []
    ranked = sorted(pairs, key=lambda p: p[0])
    n = len(ranked)
    out = []
    for d in range(10):
        lo, hi = (d * n) // 10, ((d + 1) * n) // 10
        chunk = ranked[lo:hi]
        if not chunk:
            continue
        out.append(
            {
                "decile": d + 1,
                "meanPredicted": sum(p for p, _ in chunk) / len(chunk),
                "observedRate": sum(y for _, y in chunk) / len(chunk),
                "n": len(chunk),
            }
        )
    return out


def stable_group_split(county: str, apn: str, holdout_frac: float, seed: int) -> bool:
    """True → holdout. Deterministic per parcel so retrains are comparable."""
    h = hashlib.sha256(f"{seed}:{county}:{apn}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 2**32 < holdout_frac


# --------------------------------------------------------------------------
# Real training path (pandas / lightgbm / sklearn — requirements.txt)
# --------------------------------------------------------------------------

def train(args: argparse.Namespace) -> None:
    import pandas as pd  # lazy: keeps --self-test stdlib-only
    import lightgbm as lgb
    from sklearn.isotonic import IsotonicRegression

    df = pd.read_csv(args.train)
    if LABEL_COL not in df.columns:
        sys.exit(f"--train CSV missing label column {LABEL_COL!r}")

    feature_cols = [c for c in df.columns if c not in {LABEL_COL, "quarterStart"} ]
    # countyFips/apn stay out of the matrix except countyFips-as-categorical;
    # apn is an identifier, never a feature.
    feature_cols = [c for c in feature_cols if c != "apn"]
    for c in CATEGORICAL_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    holdout_mask = df.apply(
        lambda r: stable_group_split(str(r["countyFips"]), str(r["apn"]), args.holdout_frac, args.seed),
        axis=1,
    )
    # carve a calibration slice out of TRAIN (never the holdout)
    cal_mask = ~holdout_mask & df.apply(
        lambda r: stable_group_split(str(r["countyFips"]), str(r["apn"]), args.cal_frac, args.seed + 1),
        axis=1,
    )
    fit_mask = ~holdout_mask & ~cal_mask

    X_fit, y_fit = df.loc[fit_mask, feature_cols], df.loc[fit_mask, LABEL_COL]
    X_cal, y_cal = df.loc[cal_mask, feature_cols], df.loc[cal_mask, LABEL_COL]
    X_hold, y_hold = df.loc[holdout_mask, feature_cols], df.loc[holdout_mask, LABEL_COL]
    print(f"[train] fit={len(X_fit)} cal={len(X_cal)} holdout={len(X_hold)} "
          f"base_rate={df[LABEL_COL].mean():.4f}")

    params = {
        "objective": "binary",
        "metric": "auc",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 200,  # small-county overfit guard (see header)
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "verbosity": -1,
        "seed": args.seed,
    }
    booster = lgb.train(
        params,
        lgb.Dataset(X_fit, label=y_fit),
        num_boost_round=2000,
        valid_sets=[lgb.Dataset(X_cal, label=y_cal)],
        callbacks=[lgb.early_stopping(100, verbose=False)],
    )

    # Isotonic calibration on the calibration slice
    raw_cal = booster.predict(X_cal, num_iteration=booster.best_iteration)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(raw_cal, y_cal)

    # Holdout eval (calibrated)
    raw_hold = booster.predict(X_hold, num_iteration=booster.best_iteration)
    cal_hold = iso.predict(raw_hold)
    pairs = list(zip((float(p) for p in cal_hold), (int(y) for y in y_hold)))
    auc = rank_auc(pairs)
    deciles = decile_table(pairs)

    # Floor baseline (invariant #2): assessed/market ratio as the only score.
    baseline_auc = float("nan")
    if "assessedToMarketRatio" in df.columns:
        base = df.loc[holdout_mask, ["assessedToMarketRatio", LABEL_COL]].dropna()
        baseline_auc = rank_auc(list(zip(base["assessedToMarketRatio"].astype(float),
                                         base[LABEL_COL].astype(int))))

    os.makedirs(args.out_dir, exist_ok=True)
    booster.save_model(os.path.join(args.out_dir, "model.txt"),
                       num_iteration=booster.best_iteration)
    with open(os.path.join(args.out_dir, "calibration.json"), "w") as f:
        json.dump({"x": [float(v) for v in iso.X_thresholds_],
                   "y": [float(v) for v in iso.y_thresholds_]}, f)

    metrics = {
        "modelKey": "propensity-v1",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "auc": auc,
        "baselineAuc": baseline_auc,
        "calibrationByDecile": deciles,
        "nFitRows": int(len(X_fit)),
        "nCalRows": int(len(X_cal)),
        "nHoldoutRows": int(len(X_hold)),
        "baseRate": float(df[LABEL_COL].mean()),
        "bestIteration": int(booster.best_iteration or 0),
        "params": params,
        "horizonQuarters": HORIZON_QUARTERS,
        "trainCsv": os.path.abspath(args.train),
    }
    with open(os.path.join(args.out_dir, "metrics.json"), "w") as f:
        json.dump({**metrics, "featureList": feature_cols}, f, indent=2)

    print(f"[train] holdout AUC={auc:.4f}  baseline(assessed-ratio) AUC={baseline_auc:.4f}")
    print(f"[train] calibration by decile (predicted vs observed):")
    for d in deciles:
        print(f"  d{d['decile']:>2}  pred={d['meanPredicted']:.4f}  obs={d['observedRate']:.4f}  n={d['n']}")

    _write_predictions(df, feature_cols, booster, iso, args)
    print(f"[train] artifacts → {args.out_dir}")


def _write_predictions(df, feature_cols, booster, iso, args) -> None:
    """Per-parcel 12mo propensity from the parcel's LATEST at-risk quarter.

    For each parcel take its most recent frame row, then roll the hazard clock
    forward HORIZON_QUARTERS quarters (quartersSinceOnset+1 … +4) and compose
    1 - prod(1 - h_j). Static features are held constant — acceptable for v1.
    """
    import pandas as pd

    latest = (
        df.sort_values("quartersSinceOnset")
        .groupby(["countyFips", "apn"], observed=True)
        .tail(1)
        .copy()
    )
    hazards = []
    for step in range(1, HORIZON_QUARTERS + 1):
        future = latest.copy()
        future["quartersSinceOnset"] = future["quartersSinceOnset"] + step
        raw = booster.predict(future[feature_cols], num_iteration=booster.best_iteration)
        hazards.append(iso.predict(raw))
    out_path = os.path.join(args.out_dir, "predictions.csv")
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["countyFips", "apn", "propensity12mo"])
        for i, (_, row) in enumerate(latest.iterrows()):
            p = propensity_from_hazards([float(h[i]) for h in hazards])
            w.writerow([row["countyFips"], row["apn"], f"{p:.6f}"])
    print(f"[train] wrote {len(latest)} parcel propensities → {out_path}")


# --------------------------------------------------------------------------
# --self-test: stdlib-only checks of the math the loop depends on
# --------------------------------------------------------------------------

def self_test() -> None:
    # 1. hazard composition
    assert abs(propensity_from_hazards([0.0, 0.0, 0.0, 0.0]) - 0.0) < 1e-12
    assert abs(propensity_from_hazards([1.0]) - 1.0) < 1e-12
    assert abs(propensity_from_hazards([0.1, 0.1]) - (1 - 0.9 * 0.9)) < 1e-12

    # 2. AUC on a perfectly separable synthetic set
    perfect = [(0.9, 1)] * 50 + [(0.1, 0)] * 50
    assert abs(rank_auc(perfect) - 1.0) < 1e-12
    # random scores → AUC ≈ 0.5
    rng = random.Random(42)
    noise = [(rng.random(), rng.randint(0, 1)) for _ in range(20000)]
    assert abs(rank_auc(noise) - 0.5) < 0.02, rank_auc(noise)
    # ties handled: all-same-score → exactly 0.5
    assert abs(rank_auc([(0.5, 1)] * 10 + [(0.5, 0)] * 10) - 0.5) < 1e-12

    # 3. decile table: informative synthetic scores produce a monotone-ish
    #    observed rate, and rows partition the input
    synth = [(p := rng.random(), 1 if rng.random() < p else 0) for _ in range(10000)]
    tbl = decile_table(synth)
    assert sum(d["n"] for d in tbl) == len(synth)
    assert tbl[-1]["observedRate"] > tbl[0]["observedRate"]

    # 4. group split is deterministic and roughly the requested fraction
    flags = [stable_group_split("12031", f"apn{i}", 0.2, 7) for i in range(20000)]
    frac = sum(flags) / len(flags)
    assert 0.18 < frac < 0.22, frac
    assert flags == [stable_group_split("12031", f"apn{i}", 0.2, 7) for i in range(20000)]

    print("[self-test] all stdlib checks passed")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--train", help="training-frame CSV from export-training-data.ts")
    ap.add_argument("--out-dir", default="scripts/ml/out/model-v1")
    ap.add_argument("--holdout-frac", type=float, default=0.2)
    ap.add_argument("--cal-frac", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--self-test", action="store_true",
                    help="run stdlib-only sanity checks and exit (no deps needed)")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.train:
        ap.error("--train is required (or use --self-test)")
    train(args)


if __name__ == "__main__":
    main()
