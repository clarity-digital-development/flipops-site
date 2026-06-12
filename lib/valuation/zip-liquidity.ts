// ---------------------------------------------------------------------------
// ZIP liquidity — turn ZipMarketStats.saleVelocity12mo into a tradeable
// liquidity grade (A–F) and a DATA-DRIVEN holding-period default (days) for the
// MAO / Exit-Scenarios math. Replaces the static 90-day rehab+marketing
// assumption that the MAO waterfall shipped with.
//
// WHY velocity → days: saleVelocity12mo is a turnover RATE = (qualified sales
// in trailing 12mo) / (parcel count in the ZIP). A rate, not a raw count, so a
// dense Miami-Dade ZIP and a rural ZIP compare on the same axis (schema note on
// ZipMarketStats.saleVelocity12mo). A higher rate means homes change hands more
// often → a flipper re-lists into a faster market → shorter realistic hold; a
// lower rate means a thinner buyer pool → longer time-to-sale → longer hold.
//
// The grade cuts are anchored to the LIVE FL distribution measured 2026-06-12
// over ZipMarketStats rows with sampleSize >= 10:
//   p10 0.0060 · p25 0.0077 · p50 0.0101 · p75 0.0155 · p90 0.0243
// so a "C" ZIP is genuinely the FL median, "A" is top-decile liquid, and "F"
// is bottom-decile illiquid. These are pure constants (no DB round-trip) so the
// helper is usable on the client (the MAO holding default) and the server (the
// /api/valuation enrichment) alike.
//
// holdingDays is the WHOLE-deal default (acquisition rehab + time-to-sell), the
// quantity the MAO waterfall multiplies by holdingPerDay. The static prior was
// 90; we keep 90 as the C-grade (FL-median) anchor and fan out by liquidity:
// fast markets sell quicker (down to 60), slow markets drag (up to 150). The
// numbers are deliberately round, defensible defaults — a user can still
// override holdingPerDay / rehabDays in the assumptions panel.
// ---------------------------------------------------------------------------

export type LiquidityGrade = "A" | "B" | "C" | "D" | "F";

export interface ZipLiquidity {
  /** A (most liquid) … F (least). */
  grade: LiquidityGrade;
  /** Data-driven whole-deal holding-period default in days for MAO/Exit math. */
  holdingDays: number;
  /** The raw turnover rate this was derived from (annualized fraction). */
  saleVelocity12mo: number;
  /** Sales sample backing the velocity — small samples shrink toward median. */
  sampleSize: number;
  /** Human label for the UI chip. */
  label: string;
  /** True when sampleSize was too small to trust the ZIP's own velocity. */
  lowConfidence: boolean;
}

// FL-distribution-anchored grade cuts (turnover rate, trailing 12mo).
// Read as: velocity >= threshold → at least this grade.
const GRADE_CUTS: Array<{ grade: LiquidityGrade; min: number; days: number; label: string }> = [
  { grade: "A", min: 0.0243, days: 60, label: "Very liquid" }, // >= p90
  { grade: "B", min: 0.0155, days: 75, label: "Liquid" }, //       >= p75
  { grade: "C", min: 0.0077, days: 90, label: "Average" }, //      >= p25 (median band)
  { grade: "D", min: 0.006, days: 120, label: "Slow" }, //         >= p10
  { grade: "F", min: 0, days: 150, label: "Illiquid" }, //         < p10
];

// FL median velocity — the shrinkage target for small-sample ZIPs and the
// fallback when a ZIP has no stats at all.
const FL_MEDIAN_VELOCITY = 0.0101;

// Below this many qualified sales, the ZIP's own velocity is noisy; shrink it
// toward the FL median (simple James-Stein-flavored blend) before grading. The
// schema explicitly warns consumers not to trust a median of 3 sales.
const MIN_TRUSTWORTHY_SAMPLE = 30;

/** Map a (possibly shrunk) velocity to its grade row. */
function gradeForVelocity(velocity: number) {
  for (const cut of GRADE_CUTS) {
    if (velocity >= cut.min) return cut;
  }
  return GRADE_CUTS[GRADE_CUTS.length - 1];
}

/**
 * Derive liquidity grade + holding-day default from a ZIP's velocity.
 *
 * @param saleVelocity12mo trailing-12mo turnover rate (null when unknown).
 * @param sampleSize       qualified-sale count backing the velocity.
 *
 * Honest absence: a null velocity returns the FL-median ("C", 90d) so the MAO
 * math always has a sane default, but `lowConfidence` is set and the label says
 * the grade is a statewide fallback — the UI can disclose that.
 */
export function computeZipLiquidity(
  saleVelocity12mo: number | null | undefined,
  sampleSize: number | null | undefined,
): ZipLiquidity {
  const n = Math.max(0, Math.floor(sampleSize ?? 0));

  // No data → FL-median fallback, flagged low-confidence.
  if (saleVelocity12mo == null || !Number.isFinite(saleVelocity12mo) || saleVelocity12mo <= 0) {
    const cut = gradeForVelocity(FL_MEDIAN_VELOCITY);
    return {
      grade: cut.grade,
      holdingDays: cut.days,
      saleVelocity12mo: 0,
      sampleSize: n,
      label: `${cut.label} (FL avg)`,
      lowConfidence: true,
    };
  }

  // Small-sample shrinkage toward the FL median. Weight grows with n up to the
  // trustworthy threshold; at/above it the ZIP's own velocity is used straight.
  const w = Math.min(1, n / MIN_TRUSTWORTHY_SAMPLE);
  const shrunk = w * saleVelocity12mo + (1 - w) * FL_MEDIAN_VELOCITY;

  const cut = gradeForVelocity(shrunk);
  const lowConfidence = n < MIN_TRUSTWORTHY_SAMPLE;
  return {
    grade: cut.grade,
    holdingDays: cut.days,
    saleVelocity12mo,
    sampleSize: n,
    label: lowConfidence ? `${cut.label} (thin data)` : cut.label,
    lowConfidence,
  };
}

/** Tailwind-friendly color token per grade, for badges/chips. */
export function liquidityGradeColor(grade: LiquidityGrade): string {
  switch (grade) {
    case "A":
      return "emerald";
    case "B":
      return "lime";
    case "C":
      return "amber";
    case "D":
      return "orange";
    case "F":
      return "rose";
  }
}
