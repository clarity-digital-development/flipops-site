// Uncertainty bands for different trades (in percentage)
// Indexed by free-form trade strings at runtime, so type as Record.
export const TRADE_UNCERTAINTIES: {
  materials: Record<string, number> & { default: number };
  labor: Record<string, number> & { default: number };
} = {
  materials: {
    Roofing: 0.10,
    Kitchen: 0.12,
    Bathroom: 0.12,
    Flooring: 0.08,
    Painting: 0.05,
    HVAC: 0.10,
    Electrical: 0.10,
    Plumbing: 0.12,
    Framing: 0.15,
    Foundation: 0.15,
    Landscaping: 0.20,
    default: 0.10
  },
  labor: {
    Roofing: 0.15,
    Kitchen: 0.18,
    Bathroom: 0.18,
    Flooring: 0.12,
    Painting: 0.10,
    HVAC: 0.15,
    Electrical: 0.15,
    Plumbing: 0.18,
    Framing: 0.20,
    Foundation: 0.20,
    Landscaping: 0.25,
    default: 0.15
  }
};

// Percentile multipliers for uncertainty calculations
export const PERCENTILE_MULTIPLIERS = {
  p50: 0,     // Baseline (no adjustment)
  p80: 0.84,  // 80th percentile (approximately 0.84 standard deviations)
  p95: 1.65   // 95th percentile (approximately 1.65 standard deviations)
};

// Guardrail thresholds
export const GUARDRAILS = {
  // Gate G1: Maximum exposure
  maxExposureBuffer: 1.0, // Allow exactly at limit, no buffer

  // Gate G2: Bid spread threshold
  maxBidSpread: 0.15, // 15% maximum spread between bids

  // Budget Guardian tiers
  budgetVariance: {
    tier1: 0.03, // 3% variance triggers Tier-1 freeze
    tier2: 0.07  // 7% variance triggers Tier-2 COG simulation
  },

  // Contingency targets by finish level
  contingencyTargets: {
    standard: 0.10,  // 10% for standard finish
    premium: 0.12,   // 12% for premium finish
    luxury: 0.15     // 15% for luxury finish
  }
};

// Default assumptions for estimation
export const DEFAULT_ASSUMPTIONS = {
  holdingCostPerDay: 100, // Daily holding cost in USD
  realtorFeePct: 0.06,     // 6% realtor fees
  closingCostPct: 0.02,    // 2% closing costs
  profitTargetPct: 0.20,   // 20% profit target
  defaultRehabDays: 90,    // 90 days default rehab time

  // Financing assumptions
  hardMoneyRate: 0.12,     // 12% annual interest
  hardMoneyPoints: 0.02,   // 2 points
  downPaymentPct: 0.20     // 20% down payment
};

// Trade priorities for scheduling
export const TRADE_PRIORITIES = {
  Foundation: 1,
  Framing: 2,
  Roofing: 3,
  Plumbing: 4,
  Electrical: 5,
  HVAC: 6,
  Insulation: 7,
  Drywall: 8,
  Flooring: 9,
  Kitchen: 10,
  Bathroom: 11,
  Painting: 12,
  Landscaping: 13
};

// Unit conversion factors
export const UNIT_CONVERSIONS = {
  'sqft': {
    'sqyd': 0.111111,
    'sqm': 0.092903
  },
  'lf': {
    'ft': 1,
    'm': 0.3048
  },
  'ea': {
    'each': 1,
    'unit': 1
  },
  'ton': {
    'btu': 12000,
    'kw': 3.517
  }
};

// Risk factors by property type
export const PROPERTY_RISK_FACTORS = {
  SFH: 1.0,           // Single Family Home (baseline)
  'multi-family': 1.2, // Multi-family (20% higher risk)
  commercial: 1.3,     // Commercial (30% higher risk)
  land: 0.8           // Land/lot (20% lower risk)
};

// Regions supported
export const SUPPORTED_REGIONS = [
  'Miami',
  'Fort Lauderdale',
  'West Palm Beach',
  'Orlando',
  'Tampa',
  'Jacksonville',
  'Naples'
];

// Finish level definitions
export const FINISH_LEVELS = {
  standard: {
    name: 'Standard',
    multiplier: 1.0,
    description: 'Builder-grade materials and finishes'
  },
  premium: {
    name: 'Premium',
    multiplier: 1.4,
    description: 'Mid-range materials with some upgrades'
  },
  luxury: {
    name: 'Luxury',
    multiplier: 2.0,
    description: 'High-end materials and custom finishes'
  }
};

// Status enums
export const DEAL_STATUS = {
  DRAFT: 'draft',
  UNDERWRITING: 'underwriting',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const BID_STATUS = {
  PENDING: 'pending',
  AWARDED: 'awarded',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

export const CHANGE_ORDER_STATUS = {
  PROPOSED: 'proposed',
  APPROVED: 'approved',
  DENIED: 'denied',
  CANCELLED: 'cancelled'
};

export const INVOICE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected'
};

// API response codes
export const API_RESPONSES = {
  VALIDATION_ERROR: 422,
  GUARDRAIL_VIOLATION: 409,
  UNAUTHORIZED: 403,
  NOT_FOUND: 404,
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204
};