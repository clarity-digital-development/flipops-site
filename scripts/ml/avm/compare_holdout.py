#!/usr/bin/env python3
"""Compare two AVM holdout-eval.csv files on the SAME out-of-time holdout rows.

Tests the M3.3 README hypothesis that the deep SDF history helps THIN/SLOW ZIPs
(the tail) even if it doesn't move the overall median. Reads the per-row
actual/predicted/ape dumps from two train runs, joins on (countyFips, apn,
situsZip), and reports overall + by ZIP-sample-size bucket.

    python scripts/ml/avm/compare_holdout.py \
        --a scripts/ml/avm/out/model-v2-control/holdout-eval.csv  --a-label control \
        --b scripts/ml/avm/out/model-v2-adjusted/holdout-eval.csv --b-label v2adj
"""
from __future__ import annotations
import argparse
import csv
import math


def median(xs):
    s = sorted(x for x in xs if x is not None and not (isinstance(x, float) and math.isnan(x)))
    n = len(s)
    if n == 0:
        return float("nan")
    m = n // 2
    return s[m] if n % 2 else (s[m - 1] + s[m]) / 2.0


def load(path):
    rows = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            key = (r["countyFips"], r["apn"], r["situsZip"])
            try:
                rows[key] = (float(r["ape"]), r["situsZip"])
            except ValueError:
                pass
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True)
    ap.add_argument("--a-label", default="A")
    ap.add_argument("--b", required=True)
    ap.add_argument("--b-label", default="B")
    args = ap.parse_args()

    A = load(args.a)
    B = load(args.b)
    common = sorted(set(A) & set(B))
    print(f"rows: {args.a_label}={len(A)}  {args.b_label}={len(B)}  common={len(common)}")

    a_all = [A[k][0] for k in common]
    b_all = [B[k][0] for k in common]
    print(f"\nOVERALL median APE (common rows):")
    print(f"  {args.a_label:10s} {median(a_all):.4f}")
    print(f"  {args.b_label:10s} {median(b_all):.4f}")
    print(f"  win% ({args.b_label} closer per-row): "
          f"{100*sum(1 for k in common if B[k][0] < A[k][0])/max(1,len(common)):.1f}%")

    # Per-ZIP holdout count → bucket. Tests the thin-ZIP tail hypothesis.
    zip_n = {}
    for k in common:
        z = A[k][1]
        zip_n[z] = zip_n.get(z, 0) + 1

    buckets = [("thin   (<25)", lambda n: n < 25),
               ("small  (25-74)", lambda n: 25 <= n < 75),
               ("med    (75-149)", lambda n: 75 <= n < 150),
               ("dense  (150+)", lambda n: n >= 150)]
    print(f"\nBy ZIP-sample bucket (n = holdout sales in that ZIP):")
    print(f"  {'bucket':16s} {'#zips':>6} {'#rows':>7} {args.a_label:>9} {args.b_label:>9} {'d(b-a)':>8}")
    for name, pred in buckets:
        zs = [z for z, n in zip_n.items() if pred(n)]
        ks = [k for k in common if A[k][1] in set(zs)]
        if not ks:
            continue
        ma = median([A[k][0] for k in ks])
        mb = median([B[k][0] for k in ks])
        print(f"  {name:16s} {len(zs):>6} {len(ks):>7} {ma:>9.4f} {mb:>9.4f} {mb-ma:>+8.4f}")


if __name__ == "__main__":
    main()
