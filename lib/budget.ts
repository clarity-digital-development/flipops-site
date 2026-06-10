import { prisma } from './prisma';

/** BudgetLedger stores its trade maps as JSON strings — parse defensively. */
function parseLedgerMap<T = number>(raw: string | null | undefined): Record<string, T> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

export type VarianceTier = 'GREEN' | 'TIER1' | 'TIER2';

export interface VarianceAnalysis {
  trade: string;
  baseline: number;
  committed: number;
  actuals: number;
  variance: number;
  variancePct: number;
  tier: VarianceTier;
}

export interface TierDecision {
  tier: VarianceTier;
  tradeAnalysis: VarianceAnalysis;
  overallAnalysis: {
    totalBaseline: number;
    totalCommitted: number;
    totalActuals: number;
    totalVariance: number;
    totalVariancePct: number;
  };
  actions: string[];
  recommendations: string[];
}

/**
 * Calculate variance tier based on percentage
 */
export function calculateVarianceTier(
  variancePct: number,
  tier1Threshold: number,
  tier2Threshold: number
): VarianceTier {
  const absVariance = Math.abs(variancePct);
  if (absVariance < tier1Threshold) return 'GREEN';
  if (absVariance < tier2Threshold) return 'TIER1';
  return 'TIER2';
}

/**
 * Apply invoice to budget ledger and compute variance tiers
 */
export async function applyInvoiceAndComputeTiers(params: {
  dealId: string;
  trade: string;
  amount: number;
  tier1Threshold: number;
  tier2Threshold: number;
}): Promise<TierDecision> {
  const { dealId, trade, amount, tier1Threshold, tier2Threshold } = params;

  // Load or create budget ledger
  let ledger = await prisma.budgetLedger.findUnique({
    where: { dealId }
  });

  if (!ledger) {
    // Initialize ledger if it doesn't exist
    ledger = await prisma.budgetLedger.create({
      data: {
        dealId,
        baseline: '{}',
        committed: '{}',
        actuals: '{}',
        variance: '{}',
        contingencyRemaining: 0
      }
    });
  }

  // Parse JSON fields
  const baseline = parseLedgerMap(ledger.baseline);
  const committed = parseLedgerMap(ledger.committed);
  const actuals = parseLedgerMap(ledger.actuals);

  // Update actuals for this trade
  const previousActuals = actuals[trade] || 0;
  const newActuals = previousActuals + amount;
  actuals[trade] = newActuals;

  // Calculate total actuals
  actuals.total = Object.entries(actuals)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + value, 0);

  // Get baseline and committed for this trade
  const tradeBaseline = baseline[trade] || 0;
  const tradeCommitted = committed[trade] || 0;

  // Use committed if available, otherwise baseline
  const budgetReference = tradeCommitted > 0 ? tradeCommitted : tradeBaseline;

  // Calculate variance for this trade
  // Variance is how much we're over/under budget AFTER this invoice
  const tradeVariance = newActuals - budgetReference;

  // For G3, we want to know the impact of THIS invoice on the budget
  // If we're still under budget, variance % should be small/negative
  // If we're going over budget, variance % should be positive
  // The tier thresholds are based on how much this pushes us over budget
  let tradeVariancePct: number;

  if (budgetReference === 0) {
    // No budget allocated for this trade
    tradeVariancePct = 100; // Automatic high variance
  } else if (newActuals <= budgetReference) {
    // Still within budget - calculate how much of budget is used
    // This should result in GREEN tier (< 3% over budget = still within budget)
    tradeVariancePct = 0; // Not over budget at all
  } else {
    // Over budget - calculate percentage over
    const amountOver = newActuals - budgetReference;
    tradeVariancePct = (amountOver / budgetReference) * 100;
  }

  // Calculate overall variance
  const totalBaseline = baseline.total || 0;
  const totalCommitted = committed.total || 0;
  const totalBudgetReference = totalCommitted > 0 ? totalCommitted : totalBaseline;
  const totalActuals = actuals.total || 0;
  const totalVariance = totalActuals - totalBudgetReference;

  // Apply same logic for total variance percentage
  let totalVariancePct: number;
  if (totalBudgetReference === 0) {
    totalVariancePct = 100;
  } else if (totalActuals <= totalBudgetReference) {
    totalVariancePct = 0; // Still within total budget
  } else {
    const totalAmountOver = totalActuals - totalBudgetReference;
    totalVariancePct = (totalAmountOver / totalBudgetReference) * 100;
  }

  // Determine tier based on both trade and total variance
  const tradeTier = calculateVarianceTier(tradeVariancePct, tier1Threshold, tier2Threshold);
  const totalTier = calculateVarianceTier(totalVariancePct, tier1Threshold, tier2Threshold);

  // Use the highest tier between trade and total
  let finalTier: VarianceTier = 'GREEN';
  if (tradeTier === 'TIER2' || totalTier === 'TIER2') {
    finalTier = 'TIER2';
  } else if (tradeTier === 'TIER1' || totalTier === 'TIER1') {
    finalTier = 'TIER1';
  }

  // Determine actions based on tier
  const actions: string[] = [];
  const recommendations: string[] = [];

  switch (finalTier) {
    case 'GREEN':
      actions.push('APPROVE_INVOICE');
      recommendations.push('Continue monitoring budget');
      break;
    case 'TIER1':
      actions.push('APPROVE_INVOICE', 'FREEZE_NONCRITICAL', 'NOTIFY_PM');
      recommendations.push(`Freeze non-critical work for ${trade}`);
      recommendations.push('Review upcoming invoices carefully');
      recommendations.push('Consider value engineering opportunities');
      break;
    case 'TIER2':
      actions.push('APPROVE_INVOICE', 'ESCALATE_EXEC', 'ENQUEUE_COG_SIMULATION', 'FREEZE_ALL_OPTIONAL');
      recommendations.push('Immediate executive review required');
      recommendations.push(`Critical budget overrun in ${trade}`);
      recommendations.push('Initiate change order process');
      recommendations.push('Consider scope reduction');
      break;
  }

  // Update variance in ledger
  const variance = parseLedgerMap<any>(ledger.variance);
  variance[trade] = {
    amount: tradeVariance,
    percentage: tradeVariancePct,
    tier: tradeTier,
    updatedAt: new Date().toISOString()
  };

  // Update overall variance
  variance.total = {
    amount: totalVariance,
    percentage: totalVariancePct,
    tier: totalTier,
    updatedAt: new Date().toISOString()
  };

  // Save updated ledger (maps serialized back to JSON strings)
  await prisma.budgetLedger.update({
    where: { dealId },
    data: {
      actuals: JSON.stringify(actuals),
      variance: JSON.stringify(variance)
    }
  });

  // Build response
  const tradeAnalysis: VarianceAnalysis = {
    trade,
    baseline: tradeBaseline,
    committed: tradeCommitted,
    actuals: newActuals,
    variance: tradeVariance,
    variancePct: tradeVariancePct,
    tier: tradeTier
  };

  const overallAnalysis = {
    totalBaseline,
    totalCommitted,
    totalActuals,
    totalVariance,
    totalVariancePct
  };

  return {
    tier: finalTier,
    tradeAnalysis,
    overallAnalysis,
    actions,
    recommendations
  };
}