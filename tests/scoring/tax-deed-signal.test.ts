/**
 * Distress scorer v2.2 — TAX_DEED_APPLICATION signal + CONDITION_FAMILY
 * scaffolding tests (M2.2).
 *
 * TAX_DEED_APPLICATION lives in TAX_FAMILY: it must MAX against
 * TAX_DELINQUENT / LIEN_JUDGMENT (same underlying tax-distress dimension —
 * a deed application IS the escalation of the delinquency), and it must
 * proximity-decay on the scheduled sale date like FUTURE_AUCTION does.
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

describe('distress-scorer v2.2 — TAX_DEED_APPLICATION (M2.2)', () => {
  it('TAX_FAMILY contains TAX_DEED_APPLICATION; CONDITION_FAMILY scaffolding exists', () => {
    expect(SIGNAL_FAMILIES.TAX_FAMILY).toEqual(
      expect.arrayContaining(['TAX_DELINQUENT', 'LIEN_JUDGMENT', 'TAX_DEED_APPLICATION'])
    );
    expect(SIGNAL_FAMILIES.CONDITION_FAMILY).toEqual(
      expect.arrayContaining(['CODE_VIOLATION', 'SINKHOLE', 'STORM_DAMAGE', 'CONDEMNED'])
    );
  });

  it('proximity decay: sale in 10 days = 33, in 25 days = 28, in 45 days = 25, in 120 days = 20', () => {
    const at = (days: number) =>
      calculateDistressScoreFromProperty(
        blankInput({
          hasTaxDeedApplication: true,
          taxDeedSaleDate: new Date(Date.now() + days * 86400000),
        })
      ).score;

    expect(at(10)).toBe(33); // <= 14d: 28 + 5
    expect(at(25)).toBe(28); // <= 30d: base
    expect(at(45)).toBe(25); // <= 60d: 28 - 3
    expect(at(120)).toBe(20); // > 90d: 28 - 8
    // monotone non-increasing as the sale recedes
    expect(at(10)).toBeGreaterThan(at(45));
    expect(at(45)).toBeGreaterThan(at(120));
  });

  it('application without a scheduled sale date scores base 28', () => {
    const s = calculateDistressScoreFromProperty(
      blankInput({ hasTaxDeedApplication: true, taxDeedSaleDate: null })
    ).score;
    expect(s).toBe(28);
  });

  it('within TAX_FAMILY: TAX_DEED_APPLICATION does NOT stack with TAX_DELINQUENT (MAX, not sum)', () => {
    // Boosted TAX_DELINQUENT alone = 30 (20 + high-amount + multi-year + deed-eligible, capped).
    // TAX_DEED_APPLICATION with sale in 10 days = 33.
    // Together they must yield MAX(30, 33) = 33 — NOT 63.
    const s = calculateDistressScoreFromProperty(
      blankInput({
        taxDelinquent: true,
        estimatedValue: 200_000,
        taxDelinquentAmount: 30_000,
        taxDelinquentYearsCount: 3,
        taxDelinquentEarliestYear: new Date().getFullYear() - 3,
        hasTaxDeedApplication: true,
        taxDeedSaleDate: new Date(Date.now() + 10 * 86400000),
      })
    ).score;
    expect(s).toBe(33);
  });

  it('cross-family: TAX_DEED_APPLICATION + FUTURE_AUCTION are independent and sum', () => {
    // FORECLOSURE_FAMILY (FUTURE_AUCTION, 10d out = 30) + TAX_FAMILY
    // (TAX_DEED_APPLICATION, 10d out = 33) = 63.
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasScheduledAuction: true,
        nextAuctionDate: new Date(Date.now() + 10 * 86400000),
        hasTaxDeedApplication: true,
        taxDeedSaleDate: new Date(Date.now() + 10 * 86400000),
      })
    ).score;
    expect(s).toBe(63);
  });

  it('CONDITION_FAMILY remaining placeholders are 0-weighted: flags set, score unchanged', () => {
    // M3.2 wired CODE_VIOLATION; SINKHOLE / STORM_DAMAGE / CONDEMNED stay 0.
    const s = calculateDistressScoreFromProperty(
      blankInput({
        hasSinkhole: true,
        hasStormDamage: true,
        isCondemned: true,
      })
    );
    expect(s.score).toBe(0);
    for (const sig of s.signals) {
      expect(['SINKHOLE', 'STORM_DAMAGE', 'CONDEMNED']).toContain(sig.signal);
      expect(sig.weight).toBe(0);
    }
  });
});
