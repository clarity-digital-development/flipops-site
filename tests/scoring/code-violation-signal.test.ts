/**
 * Distress scorer v2.2 — CONDITION_FAMILY code-enforcement signals (M3.2).
 *
 * CODE_VIOLATION_OPEN (12), CODE_VIOLATION_MULTI (+6 at 3+ open), CODE_LIEN
 * (+8). They compose ADDITIVELY into a single CODE_VIOLATION contribution
 * (one escalating case load on one structure), capped at 26, and that
 * contribution MAXes against the other CONDITION_FAMILY placeholders. Across
 * families it sums independently with tax / foreclosure distress.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistressScoreFromProperty,
  SIGNAL_FAMILIES,
} from '@/lib/scoring/distress-scorer';
import type { PropertyScoreInput } from '@/lib/scoring/distress-scorer';

function blankInput(overrides: Partial<PropertyScoreInput> = {}): PropertyScoreInput {
  return {
    foreclosure: false,
    preForeclosure: false,
    taxDelinquent: false,
    vacant: false,
    bankruptcy: false,
    absenteeOwner: false,
    estimatedValue: null,
    assessedValue: null,
    taxDelinquentAmount: null,
    taxDelinquentYearsCount: null,
    taxDelinquentEarliestYear: null,
    hasScheduledAuction: false,
    nextAuctionDate: null,
    hasLisPendens: false,
    ...overrides,
  };
}

describe('distress-scorer v2.2 — CODE_VIOLATION (M3.2)', () => {
  it('CONDITION_FAMILY contains the code-enforcement signals', () => {
    expect(SIGNAL_FAMILIES.CONDITION_FAMILY).toEqual(
      expect.arrayContaining(['CODE_VIOLATION', 'CODE_VIOLATION_MULTI', 'CODE_LIEN'])
    );
  });

  it('single open violation scores 12', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({ hasCodeViolation: true, codeViolationOpenCount: 1 })
    );
    expect(s.score).toBe(12);
    const sig = s.signals.find((x) => x.signal === 'CODE_VIOLATION');
    expect(sig).toBeTruthy();
  });

  it('hasCodeViolation flag alone (no count) still scores 12', () => {
    const s = calculateDistressScoreFromProperty(blankInput({ hasCodeViolation: true }));
    expect(s.score).toBe(12);
  });

  it('3+ open violations add the MULTI boost: 12 + 6 = 18', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({ hasCodeViolation: true, codeViolationOpenCount: 4 })
    );
    expect(s.score).toBe(18);
    // 2 open should NOT trigger MULTI
    const two = calculateDistressScoreFromProperty(
      blankInput({ hasCodeViolation: true, codeViolationOpenCount: 2 })
    );
    expect(two.score).toBe(12);
  });

  it('a recorded code lien adds +8: open + lien = 20', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasCodeViolation: true,
        codeViolationOpenCount: 1,
        codeViolationHasLien: true,
      })
    );
    expect(s.score).toBe(20);
  });

  it('chronic + liened caps the combined contribution at 26 (12 + 6 + 8)', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasCodeViolation: true,
        codeViolationOpenCount: 9,
        codeViolationHasLien: true,
      })
    );
    expect(s.score).toBe(26);
  });

  it('no open violations → no code-violation contribution', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({ hasCodeViolation: false, codeViolationOpenCount: 0, codeViolationHasLien: false })
    );
    expect(s.score).toBe(0);
    expect(s.signals.find((x) => x.signal === 'CODE_VIOLATION')).toBeFalsy();
  });

  it('within CONDITION_FAMILY: MULTI/LIEN do not double-count (MAX, folded into CODE_VIOLATION)', () => {
    // The whole CONDITION_FAMILY (CODE_VIOLATION 26 + the 0-pt MULTI/LIEN
    // markers + 0-pt sinkhole/storm/condemned) must MAX to 26, not sum higher.
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasCodeViolation: true,
        codeViolationOpenCount: 5,
        codeViolationHasLien: true,
        hasSinkhole: true,
      })
    );
    expect(s.score).toBe(26);
  });

  it('cross-family: code violation + tax delinquency are independent and sum', () => {
    // CONDITION_FAMILY (CODE_VIOLATION open+lien = 20) + TAX_FAMILY
    // (TAX_DELINQUENT base = 20) = 40.
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasCodeViolation: true,
        codeViolationOpenCount: 1,
        codeViolationHasLien: true,
        taxDelinquent: true,
      })
    );
    expect(s.score).toBe(40);
  });

  it('cross-family: chronic code violation boosts a foreclosure parcel above the A threshold', () => {
    // FORECLOSURE_FAMILY (PRE_FORECLOSURE 25) alone = 25 (grade D).
    // Add CONDITION_FAMILY chronic+lien (26) + ABSENTEE (12) → 63, near A.
    const base = calculateDistressScoreFromProperty(blankInput({ preForeclosure: true }));
    expect(base.score).toBe(25);
    const boosted = calculateDistressScoreFromProperty(
      blankInput({
        preForeclosure: true,
        hasCodeViolation: true,
        codeViolationOpenCount: 4,
        codeViolationHasLien: true,
        absenteeOwner: true,
      })
    );
    expect(boosted.score).toBe(63);
    expect(boosted.score).toBeGreaterThan(base.score);
  });
});
