# Scoring Architecture — Two-Tier Learned Model (settled 2026-06-10)

> User directive: NO permanently pre-scored/hand-tuned weights. The platform learns what
> distress signals mean (per county, over time), and each account learns what they mean
> FOR THAT INVESTOR. Hand-tuned scorer v2.1 is the bootstrap + cold-start fallback only.
> This doc is the contract M2.3/M2.4 and M3+ build against. Keep it under 100 lines.

## The three layers

```
Layer 0  SIGNAL EXTRACTION (exists)      lib/scoring/distress-scorer.ts inputs:
                                         per-property signal vector + county + features
Layer 1  PLATFORM MODEL (M2)             learned signal→outcome weights, per-county
                                         P(sale 12mo | signals, county, property)
Layer 2  ACCOUNT MODEL (M3+, corpus-gated)  per-investor reranking over Layer 1
```

## Layer 1 — Platform ML (trains TODAY, retrospective labels)

- **Labels:** historical outcomes already in PG — tax-delinquency onset (earliestYear) →
  did ParcelSale occur within N quarters; foreclosure filing → sale. No user data needed.
- **Model:** discrete-time hazard, LightGBM. Features: signal vector + ages, property
  characteristics, owner-occupancy/absentee, ZIP/county aggregates.
- **Per-county effects:** hierarchical — county-level coefficients shrink toward the
  statewide prior in proportion to county sample size (67 counties; Glades must not
  overfit on 12 sales while Miami-Dade earns its own curve).
- **Output (per parcel):** calibrated P(sale 12mo) + per-signal contribution vector.
  The contribution vector IS the learned replacement for scorer v2.1's hand weights.
- **Serving:** batch inference → score/propensity columns (the materialized-score
  architecture is proven; what changes is that weights are LEARNED + versioned).
- **Cadence:** retrain monthly (or on major data lands like Civitek); recompute via the
  rescore-*.ts batch pattern; chunked updates per the Railway-proxy rule.

## Layer 2 — Account behavioral model (gated on event corpus)

- **Labels:** LeadEvent stream (viewed/opened/pursued/skipped/contacted/offer_made/
  contract_signed/closed), live since 2026-06-10. Every event snapshots scorer version +
  family breakdown — deliberately captured now because it cannot be backfilled.
- **Form:** light reranker over Layer 1 — per-account signal-affinity multipliers
  (regularized logistic / small GBM on [Layer-1 score, signal vector, investor-profile
  interactions]). An investor who closes on probate leads in rural counties drifts
  toward that; one who skips every vacant-lot lead stops seeing them ranked high.
- **Hierarchical cold start:** new accounts = persona priors (investorType, target
  markets, price band from onboarding/settings) pooled toward the platform model;
  divergence is EARNED by event volume (regularization decays with account history).
- **Activation gate:** ~5-10K platform events with ~300+ positive outcomes before v1
  (per AUDIT-A3). Until then Layer 2 = identity + persona priors.
- **Integration seam:** combineWithProfileScore (already in code).

## Invariants (all layers)

1. **Versioned:** ModelVersion table (version, trainedAt, metrics, featureList); every
   stored score carries its model version; breakdown tooltip shows provenance
   ("platform v3 · personalized"). No silent weight changes.
2. **Eval-gated:** retrain promotes only if it beats the incumbent on holdout
   (calibration by decile + ranking AUC); assessed-ratio baseline is the floor.
3. **Explainable:** per-signal contributions surface in the score-breakdown UI —
   trust in scraped data + learned scores requires receipts.
4. **Batch, not online:** no model server. Export TS → train Python → apply TS → PG.
5. **Scorer v2.1 never deleted:** it is the cold-start floor, the fallback when a model
   regresses, and the at-promote scorer until Layer 1 ships.

## Where it lands in the roadmap

- M2.3 foundations: ParcelFeature mart, ZipMarketStats, training loop, ModelVersion.
- M2.4 = Layer 1 v1 (propensity + learned contributions, per-county hierarchical).
- M3+ learned ranker = Layer 2, activation-gated by event volume.
- Event volume watch: /api/admin/events-health is the gate metric for Layer 2.
