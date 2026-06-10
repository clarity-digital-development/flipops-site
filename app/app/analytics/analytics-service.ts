import {
  KPIMetrics,
  FunnelStage,
  MarketingMetrics,
  DealProfitability,
  TeamMetrics,
  VendorMetrics,
  DashboardFilters,
  TrendData,
  ComparisonPeriod
} from './types';
import { analyticsSeedData } from './seed-data';

const {
  factLeads,
  factMarketingSpend,
  factDeals,
  factActivities,
  factVendorJobs,
  dimChannels,
  dimCampaigns,
  dimMarkets,
  dimUsers,
  dimVendors
} = analyticsSeedData;

function applyDateFilter<T extends { [key: string]: any }>(
  data: T[],
  dateField: keyof T,
  filters?: DashboardFilters
): T[] {
  if (!filters?.dateRange) return data;
  
  const fromKey = filters.dateRange.from.toISOString().split('T')[0].replace(/-/g, '');
  const toKey = filters.dateRange.to.toISOString().split('T')[0].replace(/-/g, '');
  
  return data.filter(item => {
    const dateKey = item[dateField] as string;
    return dateKey && dateKey >= fromKey && dateKey <= toKey;
  });
}

function applyFilters<T extends { [key: string]: any }>(
  data: T[],
  filters?: DashboardFilters,
  mappings?: { [key: string]: keyof T }
): T[] {
  if (!filters) return data;
  
  let filtered = [...data];
  
  if (filters.markets && filters.markets.length > 0) {
    const field = mappings?.markets || 'marketId';
    filtered = filtered.filter(item => 
      filters.markets!.includes(item[field] as string)
    );
  }
  
  if (filters.channels && filters.channels.length > 0) {
    const field = mappings?.channels || 'channelId';
    filtered = filtered.filter(item => 
      filters.channels!.includes(item[field] as string)
    );
  }
  
  if (filters.campaigns && filters.campaigns.length > 0) {
    const field = mappings?.campaigns || 'campaignId';
    filtered = filtered.filter(item => 
      filters.campaigns!.includes(item[field] as string)
    );
  }
  
  if (filters.dealTypes && filters.dealTypes.length > 0) {
    const field = mappings?.dealTypes || 'dealType';
    filtered = filtered.filter(item => 
      filters.dealTypes!.includes(item[field] as string)
    );
  }
  
  if (filters.users && filters.users.length > 0) {
    const field = mappings?.users || 'userId';
    filtered = filtered.filter(item => 
      filters.users!.includes(item[field] as string)
    );
  }
  
  return filtered;
}

export function calculateKPIs(filters?: DashboardFilters): KPIMetrics {
  const leads = applyFilters(applyDateFilter(factLeads, 'createdDateKey', filters), filters);
  const deals = applyFilters(applyDateFilter(factDeals, 'contractedDateKey', filters), filters);
  const spend = applyDateFilter(factMarketingSpend, 'dateKey', filters);
  
  const qualifiedLeads = leads.filter(l => l.qualifiedDateKey);
  const appointments = leads.filter(l => l.appointmentSetDateKey);
  const offers = leads.filter(l => l.offerDateKey);
  const contracts = deals.filter(d => d.contractedDateKey);
  const closedDeals = deals.filter(d => d.closedDateKey);
  
  const totalSpend = spend.reduce((sum, s) => sum + s.spendUsd, 0);
  
  const grossProfit = closedDeals.reduce((sum, deal) => {
    if (deal.dealType === 'Wholesale') {
      return sum + (deal.assignmentFeeUsd || 0);
    }
    // For flips and other deal types, gross profit is revenue minus costs
    const revenue = deal.revenueUsd || 0;
    const costs = deal.purchasePriceUsd + 
                  (deal.rehabActualUsd || 0) + 
                  (deal.holdingCostsUsd || 0) + 
                  (deal.closingCostsBuyUsd || 0) + 
                  (deal.closingCostsSellUsd || 0);
    return sum + Math.max(0, revenue - costs);
  }, 0);
  
  const netProfit = closedDeals.reduce((sum, deal) => {
    let dealProfit = 0;
    
    if (deal.dealType === 'Wholesale') {
      // Wholesale profit is assignment fee minus marketing and vendor costs
      dealProfit = (deal.assignmentFeeUsd || 0) - 
                   (deal.marketingAllocatedUsd || 0) - 
                   (deal.vendorCostsUsd || 0);
    } else {
      // For other deals, calculate full P&L
      const revenue = deal.revenueUsd || 0;
      const costs = deal.purchasePriceUsd + 
                    (deal.rehabActualUsd || 0) + 
                    (deal.holdingCostsUsd || 0) + 
                    (deal.closingCostsBuyUsd || 0) + 
                    (deal.closingCostsSellUsd || 0) +
                    (deal.marketingAllocatedUsd || 0) + 
                    (deal.vendorCostsUsd || 0);
      dealProfit = revenue - costs;
    }
    
    return sum + Math.max(0, dealProfit);
  }, 0);
  
  const totalRevenue = closedDeals.reduce((sum, d) => sum + (d.revenueUsd || 0), 0);
  
  const speedToLeadTimes = leads
    .filter(l => l.firstContactedDateKey && l.createdDateKey)
    .map(l => {
      const created = new Date(l.createdDateKey.slice(0, 4) + '-' + l.createdDateKey.slice(4, 6) + '-' + l.createdDateKey.slice(6, 8));
      const contacted = new Date(l.firstContactedDateKey!.slice(0, 4) + '-' + l.firstContactedDateKey!.slice(4, 6) + '-' + l.firstContactedDateKey!.slice(6, 8));
      return (contacted.getTime() - created.getTime()) / (1000 * 60);
    });
  
  const daysToContractTimes = deals
    .filter(d => d.daysToContract)
    .map(d => d.daysToContract!);
  
  return {
    leads: leads.length,
    qualifiedLeads: qualifiedLeads.length,
    appointments: appointments.length,
    offers: offers.length,
    contracts: contracts.length,
    closedDeals: closedDeals.length,
    netProfit,
    grossProfit,
    totalSpend,
    romi: totalSpend > 0 ? (netProfit / totalSpend) : 0,
    roas: totalSpend > 0 ? (totalRevenue / totalSpend) : 0,
    avgDaysToContract: daysToContractTimes.length > 0 ? 
      daysToContractTimes.reduce((a, b) => a + b, 0) / daysToContractTimes.length : 0,
    avgSpeedToLead: speedToLeadTimes.length > 0 ?
      speedToLeadTimes.reduce((a, b) => a + b, 0) / speedToLeadTimes.length : 0,
    conversionRate: leads.length > 0 ? (closedDeals.length / leads.length) : 0
  };
}

export function calculateFunnel(filters?: DashboardFilters): FunnelStage[] {
  const leads = applyFilters(applyDateFilter(factLeads, 'createdDateKey', filters), filters);
  const deals = applyFilters(applyDateFilter(factDeals, 'contractedDateKey', filters), filters);
  
  const stages: FunnelStage[] = [
    {
      stage: 'Leads',
      count: leads.length,
      percentage: 100
    },
    {
      stage: 'Qualified',
      count: leads.filter(l => l.qualifiedDateKey).length,
      percentage: 0
    },
    {
      stage: 'Appointments',
      count: leads.filter(l => l.appointmentSetDateKey).length,
      percentage: 0
    },
    {
      stage: 'Offers',
      count: leads.filter(l => l.offerDateKey).length,
      percentage: 0
    },
    {
      stage: 'Contracts',
      count: deals.filter(d => d.contractedDateKey).length,
      percentage: 0
    },
    {
      stage: 'Closed',
      count: deals.filter(d => d.closedDateKey).length,
      percentage: 0
    }
  ];
  
  for (let i = 1; i < stages.length; i++) {
    stages[i].percentage = leads.length > 0 ? (stages[i].count / leads.length) * 100 : 0;
    stages[i - 1].conversionToNext = stages[i - 1].count > 0 ? 
      (stages[i].count / stages[i - 1].count) * 100 : 0;
  }
  
  return stages;
}

export function calculateMarketingMetrics(filters?: DashboardFilters): MarketingMetrics[] {
  const leads = applyFilters(applyDateFilter(factLeads, 'createdDateKey', filters), filters);
  const deals = applyFilters(applyDateFilter(factDeals, 'contractedDateKey', filters), filters);
  const spend = applyDateFilter(factMarketingSpend, 'dateKey', filters);
  
  // Group channels by name to combine PPC from different platforms
  const channelGroups = new Map<string, typeof dimChannels[0][]>();
  for (const channel of dimChannels) {
    const existing = channelGroups.get(channel.name) || [];
    existing.push(channel);
    channelGroups.set(channel.name, existing);
  }
  
  const metrics: MarketingMetrics[] = [];
  
  for (const [channelName, channels] of channelGroups) {
    const channelIds = channels.map(c => c.id);
    const channelCampaigns = dimCampaigns.filter(c => channelIds.includes(c.channelId));
    const campaignIds = channelCampaigns.map(c => c.id);
    
    const channelSpend = spend
      .filter(s => campaignIds.includes(s.campaignId))
      .reduce((sum, s) => sum + s.spendUsd, 0);
    
    const channelLeads = leads.filter(l => channelIds.includes(l.channelId));
    const channelLeadIds = channelLeads.map(l => l.leadId);
    
    const channelDeals = deals.filter(d => {
      const lead = factLeads.find(l => channelLeadIds.includes(l.leadId));
      return lead && channelIds.includes(lead.channelId);
    });
    
    const contracts = channelDeals.filter(d => d.contractedDateKey);
    const closed = channelDeals.filter(d => d.closedDateKey);
    
    const revenue = closed.reduce((sum, d) => sum + (d.revenueUsd || 0), 0);
    const profit = closed.reduce((sum, d) => {
      const dealGross = d.dealType === 'Wholesale' ? 
        (d.assignmentFeeUsd || 0) :
        (d.revenueUsd || 0) - d.purchasePriceUsd - 
        (d.rehabActualUsd || 0) - (d.holdingCostsUsd || 0) - 
        (d.closingCostsBuyUsd || 0) - (d.closingCostsSellUsd || 0);
      
      return sum + dealGross - (d.marketingAllocatedUsd || 0) - (d.vendorCostsUsd || 0);
    }, 0);
    
    metrics.push({
      channel: channelName,
      spend: channelSpend,
      leads: channelLeads.length,
      contracts: contracts.length,
      closedDeals: closed.length,
      cpl: channelLeads.length > 0 ? channelSpend / channelLeads.length : 0,
      cpa: contracts.length > 0 ? channelSpend / contracts.length : 0,
      cpd: closed.length > 0 ? channelSpend / closed.length : 0,
      roas: channelSpend > 0 ? revenue / channelSpend : 0,
      romi: channelSpend > 0 ? (profit - channelSpend) / channelSpend : 0
    });
  }
  
  return metrics;
}

export function calculateDealProfitability(filters?: DashboardFilters): DealProfitability[] {
  const deals = applyFilters(applyDateFilter(factDeals, 'closedDateKey', filters), filters)
    .filter(d => d.closedDateKey);
  
  return deals.map(deal => {
    const grossProfit = deal.dealType === 'Wholesale' ? 
      (deal.assignmentFeeUsd || 0) :
      (deal.revenueUsd || 0) - deal.purchasePriceUsd - 
      (deal.rehabActualUsd || 0) - (deal.holdingCostsUsd || 0) - 
      (deal.closingCostsBuyUsd || 0) - (deal.closingCostsSellUsd || 0);
    
    const netProfit = grossProfit - (deal.marketingAllocatedUsd || 0) - (deal.vendorCostsUsd || 0);
    
    const totalInvestment = deal.purchasePriceUsd + 
      (deal.rehabActualUsd || 0) + 
      (deal.holdingCostsUsd || 0) + 
      (deal.closingCostsBuyUsd || 0) + 
      (deal.closingCostsSellUsd || 0) +
      (deal.marketingAllocatedUsd || 0) + 
      (deal.vendorCostsUsd || 0);
    
    return {
      dealId: deal.dealId,
      dealType: deal.dealType,
      revenue: deal.revenueUsd || 0,
      purchasePrice: deal.purchasePriceUsd,
      rehabCost: deal.rehabActualUsd || 0,
      holdingCost: deal.holdingCostsUsd || 0,
      closingCosts: (deal.closingCostsBuyUsd || 0) + (deal.closingCostsSellUsd || 0),
      marketingCost: deal.marketingAllocatedUsd || 0,
      vendorCost: deal.vendorCostsUsd || 0,
      grossProfit,
      netProfit,
      margin: (deal.revenueUsd || 0) > 0 ? netProfit / (deal.revenueUsd || 1) : 0,
      moic: totalInvestment > 0 ? (deal.revenueUsd || 0) / totalInvestment : 0,
      arvDiscount: deal.arvUsd > 0 ? 1 - (deal.purchasePriceUsd / deal.arvUsd) : 0
    };
  });
}

export function calculateTeamMetrics(filters?: DashboardFilters): TeamMetrics[] {
  const activities = applyFilters(applyDateFilter(factActivities, 'createdDateKey', filters), filters, { users: 'userId' });
  const leads = applyFilters(applyDateFilter(factLeads, 'createdDateKey', filters), filters);
  const deals = applyFilters(applyDateFilter(factDeals, 'contractedDateKey', filters), filters);
  
  const metrics: TeamMetrics[] = [];
  
  for (const user of dimUsers.filter(u => ['Acquisition', 'Disposition', 'Account Manager'].includes(u.role))) {
    const userActivities = activities.filter(a => a.userId === user.id);
    const userLeads = leads.filter(l => l.userOwnerId === user.id);
    const userDeals = deals.filter(d => d.acqUserId === user.id || d.dispoUserId === user.id);
    
    const calls = userActivities.filter(a => a.activityType === 'Call');
    const appointments = userLeads.filter(l => l.appointmentSetDateKey);
    const offers = userLeads.filter(l => l.offerDateKey);
    const contracts = userDeals.filter(d => d.contractedDateKey);
    
    const responseTimes = userLeads
      .filter(l => l.firstContactedDateKey && l.createdDateKey)
      .map(l => {
        const created = new Date(l.createdDateKey.slice(0, 4) + '-' + l.createdDateKey.slice(4, 6) + '-' + l.createdDateKey.slice(6, 8));
        const contacted = new Date(l.firstContactedDateKey!.slice(0, 4) + '-' + l.firstContactedDateKey!.slice(4, 6) + '-' + l.firstContactedDateKey!.slice(6, 8));
        return (contacted.getTime() - created.getTime()) / (1000 * 60);
      });
    
    const touchedWithin24h = userLeads.filter(l => {
      if (!l.firstContactedDateKey) return false;
      const created = new Date(l.createdDateKey.slice(0, 4) + '-' + l.createdDateKey.slice(4, 6) + '-' + l.createdDateKey.slice(6, 8));
      const contacted = new Date(l.firstContactedDateKey.slice(0, 4) + '-' + l.firstContactedDateKey.slice(4, 6) + '-' + l.firstContactedDateKey.slice(6, 8));
      return (contacted.getTime() - created.getTime()) <= (24 * 60 * 60 * 1000);
    });
    
    const daysActive = filters?.dateRange ? 
      Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) : 
      30;
    
    metrics.push({
      userId: user.id,
      userName: user.name,
      role: user.role,
      touchesPerDay: daysActive > 0 ? userActivities.length / daysActive : 0,
      firstResponseTime: responseTimes.length > 0 ?
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      appointmentSetRate: userLeads.length > 0 ? appointments.length / userLeads.length : 0,
      offerRate: appointments.length > 0 ? offers.length / appointments.length : 0,
      winRate: offers.length > 0 ? contracts.length / offers.length : 0,
      followUpSLA: userLeads.length > 0 ? touchedWithin24h.length / userLeads.length : 0,
      totalActivities: userActivities.length,
      totalDeals: userDeals.length,
      totalRevenue: userDeals.reduce((sum, d) => sum + (d.revenueUsd || 0), 0)
    });
  }
  
  return metrics;
}

export function calculateVendorMetrics(filters?: DashboardFilters): VendorMetrics[] {
  const jobs = applyFilters(applyDateFilter(factVendorJobs, 'startDateKey', filters), filters, { vendors: 'vendorId' });
  
  const metrics: VendorMetrics[] = [];
  
  for (const vendor of dimVendors) {
    const vendorJobs = jobs.filter(j => j.vendorId === vendor.id);
    
    if (vendorJobs.length === 0) continue;
    
    const completedJobs = vendorJobs.filter(j => j.completedDateKey);
    const onTimeJobs = completedJobs.filter(j => j.onTime);
    const jobsWithChangeOrders = vendorJobs.filter(j => j.changeOrdersCount > 0);
    
    const quoteVariances = vendorJobs
      .filter(j => j.actualUsd && j.quotedUsd)
      .map(j => ((j.actualUsd! - j.quotedUsd) / j.quotedUsd) * 100);
    
    const ratings = vendorJobs
      .filter(j => j.ratingGiven)
      .map(j => j.ratingGiven!);
    
    metrics.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      category: vendor.category,
      totalJobs: vendorJobs.length,
      onTimePercentage: completedJobs.length > 0 ? (onTimeJobs.length / completedJobs.length) * 100 : 0,
      quoteVariance: quoteVariances.length > 0 ?
        quoteVariances.reduce((a, b) => a + b, 0) / quoteVariances.length : 0,
      avgRating: ratings.length > 0 ?
        ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      changeOrderRate: vendorJobs.length > 0 ? (jobsWithChangeOrders.length / vendorJobs.length) * 100 : 0,
      totalSpend: vendorJobs.reduce((sum, j) => sum + (j.actualUsd || j.quotedUsd), 0),
      avgJobValue: vendorJobs.length > 0 ?
        vendorJobs.reduce((sum, j) => sum + (j.actualUsd || j.quotedUsd), 0) / vendorJobs.length : 0
    });
  }
  
  return metrics;
}

export function calculateTrends(
  metric: 'leads' | 'revenue' | 'profit' | 'spend',
  filters?: DashboardFilters,
  granularity: 'day' | 'week' | 'month' = 'week'
): TrendData[] {
  const trends: TrendData[] = [];
  
  if (!filters?.dateRange) {
    filters = {
      ...filters,
      dateRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date()
      }
    };
  }
  
  const start = filters.dateRange?.from || new Date();
  const end = filters.dateRange?.to || new Date();
  const current = new Date(start);
  
  while (current <= end) {
    let periodEnd = new Date(current);
    
    if (granularity === 'day') {
      periodEnd = new Date(current);
    } else if (granularity === 'week') {
      periodEnd = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000);
    } else if (granularity === 'month') {
      periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    }
    
    if (periodEnd > end) periodEnd = end;
    
    const periodFilters = {
      ...filters,
      dateRange: { from: current, to: periodEnd }
    };
    
    let value = 0;
    
    switch (metric) {
      case 'leads':
        value = applyFilters(applyDateFilter(factLeads, 'createdDateKey', periodFilters), periodFilters).length;
        break;
      case 'revenue':
        value = applyFilters(applyDateFilter(factDeals, 'closedDateKey', periodFilters), periodFilters)
          .reduce((sum, d) => sum + (d.revenueUsd || 0), 0);
        break;
      case 'profit':
        const kpis = calculateKPIs(periodFilters);
        value = kpis.netProfit;
        break;
      case 'spend':
        value = applyDateFilter(factMarketingSpend, 'dateKey', periodFilters)
          .reduce((sum, s) => sum + s.spendUsd, 0);
        break;
    }
    
    trends.push({
      date: new Date(current),
      value
    });
    
    if (granularity === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (granularity === 'week') {
      current.setDate(current.getDate() + 7);
    } else if (granularity === 'month') {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return trends;
}

export function compareWithPeriod(
  currentFilters: DashboardFilters,
  comparison: ComparisonPeriod
): { current: KPIMetrics; previous: KPIMetrics; changes: { [key: string]: number } } {
  const current = calculateKPIs(currentFilters);
  
  let previousFilters = { ...currentFilters };
  
  if (comparison.type === 'previous' && currentFilters.dateRange) {
    const duration = currentFilters.dateRange.to.getTime() - currentFilters.dateRange.from.getTime();
    previousFilters.dateRange = {
      from: new Date(currentFilters.dateRange.from.getTime() - duration),
      to: new Date(currentFilters.dateRange.to.getTime() - duration)
    };
  } else if (comparison.type === 'yoy' && currentFilters.dateRange) {
    previousFilters.dateRange = {
      from: new Date(currentFilters.dateRange.from.getFullYear() - 1, currentFilters.dateRange.from.getMonth(), currentFilters.dateRange.from.getDate()),
      to: new Date(currentFilters.dateRange.to.getFullYear() - 1, currentFilters.dateRange.to.getMonth(), currentFilters.dateRange.to.getDate())
    };
  } else if (comparison.type === 'custom' && comparison.customFrom && comparison.customTo) {
    previousFilters.dateRange = {
      from: comparison.customFrom,
      to: comparison.customTo
    };
  }
  
  const previous = calculateKPIs(previousFilters);
  
  const changes: { [key: string]: number } = {};
  
  for (const key in current) {
    const currentValue = current[key as keyof KPIMetrics];
    const previousValue = previous[key as keyof KPIMetrics];
    
    if (typeof currentValue === 'number' && typeof previousValue === 'number') {
      changes[key] = previousValue !== 0 ? 
        ((currentValue - previousValue) / previousValue) * 100 : 
        currentValue > 0 ? 100 : 0;
    }
  }
  
  return { current, previous, changes };
}

export function getProfitWaterfall(dealId?: string, filters?: DashboardFilters): Array<{ stage: string; value: number; isProfit?: boolean }> {
  let deals = applyFilters(applyDateFilter(factDeals, 'closedDateKey', filters), filters)
    .filter(d => d.closedDateKey);
  
  if (dealId) {
    deals = deals.filter(d => d.dealId === dealId);
  }
  
  if (deals.length === 0) return [];
  
  const totals = deals.reduce((acc, deal) => {
    acc.revenue += deal.revenueUsd || 0;
    acc.purchase += deal.purchasePriceUsd;
    acc.rehab += deal.rehabActualUsd || 0;
    acc.holding += deal.holdingCostsUsd || 0;
    acc.closingBuy += deal.closingCostsBuyUsd || 0;
    acc.closingSell += deal.closingCostsSellUsd || 0;
    acc.marketing += deal.marketingAllocatedUsd || 0;
    acc.vendor += deal.vendorCostsUsd || 0;
    return acc;
  }, {
    revenue: 0,
    purchase: 0,
    rehab: 0,
    holding: 0,
    closingBuy: 0,
    closingSell: 0,
    marketing: 0,
    vendor: 0
  });
  
  const grossProfit = totals.revenue - totals.purchase;
  const netProfit = totals.revenue - totals.purchase - totals.rehab - 
    totals.holding - totals.closingBuy - totals.closingSell - 
    totals.marketing - totals.vendor;
  
  // Show a waterfall that makes sense for demo
  return [
    { stage: 'Revenue', value: totals.revenue, isProfit: true },
    { stage: 'Purchase', value: totals.purchase },
    { stage: 'Gross Profit', value: grossProfit, isProfit: true },
    { stage: 'Rehab', value: totals.rehab },
    { stage: 'Holding', value: totals.holding },
    { stage: 'Closing', value: totals.closingBuy + totals.closingSell },
    { stage: 'Marketing', value: totals.marketing },
    { stage: 'Net Profit', value: netProfit, isProfit: true }
  ];
}

export function getHeatmapData(
  xAxis: 'market' | 'channel' | 'campaign',
  yAxis: 'market' | 'channel' | 'campaign',
  metric: 'romi' | 'roas' | 'cpl' | 'conversion',
  filters?: DashboardFilters
): Array<{ x: string; y: string; value: number }> {
  const data: Array<{ x: string; y: string; value: number }> = [];
  
  const xItems = xAxis === 'market' ? dimMarkets : 
                 xAxis === 'channel' ? dimChannels : 
                 dimCampaigns;
  
  const yItems = yAxis === 'market' ? dimMarkets : 
                 yAxis === 'channel' ? dimChannels : 
                 dimCampaigns;
  
  for (const xItem of xItems) {
    for (const yItem of yItems) {
      const itemFilters = { ...filters };
      
      if (xAxis === 'market') itemFilters.markets = [xItem.id];
      if (xAxis === 'channel') itemFilters.channels = [xItem.id];
      if (xAxis === 'campaign') itemFilters.campaigns = [xItem.id];
      
      if (yAxis === 'market' && yAxis !== xAxis) itemFilters.markets = [...(itemFilters.markets || []), yItem.id];
      if (yAxis === 'channel' && yAxis !== xAxis) itemFilters.channels = [...(itemFilters.channels || []), yItem.id];
      if (yAxis === 'campaign' && yAxis !== xAxis) itemFilters.campaigns = [...(itemFilters.campaigns || []), yItem.id];
      
      const kpis = calculateKPIs(itemFilters);
      
      let value = 0;
      switch (metric) {
        case 'romi':
          value = kpis.romi ?? 0;
          break;
        case 'roas':
          value = kpis.roas ?? 0;
          break;
        case 'cpl':
          value = kpis.leads > 0 ? (kpis.totalSpend ?? 0) / kpis.leads : 0;
          break;
        case 'conversion':
          value = (kpis.conversionRate ?? 0) * 100;
          break;
      }
      
      data.push({
        x: 'name' in xItem ? xItem.name : xItem.city,
        y: 'name' in yItem ? yItem.name : yItem.city,
        value
      });
    }
  }
  
  return data;
}