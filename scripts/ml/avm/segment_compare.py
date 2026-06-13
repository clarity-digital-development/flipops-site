#!/usr/bin/env python3
"""Segmentation experiment: does a per-property-type model beat the blended model?

Compares, ON THE SAME OUT-OF-TIME HOLDOUT ROWS, the blended (all-types) model's
APE against each segment-specific model's APE. Rows are matched by
(countyFips, apn, actual) — propertyType is parcel-stable so the holdout row set
is identical between the blended run and each segment run. Also reports the
SYSTEM-level effect: route condos to the condo model + SFR to the SFR model,
leave everything else on the blended model, and compare the overall median APE.

    python scripts/ml/avm/segment_compare.py \
        --blended scripts/ml/avm/out/model-v2c-control/holdout-eval.csv \
        --segment condo=scripts/ml/avm/out/model-seg-condo/holdout-eval.csv \
        --segment sfr=scripts/ml/avm/out/model-seg-sfr/holdout-eval.csv
"""
from __future__ import annotations
import argparse
import csv
import math


def median(xs):
    s = sorted(v for v in xs if v is not None and not (isinstance(v, float) and math.isnan(v)))
    n = len(s)
    if n == 0:
        return float("nan")
    m = n // 2
    return s[m] if n % 2 else (s[m - 1] + s[m]) / 2.0


def load(path):
    """(countyFips, apn, actual_str) -> ape."""
    out = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            try:
                out[(r["countyFips"], r["apn"], r["actual"])] = float(r["ape"])
            except (ValueError, KeyError):
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blended", required=True)
    ap.add_argument("--segment", action="append", default=[],
                    help="label=path/to/holdout-eval.csv (repeatable)")
    args = ap.parse_args()

    blended = load(args.blended)
    print(f"blended holdout rows: {len(blended)}  overall median APE: {median(list(blended.values())):.4f}")

    # combined = blended apes, overridden by each segment model where it covers a row
    combined = dict(blended)
    covered = set()

    print("\n=== per-segment: segment-specific model vs blended (same rows) ===")
    print(f"  {'segment':10s} {'n':>6} {'blended':>9} {'segment':>9} {'delta':>8}  {'seg wins/row':>12}")
    for spec in args.segment:
        label, path = spec.split("=", 1)
        seg = load(path)
        keys = [k for k in seg if k in blended]
        if not keys:
            print(f"  {label:10s}   (no overlapping rows)")
            continue
        b = [blended[k] for k in keys]
        s = [seg[k] for k in keys]
        wins = sum(1 for k in keys if seg[k] < blended[k])
        mb, ms = median(b), median(s)
        print(f"  {label:10s} {len(keys):>6} {mb:>9.4f} {ms:>9.4f} {ms-mb:>+8.4f}  {100*wins/len(keys):>10.1f}%")
        for k in keys:
            combined[k] = seg[k]
            covered.add(k)

    # System-level: blended vs segmented-routing over ALL holdout rows
    all_keys = list(blended)
    sys_blended = median([blended[k] for k in all_keys])
    sys_combined = median([combined[k] for k in all_keys])
    print("\n=== system-level (all holdout rows, segment-routing where available) ===")
    print(f"  rows routed to a segment model: {len(covered)} / {len(all_keys)}")
    print(f"  blended-only      median APE: {sys_blended:.4f}")
    print(f"  segmented-routing median APE: {sys_combined:.4f}   delta {sys_combined - sys_blended:+.4f}")

    # And over just the covered (segmented) rows, the gain
    if covered:
        cov = list(covered)
        print(f"  (over the {len(cov)} routed rows: blended {median([blended[k] for k in cov]):.4f} "
              f"-> segmented {median([combined[k] for k in cov]):.4f})")


if __name__ == "__main__":
    main()
