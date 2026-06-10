import { z } from 'zod';
import { SUPPORTED_REGIONS, FINISH_LEVELS, PROPERTY_RISK_FACTORS } from './constants';

// Quantity schema
export const QuantitySchema = z.object({
  value: z.number().positive('Quantity value must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  method: z.enum(['measured', 'calculated', 'estimated', 'counted'], {
    message: 'Method must be one of: measured, calculated, estimated, counted'
  })
});

// Scope node schema for validation
export const ScopeNodeSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  trade: z.string().min(1, 'Trade is required'),
  task: z.string().min(1, 'Task is required'),
  quantity: QuantitySchema,
  finishLvl: z.enum(['Standard', 'Premium', 'Luxury']).optional(),
  assumptions: z.array(z.string()).optional().default([])
});

// Bid item schema
export const BidItemSchema = z.object({
  trade: z.string().min(1),
  task: z.string().min(1),
  quantity: QuantitySchema,
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
  includes: z.array(z.string()).optional().default([]),
  excludes: z.array(z.string()).optional().default([])
});

// Bid ingestion schema
export const BidIngestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  vendorId: z.string().min(1, 'Vendor ID is required'),
  items: z.array(BidItemSchema).min(1, 'At least one bid item is required'),
  includes: z.array(z.string()).optional().default([]),
  excludes: z.array(z.string()).optional().default([])
});

// Invoice ingestion schema
export const InvoiceIngestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  trade: z.string().min(1, 'Trade is required'),
  lineItemId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  vendorId: z.string().optional(),
  docUrl: z.string().url().optional()
});

// Change order submission schema
export const ChangeOrderSubmitSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  trade: z.string().min(1, 'Trade is required'),
  deltaUsd: z.number(), // Can be negative for cost reduction
  impactDays: z.number().int(), // Can be negative for schedule acceleration
  reason: z.string().min(1, 'Reason is required')
});

// Deal specification schema
export const DealSpecSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  type: z.enum(['SFH', 'multi-family', 'commercial', 'land']),
  maxExposureUsd: z.number().positive('Max exposure must be positive'),
  targetRoiPct: z.number().positive('Target ROI must be positive'),
  constraints: z.object({
    maxDaysToClose: z.number().int().positive().optional(),
    cashOnly: z.boolean().optional(),
    noContingencies: z.boolean().optional(),
    minCashFlow: z.number().optional(),
    maxLTV: z.number().min(0).max(1).optional()
  }).optional().default({})
});

// Cost model schema
export const CostModelSchema = z.object({
  region: z.enum(SUPPORTED_REGIONS as unknown as [string, ...string[]]),
  grade: z.enum(['Standard', 'Premium', 'Luxury']),
  trade: z.string().min(1),
  task: z.string().min(1),
  unit: z.string().min(1),
  material: z.number().nonnegative(),
  labor: z.number().nonnegative(),
  contingencyPct: z.number().min(0).max(100),
  riskPremiumPct: z.number().min(0).max(100),
  source: z.string().optional()
});

// Estimate request schema
export const EstimateRequestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  region: z.enum(SUPPORTED_REGIONS as unknown as [string, ...string[]]).optional(),
  grade: z.enum(['Standard', 'Premium', 'Luxury']).optional(),
  includeUncertainty: z.boolean().optional().default(true),
  monteCarloRuns: z.number().int().min(100).max(10000).optional().default(1000)
});

// API response schemas
export const EstimateResponseSchema = z.object({
  dealId: z.string(),
  baseline: z.number(),
  p50: z.number(),
  p80: z.number(),
  p95: z.number(),
  byTrade: z.array(z.object({
    trade: z.string(),
    baseline: z.number(),
    p50: z.number(),
    p80: z.number(),
    p95: z.number()
  })),
  drivers: z.array(z.object({
    trade: z.string(),
    task: z.string(),
    contribution: z.number(),
    uncertaintyImpact: z.number()
  })),
  metadata: z.object({
    region: z.string(),
    grade: z.string(),
    monteCarloRuns: z.number().optional(),
    computedAt: z.string().datetime()
  })
});

export const ApprovalResponseSchema = z.object({
  dealId: z.string(),
  action: z.enum(['APPROVE', 'BLOCK']),
  rationale: z.string().optional(),
  eventId: z.string(),
  guardrailsChecked: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    value: z.number().optional(),
    threshold: z.number().optional()
  }))
});

export const BidAwardResponseSchema = z.object({
  bidId: z.string(),
  action: z.enum(['AWARD', 'BLOCK']),
  spread: z.number(),
  rationale: z.string().optional(),
  eventId: z.string()
});

export const VarianceAlertSchema = z.object({
  dealId: z.string(),
  trade: z.string(),
  variance: z.number(),
  tier: z.enum(['ok', 'tier1', 'tier2']),
  action: z.enum(['NONE', 'FREEZE_NONCRITICAL', 'TRIGGER_COG']),
  eventId: z.string()
});

// Panel response schemas
export const TruthPanelSchema = z.object({
  p50: z.number(),
  p80: z.number(),
  p95: z.number(),
  maxExposureUsd: z.number(),
  contingencyRemaining: z.number(),
  topRiskDeltas: z.array(z.object({
    name: z.string(),
    from: z.number(),
    to: z.number(),
    note: z.string().optional()
  })),
  actions: z.array(z.object({
    label: z.string(),
    type: z.enum(['BLOCK', 'REVIEW']),
    href: z.string().optional()
  }))
});

export const MoneyPanelSchema = z.object({
  baseline: z.number(),
  committed: z.number(),
  actuals: z.number(),
  byTradeVariance: z.array(z.object({
    trade: z.string(),
    pct: z.number(),
    tier: z.enum(['ok', 'tier1', 'tier2'])
  })),
  changeOrders: z.object({
    count: z.number(),
    netImpact: z.number(),
    approvalLatencyHours: z.number()
  })
});

export const MotionPanelSchema = z.object({
  plannedVsDone: z.object({
    planned: z.number(),
    done: z.number()
  }),
  bottlenecks: z.array(z.object({
    agent: z.enum(['CAA', 'SA', 'EST', 'BG', 'COG']),
    count: z.number()
  })),
  vendors: z.array(z.object({
    vendorId: z.string(),
    onTimePct: z.number(),
    onBudgetPct: z.number(),
    reliability: z.number()
  }))
});

// Type exports
export type Quantity = z.infer<typeof QuantitySchema>;
export type ScopeNode = z.infer<typeof ScopeNodeSchema>;
export type BidItem = z.infer<typeof BidItemSchema>;
export type BidIngest = z.infer<typeof BidIngestSchema>;
export type InvoiceIngest = z.infer<typeof InvoiceIngestSchema>;
export type ChangeOrderSubmit = z.infer<typeof ChangeOrderSubmitSchema>;
export type DealSpec = z.infer<typeof DealSpecSchema>;
export type CostModel = z.infer<typeof CostModelSchema>;
export type EstimateRequest = z.infer<typeof EstimateRequestSchema>;
export type EstimateResponse = z.infer<typeof EstimateResponseSchema>;
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;
export type BidAwardResponse = z.infer<typeof BidAwardResponseSchema>;
export type VarianceAlert = z.infer<typeof VarianceAlertSchema>;
export type TruthPanel = z.infer<typeof TruthPanelSchema>;
export type MoneyPanel = z.infer<typeof MoneyPanelSchema>;
export type MotionPanel = z.infer<typeof MotionPanelSchema>;