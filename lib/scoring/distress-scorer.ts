/**
 * Distress Scoring Algorithm v2.1
 *
 * Calculates a distress/motivation score for a property.
 * Higher score = more distressed/motivated seller
 *
 * History: originally lived at lib/reapi/utils/distress-scorer.ts (the REAPI
 * integration is gone — self-scraped data is the source now). The input shape
 * (`REAPIPropertyData`, aliased `PropertyDistressInput`) is inlined below; it
 * retains the REAPI field names because the scorer, tests, and UNION builder
 * all speak that shape.
 *
 * Updated 2026-06-04 per HG4 hard-gate (M2.2):
 * - **Signal-family MAX composition**: signals in the same family (e.g.
 *   FORECLOSURE + AUCTION + PRE_FORECLOSURE are all foreclosure-family)
 *   no longer stack additively — we take MAX within family, then SUM
 *   across independent families. This prevents every foreclosure parcel
 *   from auto-scoring 75+ (=grade A indiscriminately).
 * - Added FUTURE_AUCTION signal (25 base, +5 within 14 days, capped 30)
 *   with proximity decay (closer auction date → higher score).
 * - Added LIS_PENDENS signal (22 base).
 * - PropertyScoreInput extended with hasScheduledAuction / nextAuctionDate
 *   / hasLisPendens — populated by the UNION builder in M2.3.
 *
 * v2.0 baseline (2025-12-13):
 * - LONG_TERM_OWNER: 10 -> 15 pts
 * - ABSENTEE_OWNER (in-state): 10 -> 12 pts
 * - Grade thresholds adjusted (A: 65+, B: 50-64, C: 35-49, D: 20-34)
 * - Added QUIT_CLAIM signal (5 pts)
 */

/**
 * Scorer version constant — persisted into LeadEvent.leadSnapshot on every
 * scored behavioral event (M1.1 step 7) so training data is reproducible
 * across scorer revisions. Bump whenever weights/families/signals change.
 */
export const SCORER_VERSION = "2.1";

/**
 * Property data shape the scorer reads (formerly REAPI search-response shape).
 * Fields are at root level, not nested.
 */
export interface REAPIPropertyData {
  // ID
  id: string;
  propertyId: string;

  // Address (nested object)
  address: {
    address: string;
    city: string;
    county: string;
    fips: string;
    state: string;
    street: string;
    zip: string;
  };

  // Mailing address (nested object)
  mailAddress?: {
    address: string;
    city: string;
    state: string;
    street: string;
    zip: string;
  };

  // Property characteristics
  propertyType: string;
  propertyUse: string;
  propertyUseCode: number;
  landUse: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number;
  lotSquareFeet: number;
  yearBuilt: number | null;
  stories: number;
  roomsCount: number;
  unitsCount: number;

  // Owner info
  owner1LastName: string;
  companyName?: string;

  // Financial
  estimatedValue: number;
  estimatedEquity: number;
  equityPercent: number;
  assessedValue: number;
  assessedLandValue: number;
  assessedImprovementValue: number;
  openMortgageBalance: number;
  estimatedMortgagePayment: number;

  // Sale info
  lastSaleAmount: string;
  lastSaleDate?: string;
  lastSaleArmsLength?: boolean;
  priorSaleAmount?: string | null;
  priorSaleDate?: string | null;

  // Portfolio info
  totalPropertiesOwned: string;
  totalPortfolioValue: string;
  totalPortfolioEquity: string;
  totalPortfolioMortgageBalance: string;
  portfolioPurchasedLast12Months: number;
  portfolioPurchasedLast6Months: number;

  // Distress flags - ALL AVAILABLE AT ROOT LEVEL
  absenteeOwner: boolean;
  auction: boolean;
  cashBuyer: boolean;
  corporateOwned: boolean;
  death: boolean;
  foreclosure: boolean;
  forSale: boolean;
  freeClear: boolean;
  highEquity: boolean;
  inherited: boolean;
  inStateAbsenteeOwner: boolean;
  investorBuyer: boolean;
  judgment: boolean;
  negativeEquity: boolean;
  outOfStateAbsenteeOwner: boolean;
  ownerOccupied: boolean;
  preForeclosure: boolean;
  privateLender: boolean;
  reo: boolean;
  taxLien: boolean | null;
  vacant: boolean;

  // === Florida tax-delinquent integration (Option A, 2026-05-31) ===
  // These are separate from `taxLien` (REAPI's nationwide field) because
  // our FL scraper data fills these and REAPI's taxLien never fires for it.
  // Hydrated from TaxDelinquencySummary at API serialization time.
  /** True if any unpaid tax certificate exists for this APN in flipops.Lien */
  isTaxDelinquent?: boolean;
  /** SUM of Lien.amount WHERE lienCategory='tax' for this APN (USD) */
  taxDelinquentAmount?: number;
  /** COUNT of distinct delinquent tax years on this APN */
  taxDelinquentYearsCount?: number;
  /** MIN tax year — used for FL Ch. 197 tax-deed eligibility (>=2 yrs old) */
  taxDelinquentEarliestYear?: number;

  // MLS status
  mlsActive: boolean;
  mlsCancelled: boolean;
  mlsFailed: boolean;
  mlsHasPhotos: boolean;
  mlsPending: boolean;
  mlsSold: boolean;
  mlsListingPrice: number | null;
  mlsLastSaleDate?: string;
  listingAmount: number | null;
  priceReduced: boolean;

  // Additional details
  apn: string;
  latitude: number;
  longitude: number;
  medianIncome: string;
  yearsOwned: number | null;
  pricePerSquareFoot: number;
  floodZone: boolean;

  // Building features
  pool: boolean;
  poolArea: number;
  garage: boolean;
  basement: boolean;
  deck: boolean;
  deckArea: number;
  patio: boolean;
  patioArea: number;
  roofConstruction: string | null;
  roofMaterial: string | null;
  airConditioningAvailable: boolean | null;

  // Mortgage info
  adjustableRate: boolean;
  assumable: boolean;
  lenderName: string | null;
  lastMortgage1Amount: number | null;
  firstMortgagePercent: number | null;
  secondMortgagePercent: number | null;
  thirdMortgagePercent: number | null;
  openMortgagePercent: number | null;
  improvementValuePercent: number | null;

  // Other
  MFH2to4: boolean;
  MFH5plus: boolean;
  hoa: number | null;
  rentAmount: number | null;
  documentType?: string;
  documentTypeCode?: string;
  recordingDate?: string;
  priorOwner?: string | null;
  equity: boolean;
  lastUpdateDate: string;
}

/** Preferred (provider-neutral) alias for the scorer input shape. */
export type PropertyDistressInput = REAPIPropertyData;

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

// ---------------------------------------------------------------------------
// Signal-family map (v2.1, HG4 hard-gate)
// ---------------------------------------------------------------------------
// Each family represents an independent dimension of distress. Signals in the
// SAME family describe the SAME underlying condition viewed from different
// angles (e.g. a pre-foreclosure parcel can also be scheduled for auction and
// have a lis pendens — that's ONE distress event, not three). We MAX within
// family and SUM across families so a parcel that's foreclosure-distressed
// AND tax-distressed AND vacant correctly scores higher than one that's only
// foreclosure-distressed.
// ---------------------------------------------------------------------------
export const SIGNAL_FAMILIES = {
  FORECLOSURE_FAMILY: [
    'FORECLOSURE',
    'PRE_FORECLOSURE',
    'AUCTION',
    'FUTURE_AUCTION',
    'LIS_PENDENS',
  ],
  TAX_FAMILY: ['TAX_DELINQUENT', 'LIEN_JUDGMENT'],
  VACANCY_FAMILY: ['VACANT'],
  ABSENTEE_FAMILY: ['OUT_OF_STATE_OWNER', 'ABSENTEE_OWNER'],
  LIFE_EVENT_FAMILY: ['INHERITED', 'DEATH_TRANSFER'],
  EQUITY_FAMILY: ['HIGH_EQUITY', 'FREE_CLEAR', 'NEGATIVE_EQUITY'],
  OWNERSHIP_FAMILY: ['LONG_TERM_OWNER', 'PORTFOLIO_OWNER', 'CORPORATE_OWNED'],
  BANK_FAMILY: ['REO'],
  LISTING_FAMILY: ['PRICE_REDUCED'],
  FINANCING_FAMILY: ['PRIVATE_LENDER', 'ADJUSTABLE_RATE'],
  TRANSFER_FAMILY: ['QUIT_CLAIM'],
} as const;

type FamilyKey = keyof typeof SIGNAL_FAMILIES;

/** Inverted lookup: signal name -> family key. Built once at module load. */
const SIGNAL_TO_FAMILY: Record<string, FamilyKey> = (() => {
  const map: Record<string, FamilyKey> = {};
  for (const [family, signals] of Object.entries(SIGNAL_FAMILIES) as [FamilyKey, readonly string[]][]) {
    for (const s of signals) map[s] = family;
  }
  return map;
})();

/**
 * Compose per-signal contributions using signal-family MAX, then sum across
 * families. Returns a score clamped to 0–100.
 *
 * Any signal NOT present in SIGNAL_TO_FAMILY contributes its raw points
 * (treated as its own one-member family) so future signals are forward-compatible.
 */
function composeFamilyMax(contributions: Map<string, number>): number {
  const familyMax = new Map<string, number>();
  for (const [signal, points] of contributions) {
    if (points <= 0) continue;
    const family = SIGNAL_TO_FAMILY[signal] ?? `__SOLO_${signal}`;
    const prev = familyMax.get(family) ?? 0;
    if (points > prev) familyMax.set(family, points);
  }
  let total = 0;
  for (const pts of familyMax.values()) total += pts;
  return Math.min(total, 100);
}

/**
 * Calculate distress score from property data
 * Works with REAPIPropertyData from search responses
 *
 * v2.1: uses signal-family MAX composition (see SIGNAL_FAMILIES above).
 */
export function calculateDistressScore(property: REAPIPropertyData): DistressScore {
  const signals: DistressSignal[] = [];
  /** signalName -> point contribution (raw, before family-MAX) */
  const contributions = new Map<string, number>();

  const record = (signal: string, weight: number, present: boolean, description: string, points?: number) => {
    signals.push({ signal, weight, present, description });
    if (present) contributions.set(signal, points ?? weight);
  };

  // ============================================
  // FORECLOSURE FAMILY (MAX within family)
  // ============================================

  // PRE_FORECLOSURE (25)
  record(
    'PRE_FORECLOSURE',
    25,
    !!property.preForeclosure,
    'Property has active pre-foreclosure filing'
  );

  // AUCTION / FORECLOSURE (25) — REAPI lumps both into the same boolean signal.
  record(
    'AUCTION',
    25,
    !!(property.auction || property.foreclosure),
    'Property scheduled for foreclosure auction'
  );

  // FUTURE_AUCTION (25 base, +5 if nextAuctionDate within 14 days, capped 30).
  // Distinct from REAPI's AUCTION because it carries a scheduled date and
  // decays by proximity — closer auction = higher urgency = more motivated seller.
  // Decay schedule (days-until-auction):
  //   <= 14 days: +5 boost (max urgency)
  //   <= 30 days: base 25
  //   <= 60 days: -3 mild decay
  //   <= 90 days: -5 decay
  //    > 90 days: -8 decay (still notable but distant)
  const futureAuctionDate = (property as REAPIPropertyData & { nextAuctionDate?: Date | string | null })
    .nextAuctionDate;
  const hasScheduledAuction = !!(property as REAPIPropertyData & { hasScheduledAuction?: boolean })
    .hasScheduledAuction;
  let futurePts = 0;
  let futureDaysOut: number | null = null;
  if (hasScheduledAuction && futureAuctionDate) {
    const d = futureAuctionDate instanceof Date ? futureAuctionDate : new Date(futureAuctionDate);
    if (!isNaN(d.getTime())) {
      futureDaysOut = Math.round((d.getTime() - Date.now()) / 86400000);
      futurePts = 25;
      if (futureDaysOut <= 14) futurePts += 5;
      else if (futureDaysOut <= 30) futurePts += 0;
      else if (futureDaysOut <= 60) futurePts -= 3;
      else if (futureDaysOut <= 90) futurePts -= 5;
      else futurePts -= 8;
      futurePts = Math.max(0, Math.min(futurePts, 30));
    }
  } else if (hasScheduledAuction) {
    // Scheduled but no date — treat as base.
    futurePts = 25;
  }
  record(
    'FUTURE_AUCTION',
    25,
    futurePts > 0,
    futurePts > 0
      ? `Auction scheduled${futureDaysOut !== null ? ` (${futureDaysOut} days out)` : ''}`
      : 'Future auction scheduled',
    futurePts
  );

  // LIS_PENDENS (22) — court filing that initiates foreclosure. Slightly lower
  // than PRE_FORECLOSURE/AUCTION because timeline is more uncertain.
  const hasLisPendens = !!(property as REAPIPropertyData & { hasLisPendens?: boolean }).hasLisPendens;
  record('LIS_PENDENS', 22, hasLisPendens, 'Lis pendens / notice-of-default filed');

  // ============================================
  // TAX FAMILY (MAX within family)
  // ============================================

  // LIEN_JUDGMENT (20) — REAPI's nationwide field.
  const hasLienOrJudgment = !!(property.taxLien || property.judgment);
  record('LIEN_JUDGMENT', 20, hasLienOrJudgment, 'Property has active liens or judgments');

  // TAX_DELINQUENT (FL scraper data, Option A) — separate from LIEN_JUDGMENT
  // because REAPI's taxLien field never fires for our scraped FL data.
  // Base +20, boosts for high amount / multi-year / Ch. 197 deed-eligible.
  // Capped at +30. No time-decay (older FL tax certificates are MORE motivating).
  const td = !!property.isTaxDelinquent;
  const tdAmount = property.taxDelinquentAmount || 0;
  const tdYears = property.taxDelinquentYearsCount || 0;
  const tdEarliestYear = property.taxDelinquentEarliestYear;
  const tdCurrentYear = new Date().getFullYear();
  const tdDeedEligible = tdEarliestYear ? tdCurrentYear - tdEarliestYear >= 2 : false;
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
  record(
    'TAX_DELINQUENT',
    20,
    td,
    td
      ? `Tax delinquent${tdEarliestYear ? ` since ${tdEarliestYear}` : ''}` +
          `${tdAmount > 0 ? ` ($${tdAmount.toLocaleString()})` : ''}` +
          `${tdYears > 1 ? ` · ${tdYears} certificates` : ''}` +
          `${tdDeedEligible ? ' · deed-eligible' : ''}`
      : 'Property tax delinquent (FL county data)',
    tdPts
  );

  // ============================================
  // VACANCY FAMILY
  // ============================================
  record('VACANT', 15, !!property.vacant, 'Property appears to be vacant');

  // ============================================
  // ABSENTEE FAMILY (MAX within family)
  // ============================================
  record(
    'OUT_OF_STATE_OWNER',
    15,
    !!property.outOfStateAbsenteeOwner,
    'Owner lives out of state'
  );
  const inStateAbsentee =
    (property.inStateAbsenteeOwner || property.absenteeOwner) && !property.outOfStateAbsenteeOwner;
  record('ABSENTEE_OWNER', 12, !!inStateAbsentee, 'Owner lives elsewhere in state');

  // ============================================
  // LIFE EVENT FAMILY (MAX within family)
  // ============================================
  record('INHERITED', 15, !!property.inherited, 'Property was inherited');
  record('DEATH_TRANSFER', 15, !!property.death, 'Property transferred due to death');

  // ============================================
  // EQUITY FAMILY (MAX within family)
  // ============================================
  const equityPct = property.equityPercent || 0;
  const isHighEquity = !!(property.highEquity && equityPct > 50);
  record('HIGH_EQUITY', 10, isHighEquity, `Owner has ${equityPct}% equity`);
  record('FREE_CLEAR', 5, !!property.freeClear, 'No mortgage on property');
  record('NEGATIVE_EQUITY', 15, !!property.negativeEquity, 'Property is underwater (owes more than value)');

  // ============================================
  // OWNERSHIP FAMILY (MAX within family)
  // ============================================
  const ownershipYears = property.yearsOwned || 0;
  const isLongTermOwner = ownershipYears > 15;
  if (ownershipYears > 0) {
    record(
      'LONG_TERM_OWNER',
      15,
      isLongTermOwner,
      `Owner has held property ${ownershipYears} years`
    );
  }
  const totalOwned = parseInt(property.totalPropertiesOwned || '0');
  const isPortfolioOwner = totalOwned > 3 && !!property.absenteeOwner;
  if (totalOwned > 1) {
    record('PORTFOLIO_OWNER', 10, isPortfolioOwner, `Owner has ${totalOwned} properties`);
  }
  record('CORPORATE_OWNED', 5, !!property.corporateOwned, 'Owned by corporation/LLC');

  // ============================================
  // BANK FAMILY
  // ============================================
  record('REO', 10, !!property.reo, 'Bank-owned property (REO)');

  // ============================================
  // LISTING FAMILY
  // ============================================
  record('PRICE_REDUCED', 10, !!property.priceReduced, 'Price reduced on MLS listing');

  // ============================================
  // FINANCING FAMILY (MAX within family)
  // ============================================
  record(
    'PRIVATE_LENDER',
    10,
    !!property.privateLender,
    'Property financed with private/hard money'
  );
  record('ADJUSTABLE_RATE', 5, !!property.adjustableRate, 'Has adjustable rate mortgage');

  // ============================================
  // TRANSFER FAMILY
  // ============================================
  const isQuitClaim =
    property.documentType?.toLowerCase().includes('quit claim') ||
    property.documentTypeCode === 'QC';
  record('QUIT_CLAIM', 5, !!isQuitClaim, 'Property transferred via quit claim deed');

  // ============================================
  // FAMILY-MAX COMPOSITION → FINAL SCORE
  // ============================================
  const finalScore = composeFamilyMax(contributions);

  // Determine grade (v2.0 thresholds — unchanged in v2.1)
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (finalScore >= 65) grade = 'A';
  else if (finalScore >= 50) grade = 'B';
  else if (finalScore >= 35) grade = 'C';
  else if (finalScore >= 20) grade = 'D';
  else grade = 'F';

  let motivation: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  if (finalScore >= 50) motivation = 'HIGH';
  else if (finalScore >= 35) motivation = 'MEDIUM';
  else if (finalScore >= 20) motivation = 'LOW';
  else motivation = 'NONE';

  return {
    score: finalScore,
    grade,
    signals: signals.filter((s) => s.present),
    motivation,
  };
}

/**
 * Quick score calculation without full signal breakdown.
 * v2.1: now thin wrapper around calculateDistressScore so family-MAX composition
 * is preserved (the previous additive shortcut would diverge from the full scorer).
 */
export function quickDistressScore(property: REAPIPropertyData): number {
  return calculateDistressScore(property).score;
}

/**
 * Combine distress score with existing scoring from investor profile
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
// Parcel+Lien+ForeclosureCase UNION) into the scorer shape.
// Used by:
//   - /api/properties/[id]/score/recompute (manual re-score from drawer)
//   - The promote-on-engagement flow (when virtual → tenant-owned)
//   - lib/cron/jobs that batch-score newly-ingested Property rows
//   - The M2.3 UNION builder that synthesizes virtual leads from the four
//     distress streams (TaxDelinquencySummary, ForeclosureCase, AuctionCalendar,
//     LisPendens) — see M2.3 for how PropertyScoreInput is populated.
// ---------------------------------------------------------------------------

/** Minimal Property-row shape the score function reads. Subset of Prisma's Property. */
export interface PropertyScoreInput {
  foreclosure: boolean;
  preForeclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  bankruptcy: boolean;
  /**
   * Generic/in-state absentee flag → ABSENTEE_OWNER (12 pts, ABSENTEE_FAMILY).
   * M1.8: populated at promote time from `Parcel.ownerOccupied === false` —
   * the situs≈mailing derived signal (scripts/derive-owner-occupancy.ts).
   * Out-of-state granularity (OUT_OF_STATE_OWNER, 15 pts) would require
   * parsing the mailing-address state — future refinement.
   */
  absenteeOwner: boolean;
  estimatedValue: number | null;
  assessedValue: number | null;
  taxDelinquentAmount: number | null;
  taxDelinquentYearsCount: number | null;
  taxDelinquentEarliestYear: number | null;
  // v2.1 — foreclosure-family signals (populated by M2.3 UNION builder)
  hasScheduledAuction?: boolean;
  nextAuctionDate?: Date | null;
  hasLisPendens?: boolean;
}

export function calculateDistressScoreFromProperty(p: PropertyScoreInput): DistressScore {
  const adapted: Partial<REAPIPropertyData> & {
    hasScheduledAuction?: boolean;
    nextAuctionDate?: Date | null;
    hasLisPendens?: boolean;
  } = {
    foreclosure: p.foreclosure,
    preForeclosure: p.preForeclosure,
    vacant: p.vacant,
    absenteeOwner: p.absenteeOwner,
    estimatedValue: p.estimatedValue ?? undefined,
    // Tax-delinquent specific (Option A path)
    isTaxDelinquent: p.taxDelinquent,
    taxDelinquentAmount: p.taxDelinquentAmount ?? undefined,
    taxDelinquentYearsCount: p.taxDelinquentYearsCount ?? undefined,
    taxDelinquentEarliestYear: p.taxDelinquentEarliestYear ?? undefined,
    // v2.1 — new foreclosure-family signals
    hasScheduledAuction: p.hasScheduledAuction ?? false,
    nextAuctionDate: p.nextAuctionDate ?? null,
    hasLisPendens: p.hasLisPendens ?? false,
  };
  return calculateDistressScore(adapted as REAPIPropertyData);
}
