import { prisma } from "./prisma";
import { estimate } from "./estimator";
import { toPct, safePct } from "./panel-utils";

// Map recent gate states from Events (last 7d, most recent win)
function gateStateFromEvents(events: any[]) {
  const pick = (artifact: string, includes: string[]) =>
    events.find(e => e.artifact === artifact && includes.includes(e.action))?.action || "N/A";

  const g1 = pick("DealSpec", ["APPROVE", "BLOCK"]);
  const g2 = pick("Bid", ["AWARD", "BLOCK"]);
  const g3 = pick("Budget", ["OK", "FREEZE_TIER1", "ESCALATE_TIER2"]);
  const g4 = pick("ChangeOrder", ["APPROVE_CO", "DENY"]);

  return {
    g1: g1 === "APPROVE" ? "APPROVED" : g1 === "BLOCK" ? "BLOCKED" : "N/A",
    g2: g2 === "AWARD" ? "OK" : g2 === "BLOCK" ? "BLOCKED" : "N/A",
    g3: g3 === "OK" ? "GREEN" : g3 === "FREEZE_TIER1" ? "TIER1" : g3 === "ESCALATE_TIER2" ? "TIER2" : "N/A",
    g4: g4 === "APPROVE_CO" ? "HEALTHY" : g4 === "DENY" ? "DENIED_RECENT" : "N/A"
  };
}

export async function buildTruthPanel(dealId: string) {
  const deal = await prisma.dealSpec.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Deal not found");

  // TODO: Add region and grade to DealSpec or derive from constraints
  const region = (deal as any).region ?? "Miami";
  const grade = (deal as any).grade ?? "Standard";

  // Policy is unique on (userId, region, grade); panels run without user
  // context, so prefer the global default policy (userId null).
  const policy = await prisma.policy.findFirst({
    where: { region, grade },
    orderBy: { userId: { sort: 'asc', nulls: 'first' } }
  });
  if (!policy) throw new Error("Policy missing");

  // Run the estimator to get probabilistic estimates
  const est = await estimate({ dealId, region, grade });

  const headroomAmt = Math.max(0, policy.maxExposureUsd - est.p80);
  const headroomPct = safePct(headroomAmt, Math.max(1, policy.maxExposureUsd));

  // Contingency remaining = (target % * baseline) - (ledger actuals over baseline?)
  const ledger = await prisma.budgetLedger.findUnique({ where: { dealId } });
  const targetContUsd = Math.round((policy.contingencyTargetPct ?? 0.12) * est.baseline);
  const consumed = Math.max(0, ((ledger?.actuals as any)?.total ?? 0) - est.baseline);
  const remaining = Math.max(0, targetContUsd - consumed);

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const events = await prisma.event.findMany({
    where: { dealId, ts: { gte: since } },
    orderBy: { ts: "desc" },
    take: 50
  });

  const status = gateStateFromEvents(events);

  // Suggest actions
  const actions: string[] = [];
  if (headroomPct < 0.05) actions.push("NEGOTIATE_SCOPE_OR_PRICE");
  if (status.g2 === "BLOCKED") actions.push("REVIEW_SCOPE_MISMATCH_BIDS");
  if (status.g3 === "TIER2") actions.push("RUN_COG_SIMULATION");

  // Convert drivers to simple format for the panel
  const drivers = est.drivers ? est.drivers.slice(0, 3).map(d => ({
    trade: d.trade,
    delta: Math.round(d.uncertaintyImpact * (est.p80 - est.baseline))
  })) : [];

  return {
    dealId,
    policy: {
      maxExposureUsd: Math.round(policy.maxExposureUsd),
      targetRoiPct: policy.targetRoiPct
    },
    estimate: {
      baseline: Math.round(est.baseline),
      p50: Math.round(est.p50),
      p80: Math.round(est.p80),
      p95: Math.round(est.p95)
    },
    headroom: {
      amount: Math.round(headroomAmt),
      pct: toPct(headroomPct)
    },
    contingency: {
      targetPct: toPct(policy.contingencyTargetPct ?? 0.12),
      remainingUsd: Math.round(remaining)
    },
    drivers,
    status,
    actions
  };
}

export async function buildMoneyPanel(dealId: string) {
  const ledger = await prisma.budgetLedger.findUnique({ where: { dealId } });

  if (!ledger) {
    return {
      dealId,
      budget: { baseline: 0, committed: 0, actuals: 0, variance: { abs: 0, pct: 0 } },
      byTrade: [],
      changeOrders: { count: 0, approved: 0, denied: 0, netImpactUsd: 0, approvalLatencyHours: 0 },
      invoices: { count: 0, avgApprovalLatencyHours: 0 },
      burn: { dailyUsd: 0, daysHeld: 0, carryToDateUsd: 0 }
    };
  }

  // Parse JSON fields
  const baselineData = (ledger.baseline as any) || {};
  const committedData = (ledger.committed as any) || {};
  const actualsData = (ledger.actuals as any) || {};
  const varianceData = (ledger.variance as any) || {};

  const baseline = baselineData.total || 0;
  const committed = committedData.total || 0;
  const actuals = actualsData.total || 0;

  const varianceAbs = actuals - baseline;
  const variancePct = baseline > 0 ? varianceAbs / baseline : 0;

  // Build by-trade breakdown
  const trades = new Set([
    ...Object.keys(baselineData.byTrade || {}),
    ...Object.keys(committedData.byTrade || {}),
    ...Object.keys(actualsData.byTrade || {})
  ]);

  const byTrade = Array.from(trades).map(trade => {
    const b = baselineData.byTrade?.[trade] || 0;
    const c = committedData.byTrade?.[trade] || 0;
    const a = actualsData.byTrade?.[trade] || 0;
    const vAbs = a - b;
    const vPct = b > 0 ? vAbs / b : 0;

    // Check if trade is frozen (from variance data)
    const frozen = varianceData.frozenTrades?.includes(trade) || false;

    return {
      trade,
      baseline: Math.round(b),
      committed: Math.round(c),
      actuals: Math.round(a),
      varianceAbs: Math.round(vAbs),
      variancePct: toPct(vPct),
      frozen
    };
  });

  // Change orders metrics
  const cos = await prisma.changeOrder.findMany({ where: { dealId } });
  const approved = cos.filter(c => c.status === "approved");
  const denied = cos.filter(c => c.status === "denied");
  const netImpactUsd = approved.reduce((s, c) => s + Math.max(0, c.deltaUsd), 0);
  const approvalLatencyHours = approved.length
    ? Math.round(
        approved.reduce((s, c) => {
          if (c.decidedAt) {
            return s + ((+new Date(c.decidedAt) - +new Date(c.createdAt)) / 36e5);
          }
          return s;
        }, 0) / approved.length
      )
    : 0;

  // Invoices latency
  const invoices = await prisma.invoice.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" }
  });
  const invLatency = invoices.length > 1
    ? Math.round(
        ((+new Date(invoices[invoices.length - 1].createdAt) - +new Date(invoices[0].createdAt)) / 36e5) /
        (invoices.length - 1)
      )
    : 0;

  // Burn rate calculation
  const deal = await prisma.dealSpec.findUnique({ where: { id: dealId } });
  const startAt = (deal as any)?.startAt;
  const startMs = startAt ? +new Date(startAt) :
                  (invoices[0]?.createdAt ? +new Date(invoices[0].createdAt) : Date.now());
  const daysHeld = Math.max(0, Math.round((Date.now() - startMs) / 86400000));
  const dailyUsd = (deal as any)?.dailyBurnUsd ?? 0;
  const carryToDateUsd = dailyUsd * daysHeld;

  return {
    dealId,
    budget: {
      baseline: Math.round(baseline),
      committed: Math.round(committed),
      actuals: Math.round(actuals),
      variance: {
        abs: Math.round(varianceAbs),
        pct: toPct(variancePct)
      }
    },
    byTrade,
    changeOrders: {
      count: cos.length,
      approved: approved.length,
      denied: denied.length,
      netImpactUsd: Math.round(netImpactUsd),
      approvalLatencyHours
    },
    invoices: {
      count: invoices.length,
      avgApprovalLatencyHours: invLatency
    },
    burn: {
      dailyUsd: Math.round(dailyUsd),
      daysHeld,
      carryToDateUsd: Math.round(carryToDateUsd)
    }
  };
}

export async function buildMotionPanel(dealId: string) {
  // Milestones - infer from Events
  const events = await prisma.event.findMany({
    where: { dealId },
    orderBy: { ts: "desc" },
    take: 100
  });

  // Count completed milestones
  const completedMilestones = events.filter(e =>
    (e.artifact === "DealSpec" && e.action === "APPROVE") ||
    (e.artifact === "Bid" && e.action === "AWARD") ||
    (e.artifact === "Budget" && ["OK", "FREEZE_TIER1", "ESCALATE_TIER2"].includes(e.action)) ||
    (e.artifact === "ChangeOrder" && e.action === "APPROVE_CO")
  ).length;

  const plannedMilestones = 6; // TODO: Pull from a Milestone model later
  const percentComplete = plannedMilestones
    ? Math.min(100, Math.round((completedMilestones / plannedMilestones) * 100))
    : 0;

  // Bottlenecks - identify from recent events
  const bottlenecks: any[] = [];
  const blockedG2 = events.find(e => e.artifact === "Bid" && e.action === "BLOCK");
  if (blockedG2) {
    bottlenecks.push({
      type: "VENDOR",
      refId: blockedG2.id,
      ageHours: Math.round((Date.now() - +new Date(blockedG2.ts)) / 36e5),
      notes: "Bid spread too high"
    });
  }

  const tier2 = events.find(e => e.artifact === "Budget" && e.action === "ESCALATE_TIER2");
  if (tier2) {
    bottlenecks.push({
      type: "INVOICE",
      refId: tier2.id,
      ageHours: Math.round((Date.now() - +new Date(tier2.ts)) / 36e5),
      notes: "Budget variance Tier-2"
    });
  }

  const deniedCO = events.find(e => e.artifact === "ChangeOrder" && e.action === "DENY");
  if (deniedCO) {
    bottlenecks.push({
      type: "CHANGE_ORDER",
      refId: deniedCO.id,
      ageHours: Math.round((Date.now() - +new Date(deniedCO.ts)) / 36e5),
      notes: "CO denied; revise scope"
    });
  }

  // Vendor metrics
  const bids = await prisma.bid.findMany({ where: { dealId } });
  const invoices = await prisma.invoice.findMany({ where: { dealId } });

  const vendorMap: Record<string, {
    vendorId: string;
    name: string;
    bids: number;
    invs: number
  }> = {};

  bids.forEach(b => {
    if (!vendorMap[b.vendorId]) {
      vendorMap[b.vendorId] = {
        vendorId: b.vendorId,
        name: b.vendorId,
        bids: 0,
        invs: 0
      };
    }
    vendorMap[b.vendorId].bids++;
  });

  invoices.forEach(i => {
    if (i.vendorId) {
      if (!vendorMap[i.vendorId]) {
        vendorMap[i.vendorId] = {
          vendorId: i.vendorId,
          name: i.vendorId,
          bids: 0,
          invs: 0
        };
      }
      vendorMap[i.vendorId].invs++;
    }
  });

  // Get vendor names from Vendor table if available
  const vendorIds = Object.keys(vendorMap);
  if (vendorIds.length > 0) {
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } }
    });
    vendors.forEach(v => {
      if (vendorMap[v.id]) {
        vendorMap[v.id].name = v.name;
      }
    });
  }

  const vendorList = Object.values(vendorMap).map(v => ({
    vendorId: v.vendorId,
    name: v.name,
    reliabilityScore: Math.min(100, 50 + v.invs * 10 + v.bids * 5),
    avgBidTurnaroundHours: 24, // TODO: Compute from actual bid timestamps
    avgInvoiceLatencyHours: 48 // TODO: Compute from actual invoice approval times
  }));

  const recentEvents = events.slice(0, 12).map(e => ({
    ts: e.ts.toISOString(),
    artifact: e.artifact,
    action: e.action
  }));

  return {
    dealId,
    progress: {
      plannedMilestones,
      completedMilestones,
      percentComplete
    },
    bottlenecks,
    vendors: vendorList,
    recentEvents
  };
}