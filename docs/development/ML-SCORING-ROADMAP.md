# FlipOps ML-Powered Scoring Roadmap

**Status:** Planned
**Prerequisite:** Phase 1 must be complete before Phase 2

---

## Why This Matters

Currently, FlipOps uses **algorithmic scoring** based on distress signals (pre-foreclosure, vacancy, tax delinquency, etc.). The weights are static and based on industry assumptions, not actual user behavior.

Once we have behavioral data, we can legitimately claim "AI-powered" scoring because a model will learn what signals actually predict deals users close — not just what we think matters.

---

## Phase 1: Behavioral Data Collection

**Goal:** Build the training dataset before building the model

**Status:** Not started
**Effort:** Low (instrumentation only, no ML required)
**Tech:** Supabase/PostgreSQL event logging

### What to Log

Every user action that implies intent:

| Event | Signal Type | Value |
|-------|-------------|-------|
| Property clicked/viewed | Weak positive | User showed interest |
| Property saved/favorited | Moderate positive | User wants to revisit |
| Property moved to pipeline stage | Strong positive | User is pursuing |
| Property marked "not interested" | Explicit negative | User rejected |
| Property skipped (viewed < 3s) | Weak negative | Didn't engage |
| Deal closed (completed) | Ground truth positive | This is what we're optimizing for |
| Deal abandoned/lost | Ground truth negative | Pipeline drop-off |

### Data Schema (Suggested)

```sql
CREATE TABLE user_property_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  property_id UUID REFERENCES properties(id),
  event_type TEXT NOT NULL, -- 'view', 'save', 'skip', 'pipeline_move', 'close', 'abandon', 'reject'
  event_value JSONB, -- Additional context (e.g., pipeline stage, time spent)
  property_features JSONB, -- Snapshot of property data at event time
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for training queries
CREATE INDEX idx_user_property_events_user ON user_property_events(user_id);
CREATE INDEX idx_user_property_events_type ON user_property_events(event_type);
```

### Why Snapshot Property Features?

Property data changes over time (price drops, new liens, etc.). When training the model, we need to know what the property looked like when the user made their decision, not what it looks like now.

### Minimum Data Before Phase 2

- At least 1,000 positive outcomes (deals closed)
- At least 10,000 total events
- Data from at least 50 unique users
- At least 3 months of collection

---

## Phase 2: Weighted Scoring Enhancement

**Goal:** Train a lightweight ML model to re-weight distress signals based on actual outcomes

**Status:** Blocked on Phase 1 completion
**Effort:** Medium
**Tech:** XGBoost or LightGBM (gradient boosted trees)

### Why Gradient Boosted Trees?

- Work great with tabular data (which is what we have)
- Handles missng values well
- Interpretable (feature importance tells you why)
- Fast inference (can run in-browser or on edge)
- Don't need a GPU

### Features (from ATTOM + internal)

| Feature | Source | Current Weight | ML Will Learn |
|---------|--------|----------------|---------------|
| Pre-foreclosure status | ATTOM | +25 points | Actual correlation with closes |
| Vacant property | ATTOM | +15 points | Actual correlation with closes |
| Tax delinquent | ATTOM | +15 points | Actual correlation with closes |
| High equity (>40%) | ATTOM | +10 points | Actual correlation with closes |
| Days on market | ATTOM | +10 points | Actual correlation with closes |
| Code violations | ATTOM | +7 points | Actual correlation with closes |
| Ownership duration | ATTOM | - | New feature |
| Property age | ATTOM | - | New feature |
| Price vs ARV delta | Internal | - | New feature |
| Neighborhood deal velocity | Internal | - | New feature |

### Training Pipeline

1. **Export training data** from `user_property_events`
2. **Label creation:**
   - Positive: property reached "Closed" stage
   - Negative: property was rejected OR abandoned OR never progressed
3. **Feature engineering:** Extract property features at event time
4. **Train/test split:** 80/20, stratified by outcome
5. **Model training:** XGBoost with hyperparameter tuning
6. **Evaluation:** AUC-ROC, precision@k, lift charts
7. **Deploy:** Export model weights, integrate into scoring function

### Deployment Options

**Option A: Server-side scoring**
- Train model in Python
- Export to ONNX or native XGBoost format
- Score properties on API request
- Pros: Easy to update, full feature access
- Cons: Latency, requires API call

**Option B: Edge scoring (preferred)**
- Train model in Python
- Export to TensorFlow.js or ONNX.js
- Score properties in browser
- Pros: Instant, offline-capable
- Cons: Model size limits, feature engineering in JS

### Success Metrics

- **Lift:** ML-scored leads should close at 2x+ the rate of random leads
- **Ranking:** Top 10% of ML-scored leads should contain 40%+ of actual closes
- **User satisfaction:** Users should report "better leads" in feedback

---

## Phase 3: Personalized Scoring (Future)

**Goal:** Different users have different deal preferences — learn per-user models

**Status:** Future (after Phase 2 proves value)
**Tech:** Collaborative filtering or per-user fine-tuning

### Concept

- User A closes on distressed SFH in suburbs
- User B closes on vacant multifamily in urban areas
- Same property might score 80 for User A but 40 for User B

This is the "Netflix for real estate leads" vision.

---

## Timeline (Estimated)

| Phase | Start | Duration | Blocker |
|-------|-------|----------|---------|
| Phase 1 | Q1 2026 | 3-6 months (data collection) | None |
| Phase 2 | Q3 2026 | 4-6 weeks (model development) | 1,000+ closes in Phase 1 |
| Phase 3 | 2027+ | TBD | Phase 2 success |

---

## Notes

- Do NOT claim "AI-powered" until Phase 2 is deployed
- Current homepage should say "algorithmic scoring" not "AI scoring"
- Phase 1 is invisible to users but critical — don't skip it
- Consider A/B testing ML scores vs current scores in Phase 2

## Homepage Messaging (Updated 2026-02-10)

The homepage now includes a **Scoring Engine** section (`app/components/scoring-engine.tsx`) that:
- Uses "Behavioral Learning" language (not "AI" or "ML")
- Shows the concept of personalized scoring via a three-step flow
- Demonstrates different investors seeing different rankings
- Key tagline: "A Scoring Engine That Learns How You Invest"

This messaging is aspirational but honest — it describes Phase 2/3 capabilities without claiming they're live. The section communicates the vision while we build Phase 1 data collection. Once Phase 2 is deployed, we can add concrete metrics about improved close rates.
