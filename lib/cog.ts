import { prisma } from './prisma';
import { logger } from './logger';

export type CoSimResult = {
  before: {
    p50: number;
    p80: number;
    p95: number;
    totalCost: number;
    roiPct: number;
    arv: number;
  };
  after: {
    p50: number;
    p80: number;
    p95: number;
    totalCost: number;
    roiPct: number;
  };
  deltas: {
    p80: number;
    cost: number;
    roiPct: number;
    impactDays: number;
  };
};

/**
 * Simulate the impact of a Change Order on deal financials
 * Uses existing budget ledger data and applies CO delta with risk multipliers
 */
export async function simulateCO(params: {
  dealId: string;
  deltaUsd: number;
  impactDays: number;
}): Promise<CoSimResult> {
  const { dealId, deltaUsd, impactDays } = params;
  const log = logger.child({ function: 'simulateCO', dealId, deltaUsd, impactDays });

  log.info('Starting Change Order simulation');

  // 1) Fetch the deal and its budget ledger
  const [deal, ledger] = await Promise.all([
    prisma.dealSpec.findUnique({ where: { id: dealId } }),
    prisma.budgetLedger.findUnique({ where: { dealId } })
  ]);

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  // 2) Get baseline costs from ledger
  // BudgetLedger stores trade maps as JSON strings — parse defensively.
  const parseLedgerMap = (raw: string | null | undefined): Record<string, number> => {
    if (!raw) return {};
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  };
  const baseline = parseLedgerMap(ledger?.baseline);
  const committed = parseLedgerMap(ledger?.committed);
  const actuals = parseLedgerMap(ledger?.actuals);

  // Calculate current total cost (use committed if available, otherwise baseline)
  const totalBaseline = baseline.total || 0;
  const totalCommitted = committed.total || 0;
  const totalActuals = actuals.total || 0;

  // Use committed budget if available (deals with awarded bids), otherwise baseline
  const currentBudget = totalCommitted > 0 ? totalCommitted : totalBaseline;
  const baseCost = currentBudget + totalActuals;

  // 3) Get ARV from deal (with fallback for testing)
  const arv = deal.arv || 300000; // Default ARV for testing

  // 4) Calculate before metrics
  // Simple P50/P80/P95 based on current budget with risk factors
  const riskMultipliers = {
    p50: 1.00,  // Expected case
    p80: 1.10,  // 10% contingency
    p95: 1.18   // 18% worst case
  };

  const before = {
    p50: Math.round(baseCost * riskMultipliers.p50),
    p80: Math.round(baseCost * riskMultipliers.p80),
    p95: Math.round(baseCost * riskMultipliers.p95),
    totalCost: baseCost,
    roiPct: baseCost > 0 ? ((arv - baseCost) / baseCost) * 100 : 0,
    arv
  };

  // 5) Apply CO delta with risk adjustments
  // For positive deltas (cost increases), add contingency
  // For negative deltas (savings), be conservative
  const contingencyMultiplier = deltaUsd > 0 ? 1.10 : 1.00; // 10% contingency on increases
  const riskMultiplier = deltaUsd > 0 ? 1.18 : 1.00; // 18% risk on increases

  const costAfter = baseCost + deltaUsd;

  // Calculate after metrics with appropriate risk factors
  const after = {
    p50: Math.round(costAfter * riskMultipliers.p50),
    p80: Math.round(before.p80 + (deltaUsd * contingencyMultiplier)),
    p95: Math.round(before.p95 + (deltaUsd * riskMultiplier)),
    totalCost: costAfter,
    roiPct: costAfter > 0 ? ((arv - costAfter) / costAfter) * 100 : 0
  };

  // 6) Calculate deltas
  const deltas = {
    p80: after.p80 - before.p80,
    cost: deltaUsd,
    roiPct: after.roiPct - before.roiPct,
    impactDays
  };

  log.info({ before, after, deltas }, 'Simulation complete');

  return {
    before,
    after,
    deltas
  };
}

/**
 * Evaluate a Change Order against policy guardrails
 */
export async function evaluateChangeOrder(params: {
  dealId: string;
  trade: string;
  deltaUsd: number;
  impactDays: number;
  reason?: string;
  evidence?: string[];
}): Promise<{
  approved: boolean;
  simulation: CoSimResult;
  violations: {
    exposure: boolean;
    roi: boolean;
    message?: string;
  };
}> {
  const { dealId, trade, deltaUsd, impactDays } = params;
  const log = logger.child({ function: 'evaluateChangeOrder', dealId, trade });

  // Run simulation
  const simulation = await simulateCO({ dealId, deltaUsd, impactDays });

  // Get deal for policy check
  const deal = await prisma.dealSpec.findUnique({
    where: { id: dealId }
  });

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  // Check against deal-specific guardrails
  const maxExposure = deal.maxExposureUsd;
  const targetRoi = deal.targetRoiPct;

  // Evaluate guardrails
  const exposureViolation = simulation.after.p80 > maxExposure;
  const roiViolation = simulation.after.roiPct < targetRoi;

  const violations = {
    exposure: exposureViolation,
    roi: roiViolation,
    message: exposureViolation
      ? `P80 exposure ($${simulation.after.p80}) exceeds max ($${maxExposure})`
      : roiViolation
      ? `ROI (${simulation.after.roiPct.toFixed(1)}%) below target (${targetRoi}%)`
      : undefined
  };

  const approved = !exposureViolation && !roiViolation;

  log.info({
    approved,
    violations,
    p80After: simulation.after.p80,
    roiAfter: simulation.after.roiPct,
    maxExposure,
    targetRoi
  }, 'Change Order evaluation complete');

  return {
    approved,
    simulation,
    violations
  };
}