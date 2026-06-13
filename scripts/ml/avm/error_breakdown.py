#!/usr/bin/env python3
"""Localize AVM holdout error by segment — where do the gains live?

Joins the best model's per-row holdout APE (model-v2c-control) back to the
training frame (which carries propertyType, sqft, age, comp count) so we can
break median APE down by property type, price band, comp availability, age, and
county. The breakdown tells us WHICH levers (segmentation, beds/baths, condition,
comps, location) would move the needle most.

    python scripts/ml/avm/error_breakdown.py \
        --frame scripts/ml/avm/out/avm-frame-v2c.csv \
        --holdout scripts/ml/avm/out/model-v2c-control/holdout-eval.csv
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


def load_frame(path):
    """(countyFips, apn, round(salePrice)) -> feature dict. Keyed by price so we
    match the exact holdout sale (the recent one) when a parcel sold twice."""
    idx = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            try:
                price = round(float(r["salePrice"]))
            except (ValueError, KeyError):
                continue
            key = (r["countyFips"], r["apn"], price)
            idx[key] = r
    return idx


def fnum(x):
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def report(title, groups):
    """groups: dict label -> list of ape. Print median APE + n, sorted by n."""
    print(f"\n=== {title} ===")
    print(f"  {'segment':22s} {'n':>7} {'medAPE':>8}")
    rows = [(lbl, len(apes), median(apes)) for lbl, apes in groups.items() if apes]
    for lbl, n, m in sorted(rows, key=lambda t: -t[1]):
        print(f"  {lbl:22s} {n:>7} {m:>8.4f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frame", required=True)
    ap.add_argument("--holdout", required=True)
    args = ap.parse_args()

    frame = load_frame(args.frame)

    rows = []
    matched = 0
    with open(args.holdout, newline="") as f:
        for r in csv.DictReader(f):
            try:
                actual = round(float(r["actual"]))
                ape = float(r["ape"])
            except (ValueError, KeyError):
                continue
            feat = frame.get((r["countyFips"], r["apn"], actual))
            if feat is None:
                continue
            matched += 1
            rows.append((ape, actual, feat, r["countyFips"]))

    print(f"holdout rows matched to frame features: {matched}")
    overall = [a for a, *_ in rows]
    print(f"OVERALL median APE: {median(overall):.4f}  (n={len(overall)})")

    # by property type
    by_type = {}
    for ape, _, feat, _ in rows:
        t = (feat.get("propertyType") or "NULL").strip() or "NULL"
        by_type.setdefault(t, []).append(ape)
    # collapse rare types into OTHER for readability
    big = {t: v for t, v in by_type.items() if len(v) >= 50}
    other = [a for t, v in by_type.items() if len(v) < 50 for a in v]
    if other:
        big["OTHER(<50ea)"] = other
    report("by propertyType", big)

    # by price band (quartiles of actual price)
    prices = sorted(a for _, a, _, _ in rows)
    q = [prices[int(len(prices) * f)] for f in (0.25, 0.5, 0.75)]
    def price_band(p):
        if p < q[0]: return f"1 <{q[0]//1000:.0f}k"
        if p < q[1]: return f"2 {q[0]//1000:.0f}-{q[1]//1000:.0f}k"
        if p < q[2]: return f"3 {q[1]//1000:.0f}-{q[2]//1000:.0f}k"
        return f"4 >{q[2]//1000:.0f}k"
    by_price = {}
    for ape, a, _, _ in rows:
        by_price.setdefault(price_band(a), []).append(ape)
    report("by price quartile", by_price)

    # by neighborhood comp count (thin vs rich comps)
    def comp_band(n):
        if n is None: return "? null"
        if n == 0: return "0 comps"
        if n <= 5: return "1-5"
        if n <= 20: return "6-20"
        if n <= 75: return "21-75"
        return "76+"
    by_comp = {}
    for ape, _, feat, _ in rows:
        by_comp.setdefault(comp_band(fnum(feat.get("neighborhoodCompCount"))), []).append(ape)
    report("by neighborhoodCompCount", by_comp)

    # by age band
    def age_band(yr):
        if yr is None: return "? null"
        if yr < 10: return "0-9 yr"
        if yr < 25: return "10-24"
        if yr < 45: return "25-44"
        if yr < 70: return "45-69"
        return "70+"
    by_age = {}
    for ape, _, feat, _ in rows:
        by_age.setdefault(age_band(fnum(feat.get("ageYears"))), []).append(ape)
    report("by ageYears", by_age)

    # by county
    by_cty = {}
    for ape, _, _, cty in rows:
        by_cty.setdefault(cty, []).append(ape)
    report("by county", by_cty)


if __name__ == "__main__":
    main()
