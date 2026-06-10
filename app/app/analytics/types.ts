export interface DimDate {
  dateKey: string;
  date: Date;
  week: number;
  month: number;
  quarter: number;
  year: number;
  monthName: string;
  dayOfWeek: string;
  isWeekend: boolean;
}

export interface DimChannel {
  id: string;
  name: 'PPC' | 'SEO' | 'Direct Mail' | 'Cold Call' | 'SMS' | 'Referral';
  platform?: 'Google' | 'Meta' | 'Bing' | 'LinkedIn' | 'Other';
  category: 'Digital' | 'Offline' | 'Organic';
}

export interface DimCampaign {
  id: string;
  name: string;
  channelId: string;
  marketId: string;
  startDate: Date;
  endDate?: Date;
  budget?: number;
  status: 'Active' | 'Paused' | 'Completed';
}

export interface DimMarket {
  id: string;
  city: string;
  state: string;
  zip: string;
  msa?: string;
  region?: string;
  population?: number;
}

export interface DimUser {
  id: string;
  name: string;
  email: string;
  role: 'Acquisition' | 'Disposition' | 'Account Manager' | 'Admin' | 'Executive';
  team?: string;
  startDate: Date;
  isActive: boolean;
}

export interface DimVendor {
  id: string;
  name: string;
  category: 'Contractor' | 'Plumber' | 'Electrician' | 'HVAC' | 'Roofer' | 'Landscaper' | 'Painter' | 'Flooring' | 'Other';
  rating?: number;
  isPreferred: boolean;
}

export interface DimProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  propertyType: 'SFH' | 'Condo' | 'Townhouse' | 'Multi-Family' | 'Land';
  lotSize?: number;
}

export interface FactLead {
  leadId: string;
  createdDateKey: string;
  firstContactedDateKey?: string;
  qualifiedDateKey?: string;
  appointmentSetDateKey?: string;
  offerDateKey?: string;
  currentStage: 'Lead' | 'Qualified' | 'Appointment' | 'Offer' | 'Contract' | 'Assigned' | 'Closed Lost';
  channelId: string;
  campaignId?: string;
  marketId: string;
  userOwnerId?: string;
  costsAttributionUsd?: number;
  leadScore?: number;
  source?: string;
}

export interface FactMarketingSpend {
  campaignId: string;
  dateKey: string;
  spendUsd: number;
  impressions?: number;
  clicks?: number;
  calls?: number;
  forms?: number;
  sms?: number;
  cpc?: number;
  cpl?: number;
  conversionRate?: number;
}

export interface FactDeal {
  dealId: string;
  propertyId: string;
  marketId: string;
  acqUserId?: string;
  dispoUserId?: string;
  contractedDateKey?: string;
  closedDateKey?: string;
  dispositionDateKey?: string;
  dealType: 'Wholesale' | 'Wholetail' | 'Flip' | 'Rental';
  stage: 'Contract' | 'Due Diligence' | 'Closing' | 'Closed' | 'Dead';
  revenueUsd?: number;
  purchasePriceUsd: number;
  arvUsd: number;
  rehabBudgetUsd?: number;
  rehabActualUsd?: number;
  holdingCostsUsd?: number;
  closingCostsBuyUsd?: number;
  closingCostsSellUsd?: number;
  marketingAllocatedUsd?: number;
  vendorCostsUsd?: number;
  otherIncomeUsd?: number;
  assignmentFeeUsd?: number;
  daysToContract?: number;
  daysToClose?: number;
}

export interface FactActivity {
  activityId: string;
  userId: string;
  leadId?: string;
  dealId?: string;
  activityType: 'Call' | 'SMS' | 'Email' | 'Appointment' | 'Offer' | 'Note' | 'Task';
  outcome?: 'Connected' | 'No Answer' | 'Left VM' | 'Wrong Number' | 'Not Interested' | 'Scheduled' | 'Completed';
  durationSec?: number;
  createdDateKey: string;
  createdTime: string;
}

export interface FactVendorJob {
  jobId: string;
  vendorId: string;
  dealId: string;
  category: string;
  quotedUsd: number;
  actualUsd?: number;
  startDateKey?: string;
  dueDateKey?: string;
  completedDateKey?: string;
  onTime?: boolean;
  changeOrdersCount: number;
  ratingGiven?: number;
  notes?: string;
}

export interface KPIMetrics {
  leads: number;
  qualifiedLeads: number;
  appointments: number | null;
  offers: number;
  contracts: number;
  closedDeals: number;
  netProfit: number;
  grossProfit: number;
  totalSpend: number | null;
  romi: number | null;
  roas: number | null;
  avgDaysToContract: number | null;
  avgSpeedToLead: number | null;
  conversionRate: number | null;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  conversionToNext?: number;
}

// Type alias (not interface) so it satisfies recharts' Record-based
// ChartDataInput via implicit index-signature compatibility.
export type MarketingMetrics = {
  channel: string;
  spend: number;
  leads: number;
  contracts: number;
  closedDeals: number;
  cpl: number;
  cpa: number;
  cpd: number;
  roas: number;
  romi: number;
};

export interface DealProfitability {
  dealId: string;
  dealType: string;
  revenue: number;
  purchasePrice: number;
  rehabCost: number;
  holdingCost: number;
  closingCosts: number;
  marketingCost: number;
  vendorCost: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  moic: number;
  arvDiscount: number;
}

export interface TeamMetrics {
  userId: string;
  userName: string;
  role: string;
  touchesPerDay: number;
  firstResponseTime: number;
  appointmentSetRate: number;
  offerRate: number;
  winRate: number;
  followUpSLA: number;
  totalActivities: number;
  totalDeals: number;
  totalRevenue: number;
}

export interface VendorMetrics {
  vendorId: string;
  vendorName: string;
  category: string;
  totalJobs: number;
  onTimePercentage: number;
  quoteVariance: number;
  avgRating: number;
  changeOrderRate: number;
  totalSpend: number;
  avgJobValue: number;
}

export interface CustomDashboard {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isShared: boolean;
  layout: DashboardLayout;
  filters?: DashboardFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  rowHeight: number;
}

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'funnel' | 'map' | 'heatmap';
  title: string;
  dataSource: string;
  config: any;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DashboardFilters {
  dateRange?: {
    from: Date;
    to: Date;
  };
  markets?: string[];
  channels?: string[];
  campaigns?: string[];
  dealTypes?: string[];
  users?: string[];
  vendors?: string[];
}

export interface Alert {
  id: string;
  name: string;
  type: 'SLA' | 'Performance' | 'Budget' | 'Profit' | 'Vendor';
  condition: AlertCondition;
  actions: AlertAction[];
  isActive: boolean;
  lastTriggered?: Date;
  frequency: 'Real-time' | 'Hourly' | 'Daily' | 'Weekly';
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: number;
  timeWindow?: string;
}

export interface AlertAction {
  type: 'Email' | 'Slack' | 'SMS' | 'In-App';
  recipients: string[];
  message?: string;
}

export interface ExportRequest {
  reportType: 'profit_pnl' | 'funnel' | 'marketing_by_campaign' | 'team_performance' | 'vendor_analysis' | 'custom';
  format: 'csv' | 'xlsx' | 'pdf';
  filters?: DashboardFilters;
  columns?: string[];
  groupBy?: string[];
}

export interface ComparisonPeriod {
  type: 'previous' | 'yoy' | 'custom';
  customFrom?: Date;
  customTo?: Date;
}

export interface TrendData {
  date: Date;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
}