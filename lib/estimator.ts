import { prisma } from './prisma';
import {
  TRADE_UNCERTAINTIES,
  PERCENTILE_MULTIPLIERS,
  DEFAULT_ASSUMPTIONS,
  PROPERTY_RISK_FACTORS,
  FINISH_LEVELS
} from './constants';
import { logger } from './logger';
import type { EstimateResponse } from './zod';

interface EstimateOptions {
  dealId: string;
  region?: string;
  grade?: string;
  includeUncertainty?: boolean;
  monteCarloRuns?: number;
}

interface LineItem {
  trade: string;
  task: string;
  quantity: {
    value: number;
    unit: string;
    method: string;
  };
  unitCost: number;
  totalCost: number;
  materialCost: number;
  laborCost: number;
  contingency: number;
  riskPremium: number;
}

/**
 * Calculates base cost for a scope node using cost model
 */
async function calculateLineItemCost(
  scopeNode: any,
  region: string,
  grade: string
): Promise<LineItem | null> {
  try {
    // Find matching cost model
    const costModel = await prisma.costModel.findFirst({
      where: {
        region,
        grade,
        trade: scopeNode.trade,
        task: scopeNode.task,
        unit: scopeNode.quantity.unit
      }
    });

    if (!costModel) {
      logger.warn({
        trade: scopeNode.trade,
        task: scopeNode.task,
        unit: scopeNode.quantity.unit,
        region,
        grade
      }, 'No cost model found for scope node');
      return null;
    }

    const quantity = scopeNode.quantity.value;
    const materialCost = costModel.material * quantity;
    const laborCost = costModel.labor * quantity;
    const subtotal = materialCost + laborCost;

    const contingency = subtotal * (costModel.contingencyPct / 100);
    const riskPremium = subtotal * (costModel.riskPremiumPct / 100);
    const totalCost = subtotal + contingency + riskPremium;

    return {
      trade: scopeNode.trade,
      task: scopeNode.task,
      quantity: scopeNode.quantity,
      unitCost: costModel.material + costModel.labor,
      materialCost,
      laborCost,
      contingency,
      riskPremium,
      totalCost
    };
  } catch (error) {
    logger.error({ error, scopeNode }, 'Failed to calculate line item cost');
    throw error;
  }
}

/**
 * Applies uncertainty to cost based on trade and percentile
 */
function applyUncertainty(
  lineItem: LineItem,
  percentile: 'p50' | 'p80' | 'p95'
): number {
  const materialUncertainty = TRADE_UNCERTAINTIES.materials[lineItem.trade] || TRADE_UNCERTAINTIES.materials.default;
  const laborUncertainty = TRADE_UNCERTAINTIES.labor[lineItem.trade] || TRADE_UNCERTAINTIES.labor.default;

  // Weighted average uncertainty based on material/labor split
  const totalBase = lineItem.materialCost + lineItem.laborCost;
  const weightedUncertainty =
    (lineItem.materialCost * materialUncertainty + lineItem.laborCost * laborUncertainty) / totalBase;

  const multiplier = PERCENTILE_MULTIPLIERS[percentile];
  const adjustmentFactor = 1 + (weightedUncertainty * multiplier);

  return lineItem.totalCost * adjustmentFactor;
}

/**
 * Runs Monte Carlo simulation for more accurate percentile estimates
 */
function runMonteCarlo(lineItems: LineItem[], runs: number = 1000): {
  p50: number;
  p80: number;
  p95: number;
} {
  const results: number[] = [];

  for (let i = 0; i < runs; i++) {
    let totalCost = 0;

    for (const item of lineItems) {
      const materialUncertainty = TRADE_UNCERTAINTIES.materials[item.trade] || TRADE_UNCERTAINTIES.materials.default;
      const laborUncertainty = TRADE_UNCERTAINTIES.labor[item.trade] || TRADE_UNCERTAINTIES.labor.default;

      // Generate random factors from normal distribution
      const materialFactor = 1 + (Math.random() - 0.5) * 2 * materialUncertainty;
      const laborFactor = 1 + (Math.random() - 0.5) * 2 * laborUncertainty;

      const adjustedMaterial = item.materialCost * materialFactor;
      const adjustedLabor = item.laborCost * laborFactor;
      const adjustedTotal = adjustedMaterial + adjustedLabor + item.contingency + item.riskPremium;

      totalCost += adjustedTotal;
    }

    results.push(totalCost);
  }

  // Sort results and find percentiles
  results.sort((a, b) => a - b);

  return {
    p50: results[Math.floor(runs * 0.50)],
    p80: results[Math.floor(runs * 0.80)],
    p95: results[Math.floor(runs * 0.95)]
  };
}

/**
 * Main estimation function
 */
export async function estimate(options: EstimateOptions): Promise<EstimateResponse> {
  const {
    dealId,
    region = 'Miami',
    grade = 'Standard',
    includeUncertainty = true,
    monteCarloRuns = 1000
  } = options;

  try {
    // Get deal and scope nodes
    const deal = await prisma.dealSpec.findUnique({
      where: { id: dealId },
      include: {
        scopeNodes: true
      }
    });

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Calculate line items
    const lineItems: LineItem[] = [];
    const missingCostModels: any[] = [];

    for (const node of deal.scopeNodes) {
      const lineItem = await calculateLineItemCost(node, region, grade);
      if (lineItem) {
        lineItems.push(lineItem);
      } else {
        missingCostModels.push({
          trade: node.trade,
          task: node.task,
          // quantity is a Json column shaped {value, unit, method}
          unit: (node.quantity as { unit?: string } | null)?.unit ?? 'unknown'
        });
      }
    }

    if (missingCostModels.length > 0) {
      logger.warn({ missingCostModels }, 'Some cost models are missing');
    }

    // Calculate baseline
    const baseline = lineItems.reduce((sum, item) => sum + item.totalCost, 0);

    // Calculate percentiles
    let p50 = baseline;
    let p80 = baseline;
    let p95 = baseline;

    if (includeUncertainty) {
      if (monteCarloRuns > 0) {
        // Use Monte Carlo for more accurate estimates
        const mcResults = runMonteCarlo(lineItems, monteCarloRuns);
        p50 = mcResults.p50;
        p80 = mcResults.p80;
        p95 = mcResults.p95;
      } else {
        // Use simplified parametric method
        p50 = lineItems.reduce((sum, item) => sum + applyUncertainty(item, 'p50'), 0);
        p80 = lineItems.reduce((sum, item) => sum + applyUncertainty(item, 'p80'), 0);
        p95 = lineItems.reduce((sum, item) => sum + applyUncertainty(item, 'p95'), 0);
      }
    }

    // Group by trade
    const byTrade = Object.entries(
      lineItems.reduce((acc, item) => {
        if (!acc[item.trade]) {
          acc[item.trade] = {
            items: [],
            baseline: 0
          };
        }
        acc[item.trade].items.push(item);
        acc[item.trade].baseline += item.totalCost;
        return acc;
      }, {} as Record<string, { items: LineItem[]; baseline: number }>)
    ).map(([trade, data]) => {
      let tradep50 = data.baseline;
      let tradep80 = data.baseline;
      let tradep95 = data.baseline;

      if (includeUncertainty) {
        tradep50 = data.items.reduce((sum, item) => sum + applyUncertainty(item, 'p50'), 0);
        tradep80 = data.items.reduce((sum, item) => sum + applyUncertainty(item, 'p80'), 0);
        tradep95 = data.items.reduce((sum, item) => sum + applyUncertainty(item, 'p95'), 0);
      }

      return {
        trade,
        baseline: data.baseline,
        p50: tradep50,
        p80: tradep80,
        p95: tradep95
      };
    });

    // Find top drivers of uncertainty
    const drivers = lineItems
      .map(item => {
        const p80Cost = applyUncertainty(item, 'p80');
        const uncertaintyImpact = p80Cost - item.totalCost;
        return {
          trade: item.trade,
          task: item.task,
          contribution: item.totalCost / baseline,
          uncertaintyImpact: uncertaintyImpact / (p80 - baseline)
        };
      })
      .sort((a, b) => b.uncertaintyImpact - a.uncertaintyImpact)
      .slice(0, 5);

    return {
      dealId,
      baseline,
      p50,
      p80,
      p95,
      byTrade,
      drivers,
      metadata: {
        region,
        grade,
        monteCarloRuns: includeUncertainty && monteCarloRuns > 0 ? monteCarloRuns : undefined,
        computedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error({ error, dealId }, 'Failed to generate estimate');
    throw error;
  }
}

/**
 * Checks if P80 exceeds max exposure (Gate G1)
 */
export async function checkMaxExposure(dealId: string): Promise<{
  passed: boolean;
  p80: number;
  maxExposure: number;
  drivers?: any[];
}> {
  try {
    const deal = await prisma.dealSpec.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const estimation = await estimate({ dealId });
    const passed = estimation.p80 <= deal.maxExposureUsd;

    return {
      passed,
      p80: estimation.p80,
      maxExposure: deal.maxExposureUsd,
      drivers: !passed ? estimation.drivers : undefined
    };
  } catch (error) {
    logger.error({ error, dealId }, 'Failed to check max exposure');
    throw error;
  }
}

export default {
  estimate,
  checkMaxExposure
};