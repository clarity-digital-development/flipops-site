/**
 * Disposition net-sheet pure-library tests.
 *
 * Covers the seller net-proceeds math (commission / closing / payoff / net,
 * payoff clamped at 0), the list-vs-ARV variance classifier at the 1% default
 * and custom thresholds (incl. the +4.7% worked example), null guards on
 * non-positive inputs, and the canonical prep-checklist ordering.
 */

import { describe, it, expect } from 'vitest';
import {
  computeNetSheet,
  listVsArv,
  DEFAULT_PREP_CHECKLIST,
} from '@/lib/disposition/net-sheet';

describe('computeNetSheet', () => {
  it('computes commission, closing costs, payoff, and net proceeds with whole-dollar rounding', () => {
    const r = computeNetSheet({
      salePrice: 300_000,
      commissionPct: 6,
      closingCostPct: 1.5,
      payoffAmount: 120_000,
    });
    expect(r.salePrice).toBe(300_000);
    expect(r.commission).toBe(18_000); // 300k * 6%
    expect(r.closingCosts).toBe(4_500); // 300k * 1.5%
    expect(r.payoff).toBe(120_000);
    expect(r.netProceeds).toBe(157_500); // 300k - 18k - 4.5k - 120k
  });

  it('rounds each dollar output to the nearest whole dollar', () => {
    const r = computeNetSheet({
      salePrice: 312_345,
      commissionPct: 6,
      closingCostPct: 1.5,
      payoffAmount: 0,
    });
    // 312345 * 6% = 18740.7 → 18741; * 1.5% = 4685.175 → 4685
    expect(r.commission).toBe(18_741);
    expect(r.closingCosts).toBe(4_685);
    // net = 312345 - 18740.7 - 4685.175 - 0 = 288919.125 → 288919
    expect(r.netProceeds).toBe(288_919);
    expect(Number.isInteger(r.netProceeds)).toBe(true);
  });

  it('clamps a negative payoff amount to 0', () => {
    const r = computeNetSheet({
      salePrice: 250_000,
      commissionPct: 5,
      closingCostPct: 2,
      payoffAmount: -50_000,
    });
    expect(r.payoff).toBe(0);
    // net = 250k - 12.5k - 5k - 0
    expect(r.netProceeds).toBe(232_500);
  });
});

describe('listVsArv', () => {
  it('flags a list price above ARV beyond the 1% default threshold', () => {
    const r = listVsArv(320_000, 300_000);
    expect(r).not.toBeNull();
    expect(r!.diff).toBe(20_000);
    expect(r!.direction).toBe('above');
  });

  it('flags a list price below ARV beyond the threshold', () => {
    const r = listVsArv(270_000, 300_000);
    expect(r!.direction).toBe('below');
    expect(r!.diff).toBe(-30_000);
  });

  it("treats a sub-1% delta as 'inline' under the default threshold", () => {
    // 0.5% above → inline
    const r = listVsArv(301_500, 300_000);
    expect(r!.direction).toBe('inline');
    expect(Math.abs(r!.pct)).toBeLessThan(0.01);
  });

  it('respects a custom threshold (5% delta is inline at a 10% threshold)', () => {
    const r = listVsArv(315_000, 300_000, 0.1);
    expect(r!.pct).toBeCloseTo(0.05, 5);
    expect(r!.direction).toBe('inline');
  });

  it('matches the +4.7% worked example (listPrice 312000 vs arv 298000)', () => {
    const r = listVsArv(312_000, 298_000);
    expect(r!.diff).toBe(14_000);
    expect(r!.pct).toBeCloseTo(0.04698, 4);
    expect(r!.direction).toBe('above');
  });

  it('returns null when arv <= 0 or listPrice <= 0', () => {
    expect(listVsArv(300_000, 0)).toBeNull();
    expect(listVsArv(300_000, -1)).toBeNull();
    expect(listVsArv(0, 300_000)).toBeNull();
    expect(listVsArv(-5, 300_000)).toBeNull();
  });
});

describe('DEFAULT_PREP_CHECKLIST', () => {
  it('has exactly the 6 expected keys in order', () => {
    expect(DEFAULT_PREP_CHECKLIST.map((i) => i.key)).toEqual([
      'photos',
      'clean',
      'staging',
      'lockbox',
      'mls',
      'signage',
    ]);
  });

  it('pairs each key with its expected label', () => {
    expect(DEFAULT_PREP_CHECKLIST[0]).toEqual({ key: 'photos', label: 'Professional photos' });
    expect(DEFAULT_PREP_CHECKLIST[5]).toEqual({ key: 'signage', label: 'Yard sign + marketing' });
  });
});
