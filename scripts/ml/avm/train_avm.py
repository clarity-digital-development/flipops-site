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
# AVM v2 temporal helpers — HPI-style time-of-sale price index + adjustment.
# Pure-stdlib (unit-tested by --self-test) so the index math is auditable
# without pandas. The model values a parcel AS-OF a reference month; every
# historical sale's price (and its neighborhood-comp $/sqft) is scaled to that
# month so 17 years of sales contribute to learning the value SURFACE without
# their (very different) price LEVELS biasing it. See the M3.3 README "expected
# improvement" note — this is the prescribed temporal handling for the SDF
# deep-history retrain.
# --------------------------------------------------------------------------

def ym_ordinal(date_str) -> "int | None":
    """'YYYY-MM-DD' → year*12 + (month-1), a 0-based monotone month index so
    month differences are clean. None on missing/malformed input."""
    if not isinstance(date_str, str) or len(date_str) < 7:
        return None
    try:
        y = int(date_str[0:4])
        m = int(date_str[5:7])
    except ValueError:
        return None
    if not (1 <= m <= 12):
        return None
    return y * 12 + (m - 1)


# ppsf sanity band — drop $/sqft outliers that would distort a monthly median
# (data-entry noise, land miscoded with tiny sqft, ultra-luxury slivers).
PPSF_MIN, PPSF_MAX = 20.0, 2000.0


def monthly_median_ppsf(
    rows: list[tuple[str, "int | None", "float | None"]], min_n: int
) -> dict[str, dict[int, float]]:
    """rows = (county, ym, ppsf). → {county: {ym: median_ppsf}} keeping only
    buckets with >= min_n finite, in-band ppsf. The min_n gate is what makes the
    index robust to thin/bad months (e.g. the Broward-2023 SDF hole: ~26
    sales/mo < min_n → that month is dropped here and interpolated later)."""
    buckets: dict[str, dict[int, list[float]]] = {}
    for county, ym, ppsf in rows:
        if ym is None or ppsf is None or _isnan(ppsf):
            continue
        if ppsf < PPSF_MIN or ppsf > PPSF_MAX:
            continue
        buckets.setdefault(county, {}).setdefault(ym, []).append(ppsf)
    out: dict[str, dict[int, float]] = {}
    for county, months in buckets.items():
        out[county] = {ym: median(v) for ym, v in months.items() if len(v) >= min_n}
    return out


def smooth_fill_index(month_to_val: dict[int, float], smooth: int = 3) -> dict[int, float]:
    """One county's gappy {ym: ppsf} → a DENSE {ym: ppsf} over [min..max]:
    (1) a `smooth`-month centered moving median over the KNOWN points to tame
    monthly noise, then (2) linear interpolation across interior gaps, carrying
    the nearest anchor for any leading/trailing holes."""
    if not month_to_val:
        return {}
    yms = sorted(month_to_val)
    lo, hi = yms[0], yms[-1]
    half = smooth // 2
    sm: dict[int, float] = {}
    for i, ym in enumerate(yms):
        window = [month_to_val[yms[j]] for j in range(max(0, i - half), min(len(yms), i + half + 1))]
        sm[ym] = median(window)
    known = sorted(sm)
    dense: dict[int, float] = {}
    for ym in range(lo, hi + 1):
        if ym in sm:
            dense[ym] = sm[ym]
            continue
        prev = max((k for k in known if k < ym), default=None)
        nxt = min((k for k in known if k > ym), default=None)
        if prev is not None and nxt is not None:
            t = (ym - prev) / (nxt - prev)
            dense[ym] = sm[prev] + t * (sm[nxt] - sm[prev])
        elif prev is not None:
            dense[ym] = sm[prev]
        elif nxt is not None:
            dense[ym] = sm[nxt]
    return dense


def index_factor(
    index: dict[str, dict[int, float]], county: str, ym: "int | None", as_of_ym: int
) -> float:
    """Multiplicative factor that brings a (county, ym) price to as_of_ym's
    level: idx[as_of]/idx[ym]. Returns 1.0 (no adjustment) when either endpoint
    is missing or non-positive — fail-safe, never explodes a price."""
    cm = index.get(county)
    if not cm or ym is None:
        return 1.0
    base = cm.get(as_of_ym)
    cur = cm.get(ym)
    if not base or not cur or base <= 0 or cur <= 0:
        return 1.0
    return base / cur


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


# --------------------------------------------------------------------------
# AVM v2 — temporal retrain path (HPI adjustment + out-of-time holdout)
# --------------------------------------------------------------------------

def train_temporal(args: argparse.Namespace) -> None:
    """AVM v2 — temporal retrain on the deep SDF sale history.

    Three differences from train() (all so 17 years of sales train a PRESENT
    value model without their very different price LEVELS biasing it):
      1. OUT-OF-TIME + OUT-OF-PARCEL holdout: holdout = sales on/after
         --holdout-since whose parcel is unseen in train (the honest "value a
         sale we couldn't have seen" test). Omit --holdout-since to fit on all.
      2. HPI TIME-ADJUSTMENT (--adjust): each train sale's price AND its
         neighborhood-comp $/sqft are scaled to the as-of month (max train
         month) by a per-county monthly $/sqft index built from TRAIN ROWS ONLY
         (no holdout leakage). Target = log(adjusted price). Holdout features
         stay raw (recent → already ~as-of level), matching serving.
      3. RECENCY control (--recency-months N, no --adjust): restrict train to
         the trailing N months before the cutoff and skip adjustment — v1's
         recipe on the SAME split, the fair bar v2 must beat.

    Eval (when a holdout exists) = median APE of exp(pred) vs the ACTUAL
    (unadjusted) holdout price, vs the assessed-ratio baseline (fit on recent
    train rows so current-assessed maps to current-price), reported by ZIP.
    Feature list is byte-identical to v1 → predict/apply pipeline is unchanged.
    """
    import numpy as np
    import pandas as pd
    import lightgbm as lgb

    df = pd.read_csv(
        args.train,
        dtype={"apn": str, "situsZip": str, "countyFips": str, "saleDate": str},
    )
    if TARGET_COL not in df.columns:
        sys.exit(f"--train CSV missing target column {TARGET_COL!r}")
    df = df[df[TARGET_COL] > 0].copy()
    df["_ym"] = df["saleDate"].map(ym_ordinal)
    df = df[df["_ym"].notna()].copy()
    df["_ym"] = df["_ym"].astype(int)
    df = df.reset_index(drop=True)  # positional bool masks below assume RangeIndex
    if df.empty:
        sys.exit("[avm-train] no usable rows (salePrice>0 + parseable saleDate)")

    # Segmentation experiment: restrict to specific DOR property-type codes
    # (propertyType is a stable parcel attribute, so the out-of-parcel holdout
    # stays consistent — a condo's prior sales are all condo sales).
    if args.property_types:
        # pandas reads DOR codes like "004" as int 4 (leading zeros stripped) or
        # float "4.0" when NaNs are present; normalize both sides by stripping
        # leading zeros (and a trailing .0) so "004"/"4"/"4.0" all match.
        def _norm(s):
            return (s.astype("string").str.replace(r"\.0$", "", regex=True)
                    .str.lstrip("0").replace("", "0"))
        want = {(t.strip().lstrip("0") or "0") for t in args.property_types.split(",") if t.strip()}
        before = len(df)
        df = df[_norm(df["propertyType"]).isin(want)].reset_index(drop=True)
        print(f"[avm-train] property-type filter {sorted(want)}: {before} -> {len(df)} rows")
        if df.empty:
            sys.exit("[avm-train] no rows after --property-types filter")

    # Feature preprocessing — identical to train() so there is zero skew, plus
    # _ym is excluded from the model feature set (it is split bookkeeping).
    non_feature = set(NON_FEATURE_COLS) | {"_ym"}
    skip = set(CATEGORICAL_COLS) | non_feature
    for c in df.columns:
        if c not in skip and df[c].dtype == object:
            df[c] = df[c].map({"true": 1.0, "false": 0.0, "t": 1.0, "f": 0.0}).astype(float)
    if "saleMonth" in df.columns:
        df["saleMonth"] = df["saleMonth"].astype("Int64").astype(str)
    feature_cols = [c for c in df.columns if c not in non_feature]
    for c in CATEGORICAL_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    # --- temporal split -----------------------------------------------------
    cutoff_ym = ym_ordinal(args.holdout_since) if args.holdout_since else None
    if cutoff_ym is not None:
        pre_mask = (df["_ym"] < cutoff_ym).to_numpy()
        train_apns = set(df.loc[pre_mask, "apn"].astype(str))
        post_mask = (df["_ym"] >= cutoff_ym).to_numpy()
        unseen = ~df["apn"].astype(str).isin(train_apns).to_numpy()
        holdout_mask = post_mask & unseen
    else:
        pre_mask = np.ones(len(df), dtype=bool)
        holdout_mask = np.zeros(len(df), dtype=bool)

    train_df = df.loc[pre_mask].copy()
    ref_ym = cutoff_ym if cutoff_ym is not None else int(df["_ym"].max()) + 1
    if args.recency_months and args.recency_months > 0:
        train_df = train_df.loc[train_df["_ym"] >= (ref_ym - args.recency_months)].copy()
    if train_df.empty:
        sys.exit("[avm-train] empty train split after temporal/recency filtering")

    # --- HPI index from TRAIN ROWS ONLY -------------------------------------
    index: dict[str, dict[int, float]] = {}
    n_untrusted_dropped = 0
    if args.adjust:
        with np.errstate(divide="ignore", invalid="ignore"):
            ppsf = train_df[TARGET_COL].to_numpy(dtype=float) / train_df["squareFeet"].to_numpy(dtype=float)
        idx_rows = list(zip(
            train_df["countyFips"].astype(str).tolist(),
            train_df["_ym"].tolist(),
            [float(x) for x in ppsf],
        ))
        raw = monthly_median_ppsf(idx_rows, args.min_month_n)
        index = {c: smooth_fill_index(m, 3) for c, m in raw.items()}
        # Surgically drop train rows in untrusted (below-min_n) months — e.g.
        # the Broward-2023 SDF hole — rather than training on their bad prices.
        trusted_pairs = {(c, ym) for c, yms in raw.items() for ym in yms}
        keys = list(zip(train_df["countyFips"].astype(str), train_df["_ym"].astype(int)))
        keep = np.array([k in trusted_pairs for k in keys])
        n_untrusted_dropped = int((~keep).sum())
        train_df = train_df.loc[keep].copy()

    as_of_ym = int(train_df["_ym"].max())

    def factors_for(frame: "pd.DataFrame") -> "np.ndarray":
        return np.array([
            index_factor(index, str(c), int(y), as_of_ym)
            for c, y in zip(frame["countyFips"], frame["_ym"])
        ])

    if args.adjust:
        # Adjusting BOTH the target AND the comp $/sqft to as-of is what keeps the
        # two consistent: every train row (old or recent) lands at the as-of price
        # level — the SAME level serving presents (recent comps, factor≈1). NOT
        # adjusting the comp would leave old rows with old-level comps against an
        # as-of target → a contradictory feature. Holdout/serving comps stay RAW
        # on purpose: those rows are recent, so raw ≈ as-of already.
        if "neighborhoodPricePerSqft" not in train_df.columns:
            sys.exit("[avm-train] --adjust requires the neighborhoodPricePerSqft column")
        f_train = factors_for(train_df)
        y_train_price = train_df[TARGET_COL].to_numpy(dtype=float) * f_train
        nb = train_df["neighborhoodPricePerSqft"].to_numpy(dtype=float)
        train_df["neighborhoodPricePerSqft"] = nb * f_train
    else:
        f_train = np.ones(len(train_df))
        y_train_price = train_df[TARGET_COL].to_numpy(dtype=float)

    y_fit_log = np.log(y_train_price)
    X_fit_all = train_df[feature_cols]
    val_mask = np.array([
        stable_group_split(str(c), str(a), 0.15, args.seed + 7)
        for c, a in zip(train_df["countyFips"], train_df["apn"])
    ])
    print(
        f"[avm-train] temporal: train={len(train_df)} holdout={int(holdout_mask.sum())} "
        f"adjust={args.adjust} recencyMonths={args.recency_months or 0} "
        f"as_of_ym={as_of_ym} ({as_of_ym // 12}-{as_of_ym % 12 + 1:02d}) "
        f"untrustedDropped={n_untrusted_dropped}"
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
    booster = lgb.train(
        params,
        lgb.Dataset(X_fit_all[~val_mask], label=y_fit_log[~val_mask]),
        num_boost_round=3000,
        valid_sets=[lgb.Dataset(X_fit_all[val_mask], label=y_fit_log[val_mask])],
        callbacks=[lgb.early_stopping(120, verbose=False)],
    )

    # --- eval on the out-of-time holdout ------------------------------------
    model_median_ape = float("nan")
    baseline_median_ape = float("nan")
    ratio = float("nan")
    by_zip: list[dict] = []
    pred_price = np.array([])
    actual = np.array([])
    zips = np.array([])
    if holdout_mask.any():
        hold_df = df.loc[holdout_mask]
        pred_log = booster.predict(hold_df[feature_cols], num_iteration=booster.best_iteration)
        pred_price = np.exp(pred_log)
        actual = hold_df[TARGET_COL].to_numpy(dtype=float)
        zips = hold_df["situsZip"].astype(str).to_numpy()
        model_median_ape = median_ape(list(zip(pred_price.tolist(), actual.tolist())))
        by_zip = ape_by_zip(list(zip(zips.tolist(), pred_price.tolist(), actual.tolist())))
        # Baseline ratio fit on RECENT train rows (current-assessed → current-price).
        recent = train_df.loc[train_df["_ym"] >= (as_of_ym - 24)]
        fit_assessed = list(zip(recent["assessedValue"].fillna(0).tolist(), recent[TARGET_COL].tolist()))
        hold_assessed = list(zip(
            hold_df["assessedValue"].fillna(0).tolist(),
            hold_df[TARGET_COL].tolist(),
            [0.0] * int(holdout_mask.sum()),
        ))
        ratio, base_pairs = assessed_ratio_baseline(fit_assessed, hold_assessed)
        baseline_median_ape = median_ape(base_pairs) if base_pairs else float("nan")

    beats = (
        not _isnan(model_median_ape)
        and (_isnan(baseline_median_ape) or model_median_ape < baseline_median_ape)
    )

    os.makedirs(args.out_dir, exist_ok=True)
    booster.save_model(os.path.join(args.out_dir, "model.txt"), num_iteration=booster.best_iteration)

    index_summary = []
    for county, months in index.items():
        if months:
            facs = [index_factor(index, county, ym, as_of_ym) for ym in months]
            index_summary.append({
                "county": county,
                "nMonths": len(months),
                "factorMin": _finite(min(facs)),
                "factorMax": _finite(max(facs)),
            })

    metrics = {
        "modelKey": "avm-v1",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "medianAPE": _finite(model_median_ape),
        "baselineMedianAPE": _finite(baseline_median_ape),
        "beatsBaseline": bool(beats),
        "assessedRatio": _finite(ratio),
        "residualBandPct": _finite(model_median_ape),
        "byZip": [
            {"zip": _safe_zip(d["zip"]), "medianAPE": _finite(d["medianAPE"]), "n": d["n"]}
            for d in by_zip
        ],
        "nFitRows": int(len(train_df)),
        "nHoldoutRows": int(holdout_mask.sum()),
        "bestIteration": int(booster.best_iteration or 0),
        "params": params,
        "metros": sorted(df["countyFips"].astype(str).unique().tolist()),
        "trainCsv": os.path.abspath(args.train),
        "temporal": {
            "adjusted": bool(args.adjust),
            "holdoutSince": args.holdout_since,
            "recencyMonths": int(args.recency_months or 0),
            "minMonthN": int(args.min_month_n),
            "asOfYm": as_of_ym,
            "asOfLabel": f"{as_of_ym // 12}-{as_of_ym % 12 + 1:02d}",
            "untrustedRowsDropped": n_untrusted_dropped,
            "propertyTypes": sorted(args.property_types.split(",")) if args.property_types else None,
            "indexByCounty": index_summary,
        },
    }
    with open(os.path.join(args.out_dir, "metrics.json"), "w") as f:
        json.dump({**metrics, "featureList": feature_cols}, f, indent=2, allow_nan=False)

    if holdout_mask.any():
        with open(os.path.join(args.out_dir, "holdout-eval.csv"), "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["countyFips", "apn", "situsZip", "actual", "predicted", "ape"])
            hd = df.loc[holdout_mask]
            apns = hd["apn"].astype(str).to_numpy()
            cfips = hd["countyFips"].astype(str).to_numpy()
            for i in range(len(actual)):
                w.writerow([
                    cfips[i], apns[i], zips[i],
                    f"{actual[i]:.0f}", f"{pred_price[i]:.0f}",
                    f"{ape(pred_price[i], actual[i]):.4f}",
                ])

    print(
        f"[avm-train] OUT-OF-TIME holdout median APE={model_median_ape:.4f}  "
        f"baseline(assessed-ratio) median APE={baseline_median_ape:.4f}  beats={beats}"
    )
    if index_summary:
        for s in index_summary:
            print(f"[avm-train] index {s['county']}: {s['nMonths']} months, factor {s['factorMin']:.3f}..{s['factorMax']:.3f}")
    print(f"[avm-train] artifacts -> {args.out_dir}")


# --------------------------------------------------------------------------
# --predict: score the per-parcel feature frame → predictions.csv
# --------------------------------------------------------------------------

def predict(args: argparse.Namespace) -> None:
    """Load a saved booster + the per-parcel feature frame (from
    export-predict-features.ts), apply the EXACT same preprocessing the training
    path used (train/serve skew is the #1 AVM failure mode), back-transform from
    log to price space, and write predictions.csv: countyFips,apn,estimatedValue.

    The booster's own feature_name() is the source of truth for column order, so
    a featureList drift between the model and the predict frame fails loud here
    (KeyError on the missing column) instead of silently mis-aligning columns.
    """
    import numpy as np
    import pandas as pd
    import lightgbm as lgb

    booster = lgb.Booster(model_file=args.model)
    feature_cols = list(booster.feature_name())

    df = pd.read_csv(
        args.features, dtype={"apn": str, "situsZip": str, "countyFips": str}
    )
    for key in ("countyFips", "apn"):
        if key not in df.columns:
            sys.exit(f"--features CSV missing key column {key!r}")
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        sys.exit(
            f"--features CSV missing model feature column(s) {missing} — "
            f"train/serve skew. Re-export with the matching featureList."
        )

    # Mirror train(): Postgres booleans export as "true"/"false" → numeric;
    # everything that is neither categorical nor a key becomes float (NaN=NULL).
    skip = set(CATEGORICAL_COLS) | set(ID_COLS) | {TARGET_COL}
    for c in df.columns:
        if c not in skip and df[c].dtype == object:
            df[c] = df[c].map(
                {"true": 1.0, "false": 0.0, "t": 1.0, "f": 0.0}
            ).astype(float)

    if "saleMonth" in df.columns:
        df["saleMonth"] = df["saleMonth"].astype("Int64").astype(str)
    for c in CATEGORICAL_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    n = len(df)
    if n == 0:
        sys.exit("[avm-predict] empty --features frame")

    # Score in chunks to bound memory on the ~1.5M-row metro frames.
    chunk = max(1, int(args.predict_chunk))
    preds = np.empty(n, dtype=float)
    for start in range(0, n, chunk):
        end = min(start + chunk, n)
        pred_log = booster.predict(df.loc[df.index[start:end], feature_cols])
        preds[start:end] = np.exp(pred_log)
        if (start // chunk) % 20 == 0:
            print(f"[avm-predict] scored {end}/{n}")

    out_path = args.out
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    cfips = df["countyFips"].astype(str).to_numpy()
    apns = df["apn"].astype(str).to_numpy()
    written = 0
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["countyFips", "apn", "estimatedValue"])
        for i in range(n):
            est = preds[i]
            # Honest absence: skip non-finite / non-positive estimates rather
            # than write a garbage valuation. apply-avm.ts simply won't UPSERT
            # a row for these parcels → underwriting shows "no model estimate".
            if est is None or _isnan(float(est)) or not math.isfinite(float(est)) or est <= 0:
                continue
            w.writerow([cfips[i], apns[i], f"{est:.0f}"])
            written += 1

    finite = [float(p) for p in preds if math.isfinite(float(p)) and p > 0]
    med = median(finite) if finite else float("nan")
    print(
        f"[avm-predict] wrote {written}/{n} predictions -> {out_path}  "
        f"(median estimate ${med:,.0f})"
    )


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

    # 7. ym_ordinal: monotone month index, clean diffs, robust to junk
    assert ym_ordinal("2020-01-15") + 1 == ym_ordinal("2020-02-01")
    assert ym_ordinal("2021-01-01") - ym_ordinal("2020-01-01") == 12
    assert ym_ordinal("2020-06") == ym_ordinal("2020-06-30")  # YYYY-MM accepted
    assert ym_ordinal(None) is None and ym_ordinal("nope") is None
    assert ym_ordinal("2020-13-01") is None  # bad month

    # 8. monthly_median_ppsf: min_n gate + outlier band drop the bad sliver
    base = [("A", 100, 200.0)] * 50          # 50 good comps in month 100
    thin = [("A", 101, 999.0)] * 5           # 5 in month 101 (below min_n)
    band = [("A", 102, 5.0), ("A", 102, 9999.0)] * 30  # out-of-band → dropped
    mm = monthly_median_ppsf(base + thin + band, min_n=40)
    assert mm["A"][100] == 200.0
    assert 101 not in mm["A"]  # thin month gated out
    assert 102 not in mm["A"]  # all out-of-band → no in-band samples

    # 9. smooth_fill_index: interpolate an interior gap linearly
    dense = smooth_fill_index({100: 100.0, 103: 130.0}, smooth=1)
    assert abs(dense[100] - 100.0) < 1e-9 and abs(dense[103] - 130.0) < 1e-9
    assert abs(dense[101] - 110.0) < 1e-9 and abs(dense[102] - 120.0) < 1e-9

    # 10. index_factor: scales an old-month price up to the as-of level; fails
    #     safe (1.0) when a month is absent.
    idx = {"A": smooth_fill_index({100: 100.0, 112: 200.0}, smooth=1)}
    assert abs(index_factor(idx, "A", 100, 112) - 2.0) < 1e-9  # 100→200 ⇒ ×2
    assert abs(index_factor(idx, "A", 112, 112) - 1.0) < 1e-9  # as-of ⇒ ×1
    assert index_factor(idx, "A", 9999, 112) == 1.0           # missing ⇒ ×1
    assert index_factor(idx, "ZZ", 100, 112) == 1.0           # unknown county

    print("[self-test] all stdlib checks passed")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--train", help="avm-frame CSV from export-avm-training.ts")
    ap.add_argument("--out-dir", default="scripts/ml/avm/out/model-v1")
    ap.add_argument("--holdout-frac", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=7)
    # --- AVM v2 temporal retrain (HPI adjustment + out-of-time holdout) ---
    ap.add_argument(
        "--temporal",
        action="store_true",
        help="use the temporal retrain path (train_temporal): HPI time-adjustment "
        "and an out-of-time + out-of-parcel holdout for the deep SDF history",
    )
    ap.add_argument(
        "--holdout-since",
        help="YYYY-MM or YYYY-MM-DD; sales on/after this month are the out-of-time "
        "holdout (omit to fit on all windowed rows). Temporal mode only.",
    )
    ap.add_argument(
        "--adjust",
        action="store_true",
        help="apply per-county HPI time-adjustment to price + comp $/sqft (v2). "
        "Omit for the recency-only control. Temporal mode only.",
    )
    ap.add_argument(
        "--recency-months",
        type=int,
        default=0,
        help="restrict train to the trailing N months before the cutoff (the "
        "recency-only control reproducing v1's recipe). 0 = use all. Temporal only.",
    )
    ap.add_argument(
        "--min-month-n",
        type=int,
        default=40,
        help="min arms-length sales for a county-month to anchor the HPI index "
        "(thin/bad months are interpolated AND their train rows dropped). Temporal only.",
    )
    ap.add_argument(
        "--property-types",
        help="comma list of DOR propertyType codes to restrict BOTH train and "
        "holdout (e.g. '001' for single-family, '004' for condo). The segmentation "
        "experiment: a within-segment model vs the blended model. Temporal only.",
    )
    ap.add_argument(
        "--self-test",
        action="store_true",
        help="run stdlib-only sanity checks and exit (no deps needed)",
    )
    # --- prediction (serving) mode ---
    ap.add_argument(
        "--predict",
        action="store_true",
        help="score --features with --model → --out predictions.csv (no training)",
    )
    ap.add_argument("--model", help="path to a saved model.txt (predict mode)")
    ap.add_argument(
        "--features", help="per-parcel feature CSV from export-predict-features.ts"
    )
    ap.add_argument(
        "--out", default="scripts/ml/avm/out/model-v1/predictions.csv"
    )
    ap.add_argument(
        "--predict-chunk", type=int, default=200_000, help="rows scored per chunk"
    )
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    if args.predict:
        if not args.model or not args.features:
            ap.error("--predict requires --model and --features")
        predict(args)
        return
    if not args.train:
        ap.error("--train is required (or use --predict / --self-test)")
    if args.temporal:
        train_temporal(args)
        return
    train(args)


if __name__ == "__main__":
    main()
