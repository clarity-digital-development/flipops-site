# V0 Auction Source — Synthesis Verdict

**Date:** 2026-06-02
**Source under consideration:** RealAuction-foreclosure SCHEDULED
**Verdict:** PROCEED WITH FIXES — ship 1.5-day minimum, defer full plan to v0.1

---

## Empirical reality

- 199 total foreclosure rows across 16 FL counties; 182 SCHEDULED, 17 SOLD, 0 cancelled.
- Strict APN join: 51.3% (91/182 SCHEDULED enriched). Normalize (alphanumeric-only): 63.8%.
- 45/199 rows (22.6%) have `apn='Property Appraiser'` — scraper label-leak bug (Duval 12031, Hillsborough 12057). Brevard (12009, 20 rows) writes case# instead of APN. Together 62/199 = 31% unfixable by normalization.
- Strong-join counties: Pasco/Volusia/Orange/Broward/Manatee = 100%; Sarasota 91.7%; Marion 74.1%.
- Parser: `auctionDate` NULL on 199/199 rows. Cheerio `.text()` concatenation bug on `^Auction Starts` regex anchor. Re-probe needed.
- Enrichment depth: 45/182 (25%) SCHEDULED have both `judgmentAmount` AND `openingBid`. Fully-loaded cards ~40-50.

---

## Hard-gate fixes (must apply before shipping)

1. Guard against `apn='Property Appraiser'` and empty APN at query layer.
2. Cross-branch dedup hard-suppression vs TaxDelinquencySummary (overlap is 15-40%, not 5%).
3. Unique key includes `caseNumber`, not just `(countyFips, apn)`.
4. Scope L0 (0.5-1d) for RA APN-selector fix OR exclude Duval/Hillsborough/Brevard from v0 UNION.
5. Skip materialized AuctionSummary — direct Foreclosure LEFT JOIN Parcel is <50ms at 199 rows.
6. Hardcode score=85/grade=A for SCHEDULED. Defer v2.1 signal-family MAX to v0.1.

---

## Build sequence (revised, 12h / 1.5d)

| Phase | Hours | Change vs original 4d plan |
|---|---|---|
| L0 Guard clause (apn label-leak filter) | 1h | NEW |
| L1 Parser fix (auctionDate) | CUT | Defer to v0.1 |
| L2 Materialized AuctionSummary | CUT | 199 rows doesn't justify |
| L3 UNION 3rd branch direct against Foreclosure | 4h | No aggregate table |
| L4 Scorer — hardcoded 85/A for SCHEDULED | 2h | Real scorer deferred |
| L5 UI — Gavel badge + legal disclosure ONLY | 3h | Filter chip, DetailCells, countdown cut |
| L6 Promote endpoint + 1 Playwright smoke | 2h | Cross-county matrix cut |
| **Total** | **12h** | from 32h |

---

## Minimum (1.5d) vs Full (4d)

**Minimum (1.5d):**
- 91 enriched SCHEDULED rows across 13 counties
- Gavel badge + legal footer
- Hardcoded score=85/A
- Promote works end-to-end
- No auctionDate, no Duval/Hillsborough/Brevard
- 1 Playwright smoke

**Full (4d, actually 5-5.5d):**
- ~155 enriched rows after normalize + parser
- Full filter chip + DetailCells + "Auction in Nd"
- v2.1 FUTURE_AUCTION + LIS_PENDENS signals
- Promote + scorer + materialized aggregate
- All 16 counties incl. fixed Duval/Hillsborough/Brevard
- Cross-county matrix + e2e

---

## Recommendation

Greenlight the 1.5-day minimum. 91 enriched + ~70 stub SCHEDULED auction rows across 13 working counties is a real flywheel demo; cut features are v0.1 polish that's strictly cheaper after users see auction rows. The 4-day full plan rests on a parser reprobe and three scraper fixes that haven't been done.

---

## Deferred to v0.1

- Parser fix (auctionDate) — 3h reprobe + fix
- APN normalization (alphanumeric-only variant a; lifts 51% → 64%)
- Duval/Hillsborough/Brevard RA APN-selector fixes (the real path to 90%+)
- Real FUTURE_AUCTION + LIS_PENDENS scorer signals with signal-family MAX
- Filter chip, DetailCells, "Auction in Nd" secondary line
- Materialized AuctionSummary (only when row count justifies — probably >5k)
- DST-aware parseAuctionDate (EST vs EDT)
- Surplus-recovery signal for SOLD rows with surplusBid > 0

---

## Calibrated confidence

- Plan as originally written ships correct v0: **32%**
- Plan with 4 hard gates applied: **~75%**
- 1.5-day minimum as scoped above: **~85%**
