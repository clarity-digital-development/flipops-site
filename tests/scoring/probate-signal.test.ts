/**
 * Probate distress signals (M3.1 / Lane D2c).
 *
 * Probate lives in LIFE_EVENT_FAMILY (PROBATE-BUILD-SPEC §4):
 *   PROBATE_OPEN          base ~22 (HIGH)  — open estate administration; the
 *                         decedent owned the parcel, heirs are non-occupant +
 *                         emotionally done → gold-standard motivated seller.
 *   PROBATE_PR_APPOINTED  peak ~28        — PR/letters of administration issued;
 *                         a legal actor can now sell. Proximity boost (+4) when
 *                         the appointment is recent (peak-motivation window).
 *
 * TWO surfaces are verified:
 *   1. scoreProbateRow() — the materialized ProbateSummary score helper in
 *      scripts/rescore-probate.ts (UNION-ranking score; the SQL CASE mirrors it
 *      exactly). This is what ranks probate leads in /api/properties.
 *   2. The authoritative scorer (lib/scoring/distress-scorer.ts) LIFE_EVENT_FAMILY
 *      composition — MAX within family, SUM across families.
 *
 * NOTE for the integration lane: as of this commit the scorer's
 * LIFE_EVENT_FAMILY is ['INHERITED','DEATH_TRANSFER'] (15 pts each) — the
 * dedicated PROBATE_OPEN/PROBATE_PR_APPOINTED scorer signals + the
 * `hasProbateOpen`/`probatePrAppointed` PropertyScoreInput fields are NOT yet
 * wired into distress-scorer.ts (only CONDITION_FAMILY/code was added on disk).
 * Until they are, the at-promote scorer represents probate via the existing
 * `inherited`/`death` LIFE_EVENT flags (a matched open probate parcel IS an
 * inherited/death-transfer parcel). The materialized scoreProbateRow() helper
 * below already encodes the §4 weights and is authoritative for list ranking.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistressScore,
  SIGNAL_FAMILIES,
  type REAPIPropertyData,
} from '@/lib/scoring/distress-scorer';
import { scoreProbateRow } from '@/scripts/rescore-probate';

/**
 * Minimal partial → REAPIPropertyData. The scorer reads every distress flag via
 * `!!property.<flag>` so undefined fields are safely falsy; we only set the ones
 * a given assertion needs. (Same partial-cast pattern the scorer's own
 * `calculateDistressScoreFromProperty` adapter uses internally.)
 */
function scoreOf(flags: Partial<REAPIPropertyData>) {
  return calculateDistressScore(flags as REAPIPropertyData);
}

const NOW = new Date('2026-06-12T00:00:00Z');
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('probate materialized score — scoreProbateRow (ProbateSummary ranking)', () => {
  it('PROBATE_OPEN: open estate-admin case (EXACT match) scores 22 → grade D', () => {
    const r = scoreProbateRow({ caseTypeCode: 'FORMAL_ADMIN', prAppointedAt: null, matchConfidence: 1.0, now: NOW });
    expect(r.score).toBe(22);
    expect(r.grade).toBe('D');
  });

  it('PROBATE_OPEN applies to all estate-admin codes (FORMAL/SUMMARY/DISPOSITION)', () => {
    for (const code of ['FORMAL_ADMIN', 'SUMMARY_ADMIN', 'DISPOSITION_NO_ADMIN']) {
      expect(scoreProbateRow({ caseTypeCode: code, matchConfidence: 1.0, now: NOW }).score).toBe(22);
    }
  });

  it('PROBATE_PR_APPOINTED (recent): peak window adds the +4 proximity boost → 32', () => {
    const r = scoreProbateRow({
      caseTypeCode: 'FORMAL_ADMIN',
      prAppointedAt: daysFromNow(-30), // appointed 30 days ago — peak window
      matchConfidence: 1.0,
      now: NOW,
    });
    expect(r.score).toBe(32); // 28 base + 4 proximity
    expect(r.grade).toBe('D');
  });

  it('PROBATE_PR_APPOINTED (stale): outside the 90-day window → base 28, no boost', () => {
    const r = scoreProbateRow({
      caseTypeCode: 'FORMAL_ADMIN',
      prAppointedAt: daysFromNow(-200),
      matchConfidence: 1.0,
      now: NOW,
    });
    expect(r.score).toBe(28);
  });

  it('PR appointment outranks an open-only case (peak-motivation > gold-standard)', () => {
    const open = scoreProbateRow({ caseTypeCode: 'FORMAL_ADMIN', matchConfidence: 1.0, now: NOW });
    const pr = scoreProbateRow({ caseTypeCode: 'FORMAL_ADMIN', prAppointedAt: daysFromNow(-10), matchConfidence: 1.0, now: NOW });
    expect(pr.score).toBeGreaterThan(open.score);
  });

  it('STRONG (0.8) name match scores 2 pts below an EXACT (1.0) hit', () => {
    const exact = scoreProbateRow({ caseTypeCode: 'FORMAL_ADMIN', matchConfidence: 1.0, now: NOW });
    const strong = scoreProbateRow({ caseTypeCode: 'FORMAL_ADMIN', matchConfidence: 0.8, now: NOW });
    expect(exact.score).toBe(22);
    expect(strong.score).toBe(20);
  });

  it('non-estate-admin open case (guardianship/trust) gets the LIFE_EVENT placeholder weight 15', () => {
    expect(scoreProbateRow({ caseTypeCode: 'GUARDIANSHIP', matchConfidence: 1.0, now: NOW }).score).toBe(15);
    expect(scoreProbateRow({ caseTypeCode: 'TRUST', matchConfidence: 1.0, now: NOW }).score).toBe(15);
  });

  it('score is clamped to 0..100', () => {
    const r = scoreProbateRow({ caseTypeCode: 'OTHER', matchConfidence: 0.5, now: NOW });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('distress-scorer LIFE_EVENT_FAMILY — probate is represented via inherited/death (current scorer)', () => {
  it('LIFE_EVENT_FAMILY exists and contains the death-transfer / inherited signals probate maps onto', () => {
    expect(SIGNAL_FAMILIES.LIFE_EVENT_FAMILY).toEqual(
      expect.arrayContaining(['INHERITED', 'DEATH_TRANSFER'])
    );
  });

  it('a matched open-probate parcel (inherited) contributes the LIFE_EVENT weight', () => {
    // A parcel matched to an open probate case IS an inherited/death-transfer
    // parcel; the scorer surfaces it via the LIFE_EVENT flags until the
    // dedicated PROBATE_* signals are wired by the integration lane.
    const s = scoreOf({ inherited: true });
    expect(s.score).toBe(15);
    expect(s.signals.find((x) => x.signal === 'INHERITED')).toBeTruthy();
  });

  it('LIFE_EVENT MAXes within family (inherited + death do not stack)', () => {
    const s = scoreOf({ inherited: true, death: true });
    expect(s.score).toBe(15); // MAX(15,15), not 30
  });

  it('cross-family: probate life-event + tax delinquency sum independently', () => {
    // foreclosure flag drives FORECLOSURE_FAMILY; use an independent family
    // (vacancy) so the cross-family SUM is unambiguous: LIFE_EVENT 15 + VACANT 15.
    const s = scoreOf({ inherited: true, vacant: true });
    expect(s.score).toBe(30);
  });
});

describe('distress-scorer LIFE_EVENT_FAMILY — dedicated PROBATE_* signals (v2.3, M3.1 wired)', () => {
  it('LIFE_EVENT_FAMILY now contains the dedicated probate signals', () => {
    expect(SIGNAL_FAMILIES.LIFE_EVENT_FAMILY).toEqual(
      expect.arrayContaining(['PROBATE_OPEN', 'PROBATE_PR_APPOINTED']),
    );
  });

  it('PROBATE_OPEN: an open matched estate case contributes 22', () => {
    const s = scoreOf({ probateOpen: true } as Partial<REAPIPropertyData>);
    expect(s.score).toBe(22);
    expect(s.signals.find((x) => x.signal === 'PROBATE_OPEN')).toBeTruthy();
  });

  it('PROBATE_PR_APPOINTED: PR appointed contributes 28, recent-PR peaks at 32', () => {
    const appointed = scoreOf({ probatePrAppointed: true } as Partial<REAPIPropertyData>);
    expect(appointed.score).toBe(28);
    const recent = scoreOf({
      probatePrAppointed: true,
      probatePrAppointedRecent: true,
    } as Partial<REAPIPropertyData>);
    expect(recent.score).toBe(32);
  });

  it('LIFE_EVENT MAXes across probate + inherited (PR-recent 32 wins, no stack)', () => {
    const s = scoreOf({
      probateOpen: true,
      probatePrAppointed: true,
      probatePrAppointedRecent: true,
      inherited: true,
    } as Partial<REAPIPropertyData>);
    expect(s.score).toBe(32); // MAX(22, 32, 15), not summed
  });
});
