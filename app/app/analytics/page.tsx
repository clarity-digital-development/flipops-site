"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Download,
  FileText,
  RefreshCw,
  Star,
  AlertTriangle,
  Trophy,
  Award,
  Medal,
  Crown,
  Percent,
  BarChart3,
  Activity,
  Building2,
  Zap,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type {
  KPIMetrics,
  FunnelStage,
  MarketingMetrics,
  TeamMetrics,
  VendorMetrics
} from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.abs(value));
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function formatMultiplier(value: number): string {
  return `${Math.abs(value).toFixed(1)}x`;
}

// ============================================================================
// CUSTOM TOOLTIP COMPONENT
// ============================================================================

function CustomTooltip({
  active,
  payload,
  label,
  formatter
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string | Date;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;

  // Format label if it's a Date object
  const formattedLabel = label instanceof Date
    ? label.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    : label;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2">
      {formattedLabel && <p className="text-xs font-medium text-foreground mb-1">{formattedLabel}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.name}:</span>
          <span className="text-xs font-semibold tabular-nums">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// STAT CHIP COMPONENT
// ============================================================================

function StatChip({
  icon: Icon,
  label,
  value,
  trend,
  format = "number",
  highlight = false
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  trend?: number;
  format?: "number" | "currency" | "percent" | "multiplier";
  highlight?: boolean;
}) {
  const formattedValue = format === "currency"
    ? formatCurrency(value)
    : format === "percent"
      ? formatPercent(value)
      : format === "multiplier"
        ? formatMultiplier(value)
        : formatNumber(value);

  const TrendIcon = trend && trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend && trend > 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border bg-card",
      highlight && "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800"
    )}>
      <div className={cn(
        "p-1.5 rounded-md",
        highlight ? "bg-amber-100 dark:bg-amber-900/50" : "bg-muted"
      )}>
        <Icon className={cn(
          "h-3.5 w-3.5",
          highlight ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            highlight && "text-amber-700 dark:text-amber-300"
          )}>{formattedValue}</span>
          {trend !== undefined && (
            <div className={cn("flex items-center gap-0.5 text-[10px] font-medium", trendColor)}>
              <TrendIcon className="h-2.5 w-2.5" />
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function StatChipSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
      <Skeleton className="h-7 w-7 rounded-md" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function ChartCardSkeleton({ height = 160 }: { height?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// DEFAULT DEMO DATA
// ============================================================================

const DEFAULT_KPIS: KPIMetrics = {
  leads: 1247,
  qualifiedLeads: 561,
  appointments: 280,
  offers: 168,
  contracts: 89,
  closedDeals: 76,
  netProfit: 1842000,
  grossProfit: 2156000,
  totalSpend: 52000,
  romi: 35.4,
  roas: 48.2,
  avgDaysToContract: 12,
  avgSpeedToLead: 8,
  conversionRate: 0.061
};

const DEFAULT_FUNNEL: FunnelStage[] = [
  { stage: 'Leads', count: 1247, percentage: 100, conversionToNext: 45 },
  { stage: 'Qualified', count: 561, percentage: 45, conversionToNext: 50 },
  { stage: 'Appointments', count: 280, percentage: 22.5, conversionToNext: 60 },
  { stage: 'Offers', count: 168, percentage: 13.5, conversionToNext: 53 },
  { stage: 'Contracts', count: 89, percentage: 7.1, conversionToNext: 85 },
  { stage: 'Closed', count: 76, percentage: 6.1 }
];

const DEFAULT_WATERFALL = [
  { stage: 'Revenue', value: 3250000, isProfit: true },
  { stage: 'Purchase', value: 780000 },
  { stage: 'Gross Profit', value: 2470000, isProfit: true },
  { stage: 'Rehab', value: 425000 },
  { stage: 'Holding', value: 87000 },
  { stage: 'Closing', value: 116000 },
  { stage: 'Net Profit', value: 1842000, isProfit: true }
];

const DEFAULT_TRENDS = [
  { date: new Date('2024-01-01'), value: 380000 },
  { date: new Date('2024-01-08'), value: 420000 },
  { date: new Date('2024-01-15'), value: 465000 },
  { date: new Date('2024-01-22'), value: 512000 },
  { date: new Date('2024-01-29'), value: 485000 }
];

const DEFAULT_MARKETING: MarketingMetrics[] = [
  { channel: 'PPC', spend: 28000, leads: 562, contracts: 45, closedDeals: 38, cpl: 49.82, cpa: 622, cpd: 737, roas: 52.3, romi: 41.2 },
  { channel: 'SEO', spend: 5000, leads: 245, contracts: 12, closedDeals: 10, cpl: 20.41, cpa: 417, cpd: 500, roas: 28.4, romi: 22.6 },
  { channel: 'Direct Mail', spend: 8000, leads: 186, contracts: 9, closedDeals: 8, cpl: 43.01, cpa: 889, cpd: 1000, roas: 18.5, romi: 14.2 },
  { channel: 'Cold Call', spend: 6000, leads: 142, contracts: 7, closedDeals: 6, cpl: 42.25, cpa: 857, cpd: 1000, roas: 15.8, romi: 11.3 },
  { channel: 'SMS', spend: 3000, leads: 87, contracts: 5, closedDeals: 4, cpl: 34.48, cpa: 600, cpd: 750, roas: 12.6, romi: 9.8 },
  { channel: 'Referral', spend: 2000, leads: 25, contracts: 11, closedDeals: 10, cpl: 80, cpa: 182, cpd: 200, roas: 85.2, romi: 72.5 }
];

const DEFAULT_TEAM: TeamMetrics[] = [
  { userId: '1', userName: 'Sarah Chen', role: 'Acquisition', touchesPerDay: 48, firstResponseTime: 5, appointmentSetRate: 0.42, offerRate: 0.65, winRate: 0.58, followUpSLA: 0.96, totalActivities: 1440, totalDeals: 28, totalRevenue: 1120000 },
  { userId: '2', userName: 'Mike Rodriguez', role: 'Acquisition', touchesPerDay: 42, firstResponseTime: 8, appointmentSetRate: 0.38, offerRate: 0.60, winRate: 0.52, followUpSLA: 0.92, totalActivities: 1260, totalDeals: 24, totalRevenue: 960000 },
  { userId: '3', userName: 'Emily Johnson', role: 'Disposition', touchesPerDay: 36, firstResponseTime: 12, appointmentSetRate: 0.35, offerRate: 0.55, winRate: 0.48, followUpSLA: 0.88, totalActivities: 1080, totalDeals: 20, totalRevenue: 800000 },
  { userId: '4', userName: 'David Park', role: 'Account Manager', touchesPerDay: 32, firstResponseTime: 15, appointmentSetRate: 0.32, offerRate: 0.50, winRate: 0.45, followUpSLA: 0.85, totalActivities: 960, totalDeals: 16, totalRevenue: 640000 },
  { userId: '5', userName: 'Jessica Martinez', role: 'Acquisition', touchesPerDay: 45, firstResponseTime: 6, appointmentSetRate: 0.40, offerRate: 0.62, winRate: 0.55, followUpSLA: 0.94, totalActivities: 1350, totalDeals: 26, totalRevenue: 1040000 },
  { userId: '6', userName: 'James Wilson', role: 'Disposition', touchesPerDay: 38, firstResponseTime: 10, appointmentSetRate: 0.36, offerRate: 0.58, winRate: 0.50, followUpSLA: 0.90, totalActivities: 1140, totalDeals: 22, totalRevenue: 880000 },
  { userId: '7', userName: 'Ashley Thompson', role: 'Acquisition', touchesPerDay: 40, firstResponseTime: 7, appointmentSetRate: 0.39, offerRate: 0.61, winRate: 0.53, followUpSLA: 0.93, totalActivities: 1200, totalDeals: 23, totalRevenue: 920000 },
  { userId: '8', userName: 'Robert Garcia', role: 'Account Manager', touchesPerDay: 30, firstResponseTime: 18, appointmentSetRate: 0.30, offerRate: 0.48, winRate: 0.42, followUpSLA: 0.82, totalActivities: 900, totalDeals: 14, totalRevenue: 560000 },
  { userId: '9', userName: 'Amanda Lee', role: 'Acquisition', touchesPerDay: 44, firstResponseTime: 9, appointmentSetRate: 0.37, offerRate: 0.59, winRate: 0.51, followUpSLA: 0.91, totalActivities: 1320, totalDeals: 21, totalRevenue: 840000 },
  { userId: '10', userName: 'Christopher Brown', role: 'Disposition', touchesPerDay: 34, firstResponseTime: 14, appointmentSetRate: 0.33, offerRate: 0.52, winRate: 0.46, followUpSLA: 0.86, totalActivities: 1020, totalDeals: 18, totalRevenue: 720000 },
  { userId: '11', userName: 'Jennifer Davis', role: 'Acquisition', touchesPerDay: 46, firstResponseTime: 4, appointmentSetRate: 0.41, offerRate: 0.63, winRate: 0.56, followUpSLA: 0.95, totalActivities: 1380, totalDeals: 25, totalRevenue: 1000000 },
  { userId: '12', userName: 'Daniel Kim', role: 'Account Manager', touchesPerDay: 28, firstResponseTime: 20, appointmentSetRate: 0.28, offerRate: 0.45, winRate: 0.40, followUpSLA: 0.78, totalActivities: 840, totalDeals: 12, totalRevenue: 480000 },
  { userId: '13', userName: 'Megan Taylor', role: 'Disposition', touchesPerDay: 35, firstResponseTime: 11, appointmentSetRate: 0.34, offerRate: 0.54, winRate: 0.47, followUpSLA: 0.87, totalActivities: 1050, totalDeals: 19, totalRevenue: 760000 },
  { userId: '14', userName: 'Ryan Anderson', role: 'Acquisition', touchesPerDay: 41, firstResponseTime: 8, appointmentSetRate: 0.38, offerRate: 0.60, winRate: 0.52, followUpSLA: 0.91, totalActivities: 1230, totalDeals: 22, totalRevenue: 880000 },
];

const DEFAULT_VENDORS: VendorMetrics[] = [
  { vendorId: '1', vendorName: 'Phoenix Premier Contractors', category: 'Contractor', totalJobs: 42, onTimePercentage: 95, quoteVariance: 3.2, avgRating: 4.8, changeOrderRate: 5, totalSpend: 425000, avgJobValue: 10119 },
  { vendorId: '2', vendorName: 'Lightning Electric Solutions', category: 'Electrician', totalJobs: 28, onTimePercentage: 92, quoteVariance: 2.8, avgRating: 4.6, changeOrderRate: 3, totalSpend: 84000, avgJobValue: 3000 },
  { vendorId: '3', vendorName: 'Desert Cool HVAC', category: 'HVAC', totalJobs: 24, onTimePercentage: 88, quoteVariance: 4.5, avgRating: 4.5, changeOrderRate: 8, totalSpend: 96000, avgJobValue: 4000 },
  { vendorId: '4', vendorName: 'Blue Wave Plumbing', category: 'Plumber', totalJobs: 18, onTimePercentage: 72, quoteVariance: 28.5, avgRating: 3.2, changeOrderRate: 35, totalSpend: 63000, avgJobValue: 3500 },
  { vendorId: '5', vendorName: 'Sunset Roofing Specialists', category: 'Roofing', totalJobs: 15, onTimePercentage: 91, quoteVariance: 5.1, avgRating: 4.7, changeOrderRate: 6, totalSpend: 120000, avgJobValue: 8000 },
  { vendorId: '6', vendorName: 'Valley Floor & Tile', category: 'Flooring', totalJobs: 22, onTimePercentage: 85, quoteVariance: 7.3, avgRating: 4.4, changeOrderRate: 10, totalSpend: 88000, avgJobValue: 4000 },
  { vendorId: '7', vendorName: 'Pro Paint Arizona', category: 'Painting', totalJobs: 31, onTimePercentage: 94, quoteVariance: 2.1, avgRating: 4.9, changeOrderRate: 2, totalSpend: 62000, avgJobValue: 2000 },
  { vendorId: '8', vendorName: 'GreenThumb Landscaping', category: 'Landscaping', totalJobs: 19, onTimePercentage: 78, quoteVariance: 15.8, avgRating: 3.8, changeOrderRate: 22, totalSpend: 38000, avgJobValue: 2000 }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("executive");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [dataPeriod, setDataPeriod] = useState(30);

  // State for API data with fallback to demo data
  const [kpis, setKpis] = useState<KPIMetrics>(DEFAULT_KPIS);
  const [funnel, setFunnel] = useState<FunnelStage[]>(DEFAULT_FUNNEL);
  const [waterfall, setWaterfall] = useState(DEFAULT_WATERFALL);
  const [trends, setTrends] = useState(DEFAULT_TRENDS);
  const [marketingMetrics, setMarketingMetrics] = useState<MarketingMetrics[]>(DEFAULT_MARKETING);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics[]>(DEFAULT_TEAM);
  const [vendorMetrics, setVendorMetrics] = useState<VendorMetrics[]>(DEFAULT_VENDORS);

  // Team tab state for search, sort, pagination
  const [teamSearch, setTeamSearch] = useState("");
  const [teamSortBy, setTeamSortBy] = useState<"userName" | "totalRevenue" | "totalDeals" | "winRate">("totalRevenue");
  const [teamSortDir, setTeamSortDir] = useState<"asc" | "desc">("desc");
  const [teamPage, setTeamPage] = useState(0);
  const [teamViewMode, setTeamViewMode] = useState<"table" | "cards">("table");
  const TEAM_PAGE_SIZE = 9;

  // Profitability data state
  const [profitByMarket, setProfitByMarket] = useState<Array<{ market: string; profit: number; deals: number }>>([]);
  const [topDeals, setTopDeals] = useState<Array<{ address: string; market: string; profit: number; margin: number }>>([]);
  const [marginDistribution, setMarginDistribution] = useState<Array<{ name: string; value: number }>>([]);
  const [avgDealByMarket, setAvgDealByMarket] = useState<Array<{ market: string; size: number }>>([]);
  const [hasProfitabilityData, setHasProfitabilityData] = useState(false);

  // Fetch analytics data from API
  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/analytics?period=${dataPeriod}&tab=all`);
      if (response.ok) {
        const data = await response.json();

        if (data.kpis) setKpis(data.kpis);
        if (data.funnel) setFunnel(data.funnel);
        if (data.waterfall) setWaterfall(data.waterfall);
        if (data.trends) {
          setTrends(data.trends.map((t: { date: string; value: number }) => ({
            ...t,
            date: new Date(t.date)
          })));
        }
        if (data.marketingMetrics) setMarketingMetrics(data.marketingMetrics);
        if (data.teamMetrics) setTeamMetrics(data.teamMetrics);
        if (data.vendorMetrics && data.vendorMetrics.length > 0) {
          setVendorMetrics(data.vendorMetrics);
        }

        // Profitability data
        if (data.profitByMarket) setProfitByMarket(data.profitByMarket);
        if (data.topDeals) setTopDeals(data.topDeals);
        if (data.marginDistribution) setMarginDistribution(data.marginDistribution);
        if (data.avgDealByMarket) setAvgDealByMarket(data.avgDealByMarket);
        setHasProfitabilityData(data.hasProfitabilityData || false);

        setHasRealData(data.hasRealData || false);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dataPeriod]);

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    if (format !== 'csv') {
      toast({
        title: "Coming Soon",
        description: `${format.toUpperCase()} export will be available soon.`
      });
      return;
    }

    let csvContent = "";
    let filename = "";

    switch (activeTab) {
      case "executive":
        filename = "executive-kpis";
        csvContent = "Metric,Value\n";
        csvContent += `Total Leads,${kpis.leads}\n`;
        csvContent += `Qualified Leads,${kpis.qualifiedLeads}\n`;
        csvContent += `Offers,${kpis.offers}\n`;
        csvContent += `Contracts,${kpis.contracts}\n`;
        csvContent += `Closed Deals,${kpis.closedDeals}\n`;
        csvContent += `Net Profit,$${kpis.netProfit}\n`;
        csvContent += `ROMI,${kpis.romi}x\n`;
        break;

      case "marketing":
        filename = "marketing-performance";
        csvContent = "Channel,Spend,Leads,Contracts,Closed Deals,CPL,CPA,ROAS,ROMI\n";
        marketingMetrics.forEach(m => {
          csvContent += `${m.channel},$${m.spend},${m.leads},${m.contracts},${m.closedDeals},$${m.cpl.toFixed(2)},$${m.cpa},${m.roas}x,${m.romi}x\n`;
        });
        break;

      case "team":
        filename = "team-performance";
        csvContent = "Name,Role,Touches/Day,Response Time (min),Win Rate,Deals,Revenue\n";
        teamMetrics.forEach(m => {
          csvContent += `${m.userName},${m.role},${m.touchesPerDay},${m.firstResponseTime},${(m.winRate * 100).toFixed(1)}%,${m.totalDeals},$${m.totalRevenue}\n`;
        });
        break;

      case "vendors":
        filename = "vendor-performance";
        csvContent = "Vendor,Category,Jobs,On-Time %,Quote Variance,Rating,Total Spend\n";
        vendorMetrics.forEach(v => {
          csvContent += `"${v.vendorName}",${v.category},${v.totalJobs},${v.onTimePercentage}%,${v.quoteVariance}%,${v.avgRating},$${v.totalSpend}\n`;
        });
        break;

      default:
        filename = "analytics-export";
        csvContent = "Tab,Note\n";
        csvContent += `${activeTab},Export not implemented for this tab\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${activeTab} dashboard as CSV.`
    });
  };

  const handleDateRangeChange = (range: string) => {
    let days = 30;
    switch (range) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
    }
    setDataPeriod(days);
  };

  const handleRefresh = () => {
    fetchAnalytics();
    toast({
      title: "Refreshing",
      description: "Fetching latest analytics data..."
    });
  };

  // Computed: filtered, sorted, paginated team data
  const filteredTeamMetrics = teamMetrics
    .filter(m =>
      m.userName.toLowerCase().includes(teamSearch.toLowerCase()) ||
      m.role.toLowerCase().includes(teamSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[teamSortBy];
      const bVal = b[teamSortBy];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return teamSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return teamSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const totalTeamPages = Math.ceil(filteredTeamMetrics.length / TEAM_PAGE_SIZE);
  const paginatedTeamMetrics = filteredTeamMetrics.slice(
    teamPage * TEAM_PAGE_SIZE,
    (teamPage + 1) * TEAM_PAGE_SIZE
  );

  const handleTeamSort = (column: typeof teamSortBy) => {
    if (teamSortBy === column) {
      setTeamSortDir(teamSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setTeamSortBy(column);
      setTeamSortDir('desc');
    }
    setTeamPage(0);
  };

  const SortIcon = ({ column }: { column: typeof teamSortBy }) => {
    if (teamSortBy !== column) return <ChevronUp className="h-3 w-3 text-muted-foreground/30" />;
    return teamSortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
              <p className="text-xs text-muted-foreground">
                {kpis.romi.toFixed(1)}x ROMI • {kpis.closedDeals} Deals Closed
              </p>
            </div>
            {!loading && (
              <Badge variant={hasRealData ? "default" : "secondary"} className="text-[10px]">
                {hasRealData ? "Live Data" : "Demo Data"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="30d" onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>Export as Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Horizontal Stats Bar */}
      <div className="shrink-0 border-b px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <StatChipSkeleton key={i} />)
          ) : (
            <>
              <StatChip icon={Users} label="Total Leads" value={kpis.leads} trend={32} />
              <StatChip icon={Target} label="Qualified" value={kpis.qualifiedLeads} trend={18} />
              <StatChip icon={FileText} label="Offers" value={kpis.offers} trend={24} />
              <StatChip icon={FileText} label="Contracts" value={kpis.contracts} trend={15} />
              <StatChip icon={Trophy} label="Closed" value={kpis.closedDeals} trend={22} />
              <StatChip icon={DollarSign} label="Net Profit" value={kpis.netProfit} format="currency" trend={24} highlight />
              <StatChip icon={Zap} label="ROMI" value={kpis.romi} format="multiplier" trend={15} />
              <StatChip icon={Activity} label="Conversion" value={kpis.conversionRate * 100} format="percent" trend={8} />
            </>
          )}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="shrink-0 px-4 pt-2">
            <TabsList className="grid grid-cols-6 w-full max-w-2xl">
              <TabsTrigger value="executive" className="text-xs">Executive</TabsTrigger>
              <TabsTrigger value="marketing" className="text-xs">Marketing</TabsTrigger>
              <TabsTrigger value="acquisition" className="text-xs">Acquisition</TabsTrigger>
              <TabsTrigger value="profitability" className="text-xs">Profitability</TabsTrigger>
              <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
              <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
            </TabsList>
          </div>

          {/* Executive Dashboard */}
          <TabsContent value="executive" className="flex-1 min-h-0 mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton />
                      <ChartCardSkeleton />
                    </div>
                    <ChartCardSkeleton height={180} />
                  </>
                ) : (
                  <>
                    {/* Charts Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Funnel */}
                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={funnel} barCategoryGap="20%">
                              <defs>
                                <linearGradient id="funnelGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.8} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={(v) => formatNumber(v)} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                              <Bar dataKey="count" fill="url(#funnelGradient)" radius={[6, 6, 0, 0]} className="drop-shadow-sm">
                                <LabelList dataKey="percentage" position="top" formatter={(v: number) => `${v}%`} fontSize={10} fill="#6b7280" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Trend */}
                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Weekly Profit Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={trends}>
                              <defs>
                                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.15} />
                                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }} />
                              <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} fill="url(#profitGradient)" dot={false} activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Waterfall */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-medium">Profit Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={waterfall} margin={{ bottom: 30 }} barCategoryGap="15%">
                            <defs>
                              <linearGradient id="profitBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                              </linearGradient>
                              <linearGradient id="costBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#93C5FD" stopOpacity={1} />
                                <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                            <XAxis dataKey="stage" angle={-30} textAnchor="end" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 3500000]} ticks={[0, 1000000, 2000000, 3000000]} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                            <Tooltip content={<CustomTooltip formatter={formatCurrency} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} className="drop-shadow-sm">
                              {waterfall.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.isProfit ? 'url(#profitBarGradient)' : 'url(#costBarGradient)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Marketing Dashboard */}
          <TabsContent value="marketing" className="flex-1 min-h-0 mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <Card><CardContent className="p-4"><TableSkeleton rows={6} /></CardContent></Card>
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton height={200} />
                      <ChartCardSkeleton height={200} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Channel Performance Table */}
                    <Card>
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-medium">Channel Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs">Channel</TableHead>
                              <TableHead className="text-xs text-right">Spend</TableHead>
                              <TableHead className="text-xs text-right">Leads</TableHead>
                              <TableHead className="text-xs text-right">CPL</TableHead>
                              <TableHead className="text-xs text-right">Contracts</TableHead>
                              <TableHead className="text-xs text-right">ROMI</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {marketingMetrics.map((m) => (
                              <TableRow key={m.channel}>
                                <TableCell className="text-xs font-medium py-2">{m.channel}</TableCell>
                                <TableCell className="text-xs text-right py-2 tabular-nums">{formatCurrency(m.spend)}</TableCell>
                                <TableCell className="text-xs text-right py-2 tabular-nums">{m.leads}</TableCell>
                                <TableCell className="text-xs text-right py-2 tabular-nums">{formatCurrency(m.cpl)}</TableCell>
                                <TableCell className="text-xs text-right py-2 tabular-nums">{m.contracts}</TableCell>
                                <TableCell className="text-xs text-right font-medium text-emerald-600 py-2 tabular-nums">{m.romi.toFixed(1)}x</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Charts */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Lead Source Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex h-48">
                            <div className="flex flex-col justify-center space-y-1 pr-3">
                              {marketingMetrics.map((m, i) => {
                                const totalLeads = marketingMetrics.reduce((acc, curr) => acc + curr.leads, 0);
                                return (
                                  <div key={m.channel} className="flex items-center gap-1.5 group cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors">
                                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform group-hover:scale-125" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-[10px] whitespace-nowrap font-medium">{m.channel}:</span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">{m.leads}</span>
                                    <div className="flex-1 h-1 bg-muted rounded ml-1 overflow-hidden min-w-[36px]">
                                      <div
                                        className="h-full transition-all duration-300 group-hover:opacity-100 opacity-60"
                                        style={{ width: `${(m.leads / totalLeads) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex-1">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={marketingMetrics}
                                    dataKey="leads"
                                    nameKey="channel"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="40%"
                                    outerRadius="75%"
                                    paddingAngle={2}
                                    strokeWidth={0}
                                  >
                                    {marketingMetrics.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-sm" />
                                    ))}
                                  </Pie>
                                  <Tooltip content={<CustomTooltip formatter={formatNumber} />} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Weekly Campaign Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={192}>
                            <AreaChart data={[
                              { week: 'W1', ppc: 145, seo: 62, email: 43 },
                              { week: 'W2', ppc: 162, seo: 68, email: 51 },
                              { week: 'W3', ppc: 138, seo: 71, email: 47 },
                              { week: 'W4', ppc: 177, seo: 75, email: 58 }
                            ]}>
                              <defs>
                                <linearGradient id="ppcGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="seoGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="emailGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.6} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={formatNumber} />} />
                              <Area type="monotone" dataKey="email" stackId="1" stroke="#F59E0B" strokeWidth={0} fill="url(#emailGradient)" />
                              <Area type="monotone" dataKey="seo" stackId="1" stroke="#10B981" strokeWidth={0} fill="url(#seoGradient)" />
                              <Area type="monotone" dataKey="ppc" stackId="1" stroke="#3B82F6" strokeWidth={0} fill="url(#ppcGradient)" />
                            </AreaChart>
                          </ResponsiveContainer>
                          <div className="flex items-center justify-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                              <span className="text-[10px] text-muted-foreground">PPC</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                              <span className="text-[10px] text-muted-foreground">SEO</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                              <span className="text-[10px] text-muted-foreground">Email</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Acquisition Dashboard */}
          <TabsContent value="acquisition" className="flex-1 min-h-0 mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <ChartCardSkeleton key={i} height={80} />)}
                    </div>
                    <ChartCardSkeleton height={140} />
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton height={140} />
                      <ChartCardSkeleton height={140} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Acquisition Metrics */}
                    <div className="grid grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold tabular-nums">8 min</div>
                          <p className="text-xs text-muted-foreground">Avg Speed to Lead</p>
                          <Progress value={85} className="mt-2 h-1" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold tabular-nums">12 days</div>
                          <p className="text-xs text-muted-foreground">Avg Days to Contract</p>
                          <Progress value={75} className="mt-2 h-1" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold tabular-nums">6.1%</div>
                          <p className="text-xs text-muted-foreground">Conversion Rate</p>
                          <Progress value={61} className="mt-2 h-1" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold tabular-nums">45%</div>
                          <p className="text-xs text-muted-foreground">Qualification Rate</p>
                          <Progress value={45} className="mt-2 h-1" />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Lead Source Quality */}
                    <Card>
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-medium">Lead Quality by Source</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {marketingMetrics.map((m) => {
                            const qualRate = (m.contracts / m.leads * 100).toFixed(1);
                            return (
                              <div key={m.channel} className="flex items-center justify-between">
                                <span className="text-xs font-medium">{m.channel}</span>
                                <div className="flex items-center gap-3">
                                  <Progress value={parseFloat(qualRate)} className="w-32 h-1.5" />
                                  <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{qualRate}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Speed Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Response Time Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {[
                              { label: '< 5 min', value: 42 },
                              { label: '5-15 min', value: 31 },
                              { label: '15-60 min', value: 18 },
                              { label: '> 60 min', value: 9 }
                            ].map((item) => (
                              <div key={item.label}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{item.label}</span>
                                  <span className="font-medium tabular-nums">{item.value}%</span>
                                </div>
                                <Progress value={item.value} className="h-1.5" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Daily Lead Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={140}>
                            <AreaChart data={[
                              { hour: '6am', leads: 12 },
                              { hour: '9am', leads: 45 },
                              { hour: '12pm', leads: 78 },
                              { hour: '3pm', leads: 92 },
                              { hour: '6pm', leads: 54 },
                              { hour: '9pm', leads: 23 }
                            ]}>
                              <defs>
                                <linearGradient id="leadActivityGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                                  <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.15} />
                                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={formatNumber} />} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                              <Area type="monotone" dataKey="leads" stroke="#3B82F6" strokeWidth={2.5} fill="url(#leadActivityGradient)" dot={false} activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Profitability Dashboard */}
          <TabsContent value="profitability" className="flex-1 min-h-0 mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton height={140} />
                      <ChartCardSkeleton height={140} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton height={180} />
                      <ChartCardSkeleton height={180} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Deal Analysis */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Profit by Market
                            {hasProfitabilityData && <Badge variant="default" className="text-[9px]">Live</Badge>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={profitByMarket.length > 0 ? profitByMarket : [
                              { market: 'Phoenix', profit: 680000, deals: 28 },
                              { market: 'Tucson', profit: 520000, deals: 22 },
                              { market: 'Scottsdale', profit: 420000, deals: 18 },
                              { market: 'Mesa', profit: 222000, deals: 8 }
                            ]} barCategoryGap="25%">
                              <defs>
                                <linearGradient id="marketProfitGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                              <XAxis dataKey="market" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                              <Bar dataKey="profit" fill="url(#marketProfitGradient)" radius={[6, 6, 0, 0]} className="drop-shadow-sm" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Top Performing Deals
                            {hasProfitabilityData && <Badge variant="default" className="text-[9px]">Live</Badge>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {(topDeals.length > 0 ? topDeals : [
                              { address: '123 Main St', market: 'Phoenix', profit: 140000, margin: 77.8 },
                              { address: '456 Oak Ave', market: 'Scottsdale', profit: 165000, margin: 75.0 },
                              { address: '789 Elm Dr', market: 'Tucson', profit: 105000, margin: 70.0 },
                              { address: '321 Pine Rd', market: 'Mesa', profit: 110000, margin: 66.7 }
                            ]).map((deal) => (
                              <div key={deal.address} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
                                <div>
                                  <p className="text-xs font-medium">{deal.address}</p>
                                  <p className="text-[10px] text-muted-foreground">{deal.market}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-medium text-emerald-600 tabular-nums">{formatCurrency(deal.profit)}</p>
                                  <p className="text-[10px] text-muted-foreground tabular-nums">{deal.margin.toFixed(1)}% margin</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Margin Distribution and Deal Size */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Margin Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const chartData = marginDistribution.length > 0 ? marginDistribution : [
                              { name: '60%+', value: 32 },
                              { name: '50-60%', value: 28 },
                              { name: '40-50%', value: 12 },
                              { name: '30-40%', value: 4 }
                            ];
                            const legendData = chartData.map((item, i) => ({
                              label: item.name,
                              value: item.value,
                              color: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'][i] || '#6b7280'
                            }));
                            return (
                              <div className="flex items-center gap-4">
                                <div className="w-1/2">
                                  <ResponsiveContainer width="100%" height={160}>
                                    <PieChart>
                                      <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={60}
                                        paddingAngle={3}
                                        strokeWidth={0}
                                      >
                                        {chartData.map((_, index) => (
                                          <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444'][index] || '#6b7280'} className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-sm" />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomTooltip formatter={(v) => `${v} deals`} />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex-1 flex flex-col justify-center space-y-2">
                                  {legendData.map((item) => (
                                    <div key={item.label} className="flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded p-1.5 -m-1.5 transition-colors">
                                      <div className="w-3 h-3 rounded-sm transition-transform group-hover:scale-125" style={{ backgroundColor: item.color }} />
                                      <span className="text-xs font-medium">{item.label}</span>
                                      <span className="text-xs text-muted-foreground tabular-nums">({item.value})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Average Deal Size by Market</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const chartData = avgDealByMarket.length > 0 ? avgDealByMarket : [
                              { market: 'Scottsdale', size: 55000 },
                              { market: 'Phoenix', size: 42000 },
                              { market: 'Tucson', size: 38000 },
                              { market: 'Mesa', size: 35000 }
                            ];
                            return (
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={chartData} barCategoryGap="25%">
                                  <defs>
                                    <linearGradient id="dealSize1" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="dealSize2" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="dealSize3" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="dealSize4" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={1} />
                                      <stop offset="100%" stopColor="#D97706" stopOpacity={0.8} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                                  <XAxis dataKey="market" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                                  <Tooltip content={<CustomTooltip formatter={formatCurrency} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                                  <Bar dataKey="size" radius={[6, 6, 0, 0]} className="drop-shadow-sm">
                                    {chartData.map((_, index) => (
                                      <Cell key={`cell-${index}`} fill={`url(#dealSize${(index % 4) + 1})`} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Team Dashboard */}
          <TabsContent value="team" className="flex-1 min-h-0 mt-0 p-0">
            <div className="h-full flex flex-col p-3 gap-2">
              {loading ? (
                <>
                  <div className="grid grid-cols-4 gap-2 shrink-0">
                    {Array.from({ length: 4 }).map((_, i) => <ChartCardSkeleton key={i} height={52} />)}
                  </div>
                  <ChartCardSkeleton height={400} />
                </>
              ) : (
                <>
                  {/* Team Summary Stats - Compact horizontal bar */}
                  <div className="grid grid-cols-4 gap-2 shrink-0">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50">
                      <CardContent className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Revenue</p>
                            <p className="text-base font-bold tabular-nums truncate">{formatCurrency(teamMetrics.reduce((sum, m) => sum + m.totalRevenue, 0))}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50">
                      <CardContent className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">Team</p>
                            <p className="text-base font-bold tabular-nums">{teamMetrics.length} members</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50">
                      <CardContent className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Win Rate</p>
                            <p className="text-base font-bold tabular-nums">{teamMetrics.length > 0 ? (teamMetrics.reduce((sum, m) => sum + m.winRate, 0) / teamMetrics.length * 100).toFixed(0) : 0}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200/50 dark:border-purple-800/50">
                      <CardContent className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wide">Response</p>
                            <p className="text-base font-bold tabular-nums">{teamMetrics.length > 0 ? Math.round(teamMetrics.reduce((sum, m) => sum + m.firstResponseTime, 0) / teamMetrics.length) : 0}m avg</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Team Table with Search/Filter/Pagination */}
                  <Card>
                    <CardHeader className="pb-2 pt-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Team Performance
                            <Badge variant="secondary" className="text-[10px] ml-1">
                              {filteredTeamMetrics.length} {filteredTeamMetrics.length === 1 ? 'member' : 'members'}
                            </Badge>
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search team..."
                                value={teamSearch}
                                onChange={(e) => { setTeamSearch(e.target.value); setTeamPage(0); }}
                                className="h-8 w-48 pl-8 text-xs"
                              />
                            </div>
                            <div className="flex items-center border rounded-md">
                              <Button
                                variant={teamViewMode === 'table' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 px-2 rounded-r-none"
                                onClick={() => setTeamViewMode('table')}
                              >
                                <LayoutList className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant={teamViewMode === 'cards' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 px-2 rounded-l-none border-l"
                                onClick={() => setTeamViewMode('cards')}
                              >
                                <LayoutGrid className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              Invite
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {teamViewMode === 'table' ? (
                          <div>
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-xs w-[180px]">
                                    <button
                                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                                      onClick={() => handleTeamSort('userName')}
                                    >
                                      Team Member
                                      <SortIcon column="userName" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="text-xs">Role</TableHead>
                                  <TableHead className="text-xs text-right">
                                    <button
                                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                                      onClick={() => handleTeamSort('totalRevenue')}
                                    >
                                      Revenue
                                      <SortIcon column="totalRevenue" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="text-xs text-right">
                                    <button
                                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                                      onClick={() => handleTeamSort('totalDeals')}
                                    >
                                      Deals
                                      <SortIcon column="totalDeals" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="text-xs text-right">
                                    <button
                                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                                      onClick={() => handleTeamSort('winRate')}
                                    >
                                      Win Rate
                                      <SortIcon column="winRate" />
                                    </button>
                                  </TableHead>
                                  <TableHead className="text-xs text-right">Response</TableHead>
                                  <TableHead className="text-xs text-right">SLA</TableHead>
                                  <TableHead className="text-xs text-right">Activities</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paginatedTeamMetrics.map((member, i) => {
                                  const globalIndex = filteredTeamMetrics.findIndex(m => m.userId === member.userId);
                                  const isTopThree = globalIndex < 3 && teamSortBy === 'totalRevenue' && teamSortDir === 'desc';
                                  const rankColors = ['text-amber-500', 'text-gray-400', 'text-orange-500'];
                                  const avatarColors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                                  return (
                                    <TableRow key={member.userId} className="hover:bg-muted/50">
                                      <TableCell className="py-2">
                                        <div className="flex items-center gap-2">
                                          {isTopThree && (
                                            <div className={cn("flex items-center justify-center w-5", rankColors[globalIndex])}>
                                              {globalIndex === 0 ? <Crown className="h-4 w-4 fill-current" /> :
                                               globalIndex === 1 ? <Medal className="h-4 w-4" /> :
                                               <Award className="h-4 w-4" />}
                                            </div>
                                          )}
                                          <div className={cn(
                                            "h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                                            avatarColors[i % avatarColors.length]
                                          )}>
                                            {member.userName.split(' ').map(n => n[0]).join('')}
                                          </div>
                                          <span className="text-xs font-medium">{member.userName}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground py-2">{member.role}</TableCell>
                                      <TableCell className="text-xs text-right font-medium py-2 tabular-nums">
                                        {formatCurrency(member.totalRevenue)}
                                      </TableCell>
                                      <TableCell className="text-xs text-right py-2 tabular-nums">{member.totalDeals}</TableCell>
                                      <TableCell className="text-xs text-right py-2">
                                        <span className={cn(
                                          "tabular-nums font-medium",
                                          member.winRate >= 0.5 ? "text-emerald-600" : member.winRate >= 0.3 ? "text-amber-600" : "text-red-600"
                                        )}>
                                          {(member.winRate * 100).toFixed(0)}%
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-right py-2 tabular-nums">{member.firstResponseTime}m</TableCell>
                                      <TableCell className="text-xs text-right py-2">
                                        <span className={cn(
                                          "tabular-nums",
                                          member.followUpSLA >= 0.9 ? "text-emerald-600" : member.followUpSLA >= 0.7 ? "text-amber-600" : "text-red-600"
                                        )}>
                                          {(member.followUpSLA * 100).toFixed(0)}%
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs text-right text-muted-foreground py-2 tabular-nums">
                                        {member.totalActivities.toLocaleString()}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {paginatedTeamMetrics.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                      {teamSearch ? 'No team members match your search.' : 'No team members yet.'}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                            {/* Pagination */}
                            {totalTeamPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-1 border-t">
                                <p className="text-xs text-muted-foreground">
                                  Showing {teamPage * TEAM_PAGE_SIZE + 1}-{Math.min((teamPage + 1) * TEAM_PAGE_SIZE, filteredTeamMetrics.length)} of {filteredTeamMetrics.length}
                                </p>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={teamPage === 0}
                                    onClick={() => setTeamPage(p => p - 1)}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  {Array.from({ length: Math.min(totalTeamPages, 5) }).map((_, i) => {
                                    let pageNum = i;
                                    if (totalTeamPages > 5) {
                                      if (teamPage < 3) pageNum = i;
                                      else if (teamPage > totalTeamPages - 4) pageNum = totalTeamPages - 5 + i;
                                      else pageNum = teamPage - 2 + i;
                                    }
                                    return (
                                      <Button
                                        key={pageNum}
                                        variant={teamPage === pageNum ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 w-7 p-0 text-xs"
                                        onClick={() => setTeamPage(pageNum)}
                                      >
                                        {pageNum + 1}
                                      </Button>
                                    );
                                  })}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={teamPage >= totalTeamPages - 1}
                                    onClick={() => setTeamPage(p => p + 1)}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Card View Mode */
                          <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {paginatedTeamMetrics.map((member, i) => {
                                const colors = [
                                  { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-950/30' },
                                  { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-950/30' },
                                  { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-50 dark:bg-purple-950/30' },
                                  { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 dark:bg-amber-950/30' },
                                  { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50 dark:bg-rose-950/30' },
                                  { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-950/30' },
                                ];
                                const color = colors[i % colors.length];
                                return (
                                  <Card key={member.userId} className="overflow-hidden">
                                    <div className={`h-1.5 bg-gradient-to-r ${color.bg}`} />
                                    <CardContent className="p-3">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${color.bg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                                          {member.userName.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold truncate">{member.userName}</p>
                                          <p className="text-[10px] text-muted-foreground">{member.role}</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className={`${color.light} rounded-md p-2 text-center`}>
                                          <p className="text-sm font-bold tabular-nums">{member.totalDeals}</p>
                                          <p className="text-[9px] text-muted-foreground">Deals</p>
                                        </div>
                                        <div className={`${color.light} rounded-md p-2 text-center`}>
                                          <p className="text-sm font-bold tabular-nums">{(member.winRate * 100).toFixed(0)}%</p>
                                          <p className="text-[9px] text-muted-foreground">Win Rate</p>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between text-[10px]">
                                        <span className="text-muted-foreground">SLA: {(member.followUpSLA * 100).toFixed(0)}%</span>
                                        <span className="text-muted-foreground">{member.firstResponseTime}m resp</span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                            {/* Card View Pagination */}
                            {totalTeamPages > 1 && (
                              <div className="flex items-center justify-center gap-2 mt-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={teamPage === 0}
                                  onClick={() => setTeamPage(p => p - 1)}
                                >
                                  <ChevronLeft className="h-4 w-4 mr-1" />
                                  Previous
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  Page {teamPage + 1} of {totalTeamPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={teamPage >= totalTeamPages - 1}
                                  onClick={() => setTeamPage(p => p + 1)}
                                >
                                  Next
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Vendors Dashboard */}
          <TabsContent value="vendors" className="mt-0 p-0">
              <div className="p-4 space-y-4">
                {loading ? (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => <ChartCardSkeleton key={i} height={70} />)}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <ChartCardSkeleton height={280} />
                      <ChartCardSkeleton height={280} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Vendor Summary Stats */}
                    <div className="grid grid-cols-4 gap-3">
                      <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20 border-violet-200/50 dark:border-violet-800/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide">Total Vendors</p>
                              <p className="text-xl font-bold tabular-nums">{vendorMetrics.length}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Total Spend</p>
                              <p className="text-xl font-bold tabular-nums">{formatCurrency(vendorMetrics.reduce((sum, v) => sum + v.totalSpend, 0))}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Avg Rating</p>
                              <div className="flex items-center gap-1">
                                <p className="text-xl font-bold tabular-nums">{(vendorMetrics.reduce((sum, v) => sum + v.avgRating, 0) / vendorMetrics.length).toFixed(1)}</p>
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">Avg On-Time</p>
                              <p className="text-xl font-bold tabular-nums">{(vendorMetrics.reduce((sum, v) => sum + v.onTimePercentage, 0) / vendorMetrics.length).toFixed(0)}%</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Vendor Performance Cards and Spend Chart */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">Vendor Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-[378px] overflow-y-auto pr-2">
                          {vendorMetrics.map((vendor) => {
                            const isAlert = vendor.onTimePercentage < 80;
                            return (
                              <div
                                key={vendor.vendorId}
                                className={cn(
                                  "p-3 rounded-lg border transition-colors cursor-pointer",
                                  isAlert
                                    ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "h-8 w-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold",
                                      vendor.category === 'Contractor' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                                      vendor.category === 'Electrician' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                                      vendor.category === 'Plumber' ? 'bg-gradient-to-br from-cyan-500 to-cyan-600' :
                                      vendor.category === 'HVAC' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                                      vendor.category === 'Roofer' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                                      'bg-gradient-to-br from-violet-500 to-violet-600'
                                    )}>
                                      {vendor.vendorName.split(' ').slice(0, 2).map(n => n[0]).join('')}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate">{vendor.vendorName}</p>
                                      <p className="text-[10px] text-muted-foreground">{vendor.category}</p>
                                    </div>
                                  </div>
                                  {isAlert && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                  <div>
                                    <p className={cn(
                                      "text-sm font-bold tabular-nums",
                                      vendor.onTimePercentage >= 90 ? "text-emerald-600" :
                                      vendor.onTimePercentage >= 80 ? "text-amber-600" :
                                      "text-red-600"
                                    )}>
                                      {vendor.onTimePercentage}%
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">On-Time</p>
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-center gap-0.5">
                                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                      <span className="text-sm font-bold tabular-nums">{vendor.avgRating.toFixed(2)}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground">Rating</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold tabular-nums">{vendor.totalJobs}</p>
                                    <p className="text-[9px] text-muted-foreground">Jobs</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold tabular-nums text-muted-foreground">+{vendor.quoteVariance.toFixed(0)}%</p>
                                    <p className="text-[9px] text-muted-foreground">Variance</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <Card className="overflow-hidden">
                          <CardHeader className="pb-2 pt-3">
                            <CardTitle className="text-sm font-medium">Spend by Category</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={140}>
                              <BarChart data={[
                                { cat: 'Contractor', spend: 425000 },
                                { cat: 'Roofing', spend: 120000 },
                                { cat: 'HVAC', spend: 96000 },
                                { cat: 'Flooring', spend: 88000 },
                                { cat: 'Electrician', spend: 84000 }
                              ]} layout="vertical" barCategoryGap="25%">
                                <defs>
                                  <linearGradient id="vendorSpendGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.8} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                                <YAxis type="category" dataKey="cat" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} width={70} />
                                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                                <Bar dataKey="spend" fill="url(#vendorSpendGradient)" radius={[0, 6, 6, 0]} className="drop-shadow-sm" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                          <CardHeader className="pb-2 pt-3">
                            <CardTitle className="text-sm font-medium">On-Time Performance Trend</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={120}>
                              <AreaChart data={[
                                { week: 'W1', onTime: 82 },
                                { week: 'W2', onTime: 85 },
                                { week: 'W3', onTime: 88 },
                                { week: 'W4', onTime: 86 },
                                { week: 'W5', onTime: 91 }
                              ]}>
                                <defs>
                                  <linearGradient id="onTimeGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-zinc-700" />
                                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                                <YAxis domain={[70, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${v}%`} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                                <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
                                <Area type="monotone" dataKey="onTime" stroke="#10B981" strokeWidth={2} fill="url(#onTimeGradient)" dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </>
                )}
              </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
