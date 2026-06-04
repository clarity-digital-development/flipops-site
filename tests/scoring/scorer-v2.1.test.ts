/**
 * Distress scorer v2.1 — signal-family MAX composition tests
 * HG4 hard-gate from verifier: foreclosure-family signals must not stack
 * additively. Tax-family and foreclosure-family ARE independent, so they sum.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistressScore,
  calculateDistressScoreFromProperty,
  SIGNAL_FAMILIES,
} from '@/lib/reapi/utils/distress-scorer';
import type { REAPIPropertyData } from '@/lib/reapi/types';

/** Build a fully-zeroed REAPIPropertyData shell so each test isolates the signals under test. */
function blankProperty(overrides: Partial<REAPIPropertyData> = {}): REAPIPropertyData {
  return {
    // Foreclosure family
    foreclosure: false,
    preForeclosure: false,
    auction: false,
    // Tax family
    taxLien: false,
    judgment: false,
    isTaxDelinquent: false,
    // Vacancy / absentee / life
    vacant: false,
    outOfStateAbsenteeOwner: false,
    inStateAbsenteeOwner: false,
    absenteeOwner: false,
    inherited: false,
    death: false,
    // Equity
    highEquity: false,
    equityPercent: 0,
    freeClear: false,
    negativeEquity: false,
    // Ownership
    yearsOwned: 0,
    totalPropertiesOwned: '0',
    corporateOwned: false,
    // Bank / listing / financing / transfer
    reo: false,
    priceReduced: false,
    privateLender: false,
    adjustableRate: false,
    documentType: '',
    documentTypeCode: '',
    ...overrides,
  } as unknown as REAPIPropertyData;
}

describe('distress-scorer v2.1 — signal-family MAX (HG4 hard-gate)', () => {
  it('test 1: FORECLOSURE + AUCTION + PRE_FORECLOSURE together MUST NOT score 75 (family-MAX, not sum)', () => {
    // All three foreclosure-family signals fire. v2.0 would give 25+25+25 = 75 = grade A.
    // v2.1 must take MAX within the family = ~25, capping the foreclosure dimension.
    const p = blankProperty({
      foreclosure: true,
      preForeclosure: true,
      auction: true,
    });
    const { score, grade, signals } = calculateDistressScore(p);

    // Sanity: all three contributing signals are reported as present.
    const present = signals.map((s) => s.signal);
    expect(present).toContain('PRE_FORECLOSURE');
    expect(present).toContain('AUCTION');

    // The pre-v2.1 additive bug would put this at 75. v2.1 must cap it.
    expect(score).toBeLessThan(50); // i.e. NOT grade A
    // Family MAX of three 25-pt signals = 25 (nothing else firing).
    expect(score).toBe(25);
    expect(grade).toBe('D'); // 20-34 = D
  });

  it('test 2: TAX_DELINQUENT + FUTURE_AUCTION are independent families and DO sum', () => {
    // TAX_FAMILY contributes 30 (boosted), FORECLOSURE_FAMILY contributes 25-30 (FUTURE_AUCTION base + proximity).
    // Expected: ~50+, demonstrating independent-family additive composition.
    const auctionIn10Days = new Date(Date.now() + 10 * 86400000);
    const score = calculateDistressScoreFromProperty({
      foreclosure: false,
      preForeclosure: false,
      taxDelinquent: true,
      vacant: false,
      bankruptcy: false,
      absenteeOwner: false,
      estimatedValue: 200_000,
      assessedValue: 180_000,
      taxDelinquentAmount: 30_000, // > 10% of est value → high-amount boost
      taxDelinquentYearsCount: 3, // multi-year boost
      taxDelinquentEarliestYear: new Date().getFullYear() - 3, // deed-eligible boost
      hasScheduledAuction: true,
      nextAuctionDate: auctionIn10Days, // <= 14 days → +5 proximity boost
      hasLisPendens: false,
    }).score;

    // TAX_DELINQUENT capped at 30 + FUTURE_AUCTION at 30 = 60.
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBe(60);
  });

  it('test 3: FUTURE_AUCTION decays by proximity — 5 days out scores higher than 60 days out', () => {
    const near = calculateDistressScoreFromProperty({
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
      hasScheduledAuction: true,
      nextAuctionDate: new Date(Date.now() + 5 * 86400000),
      hasLisPendens: false,
    }).score;

    const far = calculateDistressScoreFromProperty({
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
      hasScheduledAuction: true,
      nextAuctionDate: new Date(Date.now() + 60 * 86400000),
      hasLisPendens: false,
    }).score;

    expect(near).toBeGreaterThan(far);
    // 5 days out → 25 + 5 boost = 30
    expect(near).toBe(30);
    // 60 days out → 25 - 3 decay = 22
    expect(far).toBe(22);
  });

  it('SIGNAL_FAMILIES export: foreclosure family contains all 5 expected members', () => {
    expect(SIGNAL_FAMILIES.FORECLOSURE_FAMILY).toEqual(
      expect.arrayContaining(['FORECLOSURE', 'PRE_FORECLOSURE', 'AUCTION', 'FUTURE_AUCTION', 'LIS_PENDENS'])
    );
    expect(SIGNAL_FAMILIES.TAX_FAMILY).toEqual(expect.arrayContaining(['TAX_DELINQUENT']));
  });

  it('cross-family stacking: foreclosure + tax + vacant + absentee correctly sums independent dimensions', () => {
    // Independent dimensions should sum: 25 (FC) + 20 (TD base) + 15 (vacant) + 15 (OOS owner) = 75.
    const p = blankProperty({
      preForeclosure: true,
      isTaxDelinquent: true,
      vacant: true,
      outOfStateAbsenteeOwner: true,
    });
    const { score, grade } = calculateDistressScore(p);
    expect(score).toBe(75);
    expect(grade).toBe('A');
  });

  it('within-family de-dup: PRE_FORECLOSURE + LIS_PENDENS does NOT double-count (MAX = 25)', () => {
    const p = blankProperty({ preForeclosure: true });
    // Inject hasLisPendens via the Property-shape path so we hit the v2.1 field.
    const s = calculateDistressScoreFromProperty({
      foreclosure: false,
      preForeclosure: true,
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
      hasLisPendens: true,
    }).score;
    // MAX(PRE_FORECLOSURE=25, LIS_PENDENS=22) = 25. NOT 47.
    expect(s).toBe(25);
    // Belt-and-suspenders: the plain-shell variant still computes the same when only pre-fc fires.
    expect(calculateDistressScore(p).score).toBe(25);
  });
});
