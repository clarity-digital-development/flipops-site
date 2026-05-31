/**
 * REAPI Distress Scoring Algorithm v2.0
 *
 * Calculates a distress/motivation score from REAPI property data.
 * Higher score = more distressed/motivated seller
 *
 * Updated 2025-12-13 per FlipOps_Distress_Scoring_Logic v2.0
 * Key changes from v1:
 * - LONG_TERM_OWNER: 10 -> 15 pts
 * - ABSENTEE_OWNER (in-state): 10 -> 12 pts
 * - Grade thresholds adjusted (A: 65+, B: 50-64, C: 35-49, D: 20-34)
 * - Added QUIT_CLAIM signal (5 pts)
 */

import type { REAPIPropertyData } from '../types';

export interface DistressScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  signals: DistressSignal[];
  motivation: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

export interface DistressSignal {
  signal: string;
  weight: number;
  present: boolean;
  description: string;
}

/**
 * Calculate distress score from REAPI property data
 * Works with REAPIPropertyData from search responses
 */
export function calculateDistressScore(property: REAPIPropertyData): DistressScore {
  const signals: DistressSignal[] = [];
  let totalScore = 0;

  // ============================================
  // HIGH-VALUE SIGNALS (20-25 points each)
  // ============================================

  // Pre-foreclosure / NOD / Lis Pendens
  signals.push({
    signal: 'PRE_FORECLOSURE',
    weight: 25,
    present: property.preForeclosure || false,
    description: 'Property has active pre-foreclosure filing',
  });
  if (property.preForeclosure) totalScore += 25;

  // Active auction / foreclosure
  signals.push({
    signal: 'AUCTION',
    weight: 25,
    present: property.auction || property.foreclosure || false,
    description: 'Property scheduled for foreclosure auction',
  });
  if (property.auction || property.foreclosure) totalScore += 25;

  // Liens / Judgments / Tax Lien
  const hasLienOrJudgment = property.taxLien || property.judgment;
  signals.push({
    signal: 'LIEN_JUDGMENT',
    weight: 20,
    present: hasLienOrJudgment || false,
    description: 'Property has active liens or judgments',
  });
  if (hasLienOrJudgment) totalScore += 20;

  // === NEW: County tax-delinquent (FL scraper data, Option A) ===
  // Separate from LIEN_JUDGMENT because REAPI's taxLien field never fires
  // for our scraped FL data. Base +20 (matches LIEN_JUDGMENT weight per
  // FlipOps_Distress_Scoring_Logic v2.0). Boosts for high amount, multi-year,
  // and FL Ch. 197 tax-deed eligibility. Capped at +30 total contribution.
  // NO time-decay — older FL tax certificates are MORE motivating (closer to
  // forced sale), not less.
  const td = property.isTaxDelinquent || false;
  const tdAmount = property.taxDelinquentAmount || 0;
  const tdYears = property.taxDelinquentYearsCount || 0;
  const tdEarliestYear = property.taxDelinquentEarliestYear;
  const tdCurrentYear = new Date().getFullYear();
  const tdDeedEligible = tdEarliestYear ? (tdCurrentYear - tdEarliestYear) >= 2 : false;
  const tdEstValue = property.estimatedValue || 0;
  const tdHighAmount = tdAmount > 50000 || (tdEstValue > 0 && tdAmount / tdEstValue > 0.1);

  let tdPts = 0;
  if (td) {
    tdPts = 20;
    if (tdHighAmount) tdPts += 5;
    if (tdYears >= 2) tdPts += 5;
    if (tdDeedEligible) tdPts += 5;
    tdPts = Math.min(tdPts, 30);
  }

  signals.push({
    signal: 'TAX_DELINQUENT',
    weight: 20, // base weight reported; boost rolled into totalScore
    present: td,
    description: td
      ? `Tax delinquent${tdEarliestYear ? ` since ${tdEarliestYear}` : ''}` +
        `${tdAmount > 0 ? ` ($${tdAmount.toLocaleString()})` : ''}` +
        `${tdYears > 1 ? ` · ${tdYears} certificates` : ''}` +
        `${tdDeedEligible ? ' · deed-eligible' : ''}`
      : 'Property tax delinquent (FL county data)',
  });
  if (td) totalScore += tdPts;

  // ============================================
  // MEDIUM-VALUE SIGNALS (10-15 points each)
  // ============================================

  // Vacant property
  signals.push({
    signal: 'VACANT',
    weight: 15,
    present: property.vacant || false,
    description: 'Property appears to be vacant',
  });
  if (property.vacant) totalScore += 15;

  // Out-of-state absentee owner
  signals.push({
    signal: 'OUT_OF_STATE_OWNER',
    weight: 15,
    present: property.outOfStateAbsenteeOwner || false,
    description: 'Owner lives out of state',
  });
  if (property.outOfStateAbsenteeOwner) totalScore += 15;

  // In-state absentee owner (lower value than out-of-state)
  const inStateAbsentee = property.inStateAbsenteeOwner && !property.outOfStateAbsenteeOwner;
  signals.push({
    signal: 'ABSENTEE_OWNER',
    weight: 12,
    present: inStateAbsentee || (property.absenteeOwner && !property.outOfStateAbsenteeOwner),
    description: 'Owner lives elsewhere in state',
  });
  if (inStateAbsentee || (property.absenteeOwner && !property.outOfStateAbsenteeOwner)) {
    totalScore += 12;
  }

  // Inherited property
  signals.push({
    signal: 'INHERITED',
    weight: 15,
    present: property.inherited || false,
    description: 'Property was inherited',
  });
  if (property.inherited) totalScore += 15;

  // Death transfer
  signals.push({
    signal: 'DEATH_TRANSFER',
    weight: 15,
    present: property.death || false,
    description: 'Property transferred due to death',
  });
  if (property.death) totalScore += 15;

  // ============================================
  // LOWER-VALUE SIGNALS (5-10 points each)
  // ============================================

  // High equity (motivated but not necessarily distressed)
  const equityPct = property.equityPercent || 0;
  const isHighEquity = property.highEquity && equityPct > 50;
  signals.push({
    signal: 'HIGH_EQUITY',
    weight: 10,
    present: isHighEquity,
    description: `Owner has ${equityPct}% equity`,
  });
  if (isHighEquity) totalScore += 10;

  // Free and clear
  signals.push({
    signal: 'FREE_CLEAR',
    weight: 5,
    present: property.freeClear || false,
    description: 'No mortgage on property',
  });
  if (property.freeClear) totalScore += 5;

  // Long-term ownership (tired landlord potential) - increased from 10 to 15 in v2.0
  const ownershipYears = property.yearsOwned || 0;
  const isLongTermOwner = ownershipYears > 15;
  if (ownershipYears > 0) {
    signals.push({
      signal: 'LONG_TERM_OWNER',
      weight: 15,
      present: isLongTermOwner,
      description: `Owner has held property ${ownershipYears} years`,
    });
    if (isLongTermOwner) totalScore += 15;
  }

  // Corporate owned
  signals.push({
    signal: 'CORPORATE_OWNED',
    weight: 5,
    present: property.corporateOwned || false,
    description: 'Owned by corporation/LLC',
  });
  if (property.corporateOwned) totalScore += 5;

  // Multiple properties (portfolio owner / tired landlord)
  const totalOwned = parseInt(property.totalPropertiesOwned || '0');
  const isPortfolioOwner = totalOwned > 3 && property.absenteeOwner;
  if (totalOwned > 1) {
    signals.push({
      signal: 'PORTFOLIO_OWNER',
      weight: 10,
      present: isPortfolioOwner,
      description: `Owner has ${totalOwned} properties`,
    });
    if (isPortfolioOwner) totalScore += 10;
  }

  // REO (bank owned)
  signals.push({
    signal: 'REO',
    weight: 10,
    present: property.reo || false,
    description: 'Bank-owned property (REO)',
  });
  if (property.reo) totalScore += 10;

  // Negative equity (underwater)
  signals.push({
    signal: 'NEGATIVE_EQUITY',
    weight: 15,
    present: property.negativeEquity || false,
    description: 'Property is underwater (owes more than value)',
  });
  if (property.negativeEquity) totalScore += 15;

  // Price reduced on MLS (motivated seller)
  signals.push({
    signal: 'PRICE_REDUCED',
    weight: 10,
    present: property.priceReduced || false,
    description: 'Price reduced on MLS listing',
  });
  if (property.priceReduced) totalScore += 10;

  // Private lender (often hard money, may be distressed)
  signals.push({
    signal: 'PRIVATE_LENDER',
    weight: 10,
    present: property.privateLender || false,
    description: 'Property financed with private/hard money',
  });
  if (property.privateLender) totalScore += 10;

  // Adjustable rate mortgage (payment shock potential)
  signals.push({
    signal: 'ADJUSTABLE_RATE',
    weight: 5,
    present: property.adjustableRate || false,
    description: 'Has adjustable rate mortgage',
  });
  if (property.adjustableRate) totalScore += 5;

  // Quit claim deed transfer (potential distress indicator)
  const isQuitClaim = property.documentType?.toLowerCase().includes('quit claim') ||
                      property.documentTypeCode === 'QC';
  signals.push({
    signal: 'QUIT_CLAIM',
    weight: 5,
    present: isQuitClaim || false,
    description: 'Property transferred via quit claim deed',
  });
  if (isQuitClaim) totalScore += 5;

  // ============================================
  // CALCULATE FINAL SCORE
  // ============================================

  // Cap at 100
  const finalScore = Math.min(totalScore, 100);

  // Determine grade (v2.0 thresholds - adjusted for realistic signal stacking)
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (finalScore >= 65) grade = 'A';
  else if (finalScore >= 50) grade = 'B';
  else if (finalScore >= 35) grade = 'C';
  else if (finalScore >= 20) grade = 'D';
  else grade = 'F';

  // Determine motivation level (v2.0 - aligned with grade thresholds)
  let motivation: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  if (finalScore >= 50) motivation = 'HIGH';
  else if (finalScore >= 35) motivation = 'MEDIUM';
  else if (finalScore >= 20) motivation = 'LOW';
  else motivation = 'NONE';

  return {
    score: finalScore,
    grade,
    signals: signals.filter((s) => s.present), // Only return present signals
    motivation,
  };
}

/**
 * Quick score calculation without full signal breakdown
 * Use when you just need the number
 * Updated v2.0 - matches calculateDistressScore weights
 */
export function quickDistressScore(property: REAPIPropertyData): number {
  let score = 0;

  // High-value signals (20-25 pts)
  if (property.preForeclosure) score += 25;
  if (property.auction || property.foreclosure) score += 25;
  if (property.taxLien || property.judgment) score += 20;

  // County tax-delinquent (FL scraper data, Option A) — mirror of the full
  // scorer's TAX_DELINQUENT branch, kept in sync.
  if (property.isTaxDelinquent) {
    let tdPts = 20;
    const tdAmount = property.taxDelinquentAmount || 0;
    const tdEstValue = property.estimatedValue || 0;
    const tdHigh = tdAmount > 50000 || (tdEstValue > 0 && tdAmount / tdEstValue > 0.1);
    if (tdHigh) tdPts += 5;
    if ((property.taxDelinquentYearsCount || 0) >= 2) tdPts += 5;
    const ey = property.taxDelinquentEarliestYear;
    if (ey && (new Date().getFullYear() - ey) >= 2) tdPts += 5;
    score += Math.min(tdPts, 30);
  }

  // Medium-value signals (10-15 pts)
  if (property.vacant) score += 15;
  if (property.outOfStateAbsenteeOwner) score += 15;
  else if (property.absenteeOwner || property.inStateAbsenteeOwner) score += 12; // v2.0: 10 -> 12
  if (property.inherited) score += 15;
  if (property.death) score += 15;
  if (property.negativeEquity) score += 15;

  // Long-term owner (v2.0: 10 -> 15 pts)
  const yearsOwned = property.yearsOwned || 0;
  if (yearsOwned > 15) score += 15;

  // Lower-value signals (5-10 pts)
  if (property.highEquity && property.equityPercent > 50) score += 10;
  if (property.reo) score += 10;
  if (property.priceReduced) score += 10;
  if (property.privateLender) score += 10;

  // Portfolio owner bonus (4+ properties AND absentee)
  const totalOwned = parseInt(property.totalPropertiesOwned || '0');
  if (totalOwned >= 4 && property.absenteeOwner) score += 10;

  // Lower-value signals (5 pts)
  if (property.freeClear) score += 5;
  if (property.corporateOwned) score += 5;
  if (property.adjustableRate) score += 5;

  // Quit claim deed (v2.0 new signal)
  const isQuitClaim = property.documentType?.toLowerCase().includes('quit claim') ||
                      property.documentTypeCode === 'QC';
  if (isQuitClaim) score += 5;

  return Math.min(score, 100);
}

/**
 * Combine REAPI distress score with existing scoring from investor profile
 * This allows using both the distress signals AND investor preferences
 */
export function combineWithProfileScore(
  reapiDistressScore: number,
  profileScore: number,
  weights: { distress: number; profile: number } = { distress: 0.6, profile: 0.4 }
): number {
  const combined = reapiDistressScore * weights.distress + profileScore * weights.profile;
  return Math.round(Math.min(combined, 100));
}

// ---------------------------------------------------------------------------
// Property-shaped scorer (Option A Phase A3 — leads-UI integration entry point)
//
// Adapts a Prisma Property row (or a virtual lead synthesized from
// Parcel+Lien) into the REAPI scorer shape. Used by:
//   - /api/properties/[id]/score/recompute (manual re-score from drawer)
//   - The promote-on-engagement flow (when virtual → tenant-owned)
//   - lib/cron/jobs that batch-score newly-ingested Property rows
//
// Virtual leads pass an in-memory partial Property object built from the
// TaxDelinquencySummary + Parcel join — the same fields apply.
// ---------------------------------------------------------------------------

/** Minimal Property-row shape the score function reads. Subset of Prisma's Property. */
export interface PropertyScoreInput {
  foreclosure: boolean;
  preForeclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  bankruptcy: boolean;
  absenteeOwner: boolean;
  estimatedValue: number | null;
  assessedValue: number | null;
  taxDelinquentAmount: number | null;
  taxDelinquentYearsCount: number | null;
  taxDelinquentEarliestYear: number | null;
}

export function calculateDistressScoreFromProperty(p: PropertyScoreInput): DistressScore {
  // Adapt PrismaProperty → REAPIPropertyData shape (partial — only the fields
  // the scorer actually reads). REAPI-specific signals (preForeclosure /
  // foreclosure / vacant / absenteeOwner) flow straight through; the
  // tax-delinquent fields flow into the new TAX_DELINQUENT branch.
  const adapted: Partial<REAPIPropertyData> = {
    foreclosure: p.foreclosure,
    preForeclosure: p.preForeclosure,
    vacant: p.vacant,
    absenteeOwner: p.absenteeOwner,
    estimatedValue: p.estimatedValue ?? undefined,
    // Tax-delinquent specific (the new path)
    isTaxDelinquent: p.taxDelinquent,
    taxDelinquentAmount: p.taxDelinquentAmount ?? undefined,
    taxDelinquentYearsCount: p.taxDelinquentYearsCount ?? undefined,
    taxDelinquentEarliestYear: p.taxDelinquentEarliestYear ?? undefined,
  };
  return calculateDistressScore(adapted as REAPIPropertyData);
}
