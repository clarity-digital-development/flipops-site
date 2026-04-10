"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Hammer,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Pause,
  AlertTriangle,
  FileText,
  Search,
  LayoutGrid,
  List,
  Columns3,
  MoreVertical,
  Eye,
  Edit,
  Play,
  XCircle,
  Calendar,
  Users,
  ArrowRight,
  Download,
  ChevronRight,
  Wrench,
  Home,
  Ruler,
  Receipt,
  Plus,
  Minus,
  Target,
  Sparkles,
  AlertCircle,
  MapPin,
  ClipboardList,
  Building2,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
  seedRenovations,
  calculateRenovationStats,
  TRADE_CONFIG,
  type SeedRenovation,
  type SeedBid,
  type SeedChangeOrder,
  type SeedScopeNode,
} from "./seed-data";

// ============================================================================
// TYPES
// ============================================================================

type Renovation = SeedRenovation;

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG = {
  planning: {
    label: "Planning",
    icon: FileText,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-muted",
    borderColor: "border-gray-200 dark:border-border",
    gradientFrom: "from-gray-400",
    gradientTo: "to-gray-500",
  },
  active: {
    label: "Active",
    icon: Hammer,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    gradientFrom: "from-blue-400",
    gradientTo: "to-blue-500",
  },
  on_hold: {
    label: "On Hold",
    icon: Pause,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    gradientFrom: "from-amber-400",
    gradientTo: "to-amber-500",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    gradientFrom: "from-emerald-400",
    gradientTo: "to-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    borderColor: "border-rose-200 dark:border-rose-800",
    gradientFrom: "from-rose-400",
    gradientTo: "to-rose-500",
  },
};

const PIPELINE_STAGES = ["planning", "active", "on_hold", "completed"] as const;

// ============================================================================
// STAT CHIP COMPONENT
// ============================================================================

function StatChip({
  label,
  value,
  subValue,
  icon,
  trend,
  color = "blue",
  warning = false,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
  warning?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5",
    gray: "border-gray-200/50 dark:border-border/50 bg-gray-500/5",
    orange: "border-orange-200/50 dark:border-orange-800/50 bg-orange-500/5",
  };

  const iconColorMap: Record<string, string> = {
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    gray: "text-gray-500",
    orange: "text-orange-500",
  };

  return (
    <div className={cn(
      "flex-shrink-0 flex items-center gap-1.5 sm:gap-3 rounded-lg sm:rounded-xl border px-2 sm:px-4 py-1.5 sm:py-2.5 min-w-fit",
      colorMap[color],
      warning && "ring-2 ring-amber-400/50 animate-pulse"
    )}>
      <div className={cn("p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/80 dark:bg-black/30 hidden sm:block", iconColorMap[color])}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[8px] sm:text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </span>
        <div className="flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xs sm:text-lg font-bold tracking-tight tabular-nums leading-tight">{value}</span>
          {subValue && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">{subValue}</span>
          )}
          {trend && (
            <span className={cn(
              "hidden sm:flex items-center gap-0.5 text-[10px] font-medium",
              trend.positive ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              {trend.value}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STATUS PIPELINE COMPONENT
// ============================================================================

function StatusPipeline({
  renovations,
  activeStatus,
  onStatusClick,
}: {
  renovations: Renovation[];
  activeStatus: string;
  onStatusClick: (status: string) => void;
}) {
  const counts = {
    planning: renovations.filter(r => r.status === "planning").length,
    active: renovations.filter(r => r.status === "active").length,
    on_hold: renovations.filter(r => r.status === "on_hold").length,
    completed: renovations.filter(r => r.status === "completed").length,
  };

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-muted/50 rounded-lg p-3 border border-gray-200 dark:border-border">
      {PIPELINE_STAGES.map((stage, index) => {
        const config = STATUS_CONFIG[stage];
        const Icon = config.icon;
        const isActive = activeStatus === stage;
        const count = counts[stage];

        return (
          <div key={stage} className="flex items-center flex-1">
            <button
              onClick={() => onStatusClick(isActive ? "all" : stage)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center",
                isActive
                  ? cn(config.bgColor, config.borderColor, "border")
                  : "hover:bg-gray-100 dark:hover:bg-muted"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? config.color : "text-gray-400")} />
              <div className="text-center">
                <p className={cn(
                  "text-xl font-bold tabular-nums",
                  isActive ? config.color : "text-gray-700 dark:text-gray-300"
                )}>
                  {count}
                </p>
                <p className={cn(
                  "text-[10px] uppercase tracking-wider",
                  isActive ? config.color : "text-gray-500 dark:text-gray-400"
                )}>
                  {config.label}
                </p>
              </div>
            </button>
            {index < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-1 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// BUDGET GAUGE COMPONENT
// ============================================================================

function BudgetGauge({
  baseline,
  spent,
  committed,
  size = "md",
}: {
  baseline: number;
  spent: number;
  committed: number;
  size?: "sm" | "md" | "lg";
}) {
  const spentPercent = Math.min((spent / baseline) * 100, 100);
  const committedPercent = Math.min((committed / baseline) * 100, 100);
  const remaining = baseline - spent;
  const isOverBudget = spent > baseline;
  const isNearBudget = spentPercent >= 80;

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="space-y-1">
      <div className={cn("w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative", sizeClasses[size])}>
        {/* Committed (lighter) */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-200 dark:bg-blue-800 rounded-full transition-all duration-500"
          style={{ width: `${committedPercent}%` }}
        />
        {/* Spent (darker) */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            isOverBudget ? "bg-rose-500" : isNearBudget ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${spentPercent}%` }}
        />
      </div>
      {size !== "sm" && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className={cn(isOverBudget ? "text-rose-500 font-medium" : "")}>
            ${(spent / 1000).toFixed(0)}K spent
          </span>
          <span>${(remaining / 1000).toFixed(0)}K left</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRADE CHIPS COMPONENT
// ============================================================================

function TradeChips({ trades, limit = 4 }: { trades: string[]; limit?: number }) {
  const uniqueTrades = [...new Set(trades)];
  const displayTrades = uniqueTrades.slice(0, limit);
  const remaining = uniqueTrades.length - limit;

  return (
    <div className="flex flex-wrap gap-1">
      {displayTrades.map(trade => {
        const config = TRADE_CONFIG[trade] || { label: trade, color: "text-gray-600", bgColor: "bg-gray-100" };
        return (
          <span
            key={trade}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium rounded",
              config.bgColor,
              config.color
            )}
          >
            {config.label}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-muted text-gray-500">
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
      config.bgColor,
      config.color
    )}>
      <div className="relative flex items-center justify-center">
        <Icon className="h-3.5 w-3.5" />
        {pulse && status === "active" && (
          <span className={cn("absolute h-full w-full rounded-full animate-ping opacity-30", config.bgColor)} />
        )}
      </div>
      {config.label}
    </div>
  );
}

// ============================================================================
// RENOVATION CARD COMPONENT
// ============================================================================

function RenovationCard({
  renovation,
  onSelect,
  onAction,
  compact = false,
}: {
  renovation: Renovation;
  onSelect: () => void;
  onAction: (action: string) => void;
  compact?: boolean;
}) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const config = STATUS_CONFIG[renovation.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
  const trades = renovation.scopeNodes.map(s => s.trade);
  const pendingBids = renovation.bids.filter(b => b.status === "pending").length;
  const pendingCOs = renovation.changeOrders.filter(co => co.status === "proposed").length;
  const daysActive = renovation.startAt
    ? differenceInDays(new Date(), new Date(renovation.startAt))
    : 0;

  const baseline = renovation.budgetLedger?.baseline || renovation.maxExposureUsd;
  const spent = renovation.budgetLedger?.actuals || 0;
  const committed = renovation.budgetLedger?.committed || 0;

  // Compact list view
  if (compact) {
    return (
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200",
          "hover:bg-gray-50 dark:hover:bg-muted/50",
          "border-l-4",
          renovation.status === "active" && "border-l-blue-500",
          renovation.status === "planning" && "border-l-gray-400",
          renovation.status === "on_hold" && "border-l-amber-500",
          renovation.status === "completed" && "border-l-emerald-500",
          renovation.status === "cancelled" && "border-l-rose-500"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                {renovation.address}
              </h3>
              {pendingCOs > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] flex-shrink-0">
                  {pendingCOs} CO pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{renovation.city}, {renovation.state}</span>
              <span>·</span>
              <span>{renovation._count.scopeNodes} scope items</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div className="w-24 flex justify-center">
              <BudgetGauge baseline={baseline} spent={spent} committed={committed} size="sm" />
            </div>
            <div className="text-right hidden sm:block w-16">
              <div className="font-bold tabular-nums text-lg">{formatCurrency(baseline)}</div>
              <div className="text-muted-foreground text-[10px]">budget</div>
            </div>
            <div className="text-center hidden sm:block w-14">
              <div className={cn("font-bold tabular-nums", renovation.targetRoiPct >= 25 ? "text-emerald-600" : "text-blue-600")}>
                {renovation.targetRoiPct}%
              </div>
              <div className="text-muted-foreground text-[10px]">target ROI</div>
            </div>
            <div className="w-24 flex justify-end">
              <StatusBadge status={renovation.status} pulse={renovation.status === "active"} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full card view
  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-300",
        "hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20",
        "hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-800",
        "bg-gradient-to-br from-white to-gray-50/50 dark:from-card dark:to-card/50"
      )}
      onClick={onSelect}
    >
      {/* Status bar at top */}
      <div className={cn(
        "h-1.5 w-full bg-gradient-to-r",
        config.gradientFrom,
        config.gradientTo
      )} />

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                {renovation.address}
              </h3>
              {renovation.grade && renovation.grade !== "Standard" && (
                <Badge variant="outline" className={cn(
                  "text-[10px] px-1.5",
                  renovation.grade === "Premium" && "border-purple-300 text-purple-600",
                  renovation.grade === "Luxury" && "border-amber-300 text-amber-600"
                )}>
                  {renovation.grade}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {renovation.city}, {renovation.state}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onAction("view")}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("edit")}>
                <Edit className="h-4 w-4 mr-2" />
                Update Status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {renovation.status === "planning" && (
                <DropdownMenuItem onClick={() => onAction("start")}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Project
                </DropdownMenuItem>
              )}
              {renovation.status === "active" && (
                <DropdownMenuItem onClick={() => onAction("pause")}>
                  <Pause className="h-4 w-4 mr-2" />
                  Put On Hold
                </DropdownMenuItem>
              )}
              {renovation.status === "on_hold" && (
                <DropdownMenuItem onClick={() => onAction("resume")}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Project
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {renovation.propertyId && (
                <DropdownMenuItem asChild>
                  <Link href={`/app/properties/${renovation.propertyId}`} onClick={(e) => e.stopPropagation()}>
                    <Home className="h-4 w-4 mr-2" />
                    View Property
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Property Info */}
        {renovation.property && (
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-border">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-muted flex items-center justify-center">
                <Building2 className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {renovation.property.beds}bd · {renovation.property.baths}ba · {renovation.property.sqft.toLocaleString()} sqft
                </p>
                <p className="text-xs font-medium capitalize text-gray-600 dark:text-gray-400">
                  {renovation.type.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <div className="ml-auto">
              <StatusBadge status={renovation.status} pulse={renovation.status === "active"} />
            </div>
          </div>
        )}

        {/* Budget Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Budget</span>
            </div>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(baseline)}</span>
          </div>
          <BudgetGauge baseline={baseline} spent={spent} committed={committed} size="md" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-muted/50">
            <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
              {renovation.arv ? formatCurrency(renovation.arv) : "—"}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ARV</span>
          </div>
          <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-muted/50">
            <div className={cn(
              "text-lg font-bold tabular-nums",
              renovation.targetRoiPct >= 25 ? "text-emerald-600" : "text-blue-600"
            )}>
              {renovation.targetRoiPct}%
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Target ROI</span>
          </div>
          <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-muted/50">
            <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
              {daysActive > 0 ? `${daysActive}d` : "—"}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</span>
          </div>
        </div>

        {/* Trades */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-medium text-muted-foreground">Scope Trades</span>
          </div>
          <TradeChips trades={trades} limit={5} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border">
          <div className="flex items-center gap-2">
            {pendingBids > 0 && (
              <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                <Users className="h-3 w-3 mr-1" />
                {pendingBids} bids pending
              </Badge>
            )}
            {pendingCOs > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {pendingCOs} CO pending
              </Badge>
            )}
            {pendingBids === 0 && pendingCOs === 0 && (
              <span className="text-xs text-muted-foreground">
                {renovation._count.bids} bids · {renovation._count.changeOrders} COs
              </span>
            )}
          </div>

          {renovation.startAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Started {format(new Date(renovation.startAt), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// KANBAN CARD COMPONENT
// ============================================================================

function KanbanCard({
  renovation,
  onClick,
}: {
  renovation: Renovation;
  onClick: () => void;
}) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const baseline = renovation.budgetLedger?.baseline || renovation.maxExposureUsd;
  const spent = renovation.budgetLedger?.actuals || 0;
  const pendingCOs = renovation.changeOrders.filter(co => co.status === "proposed").length;

  return (
    <Card
      className="bg-white dark:bg-muted hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-gray-200 dark:border-border"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {renovation.address}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {renovation.city}, {renovation.state}
              </p>
            </div>
            {pendingCOs > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600 flex-shrink-0">
                {pendingCOs} CO
              </Badge>
            )}
          </div>

          <BudgetGauge baseline={baseline} spent={spent} committed={spent} size="sm" />

          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(baseline)}
            </span>
            <span className={cn(
              "text-sm font-semibold tabular-nums",
              renovation.targetRoiPct >= 25 ? "text-emerald-600" : "text-blue-600"
            )}>
              {renovation.targetRoiPct}% ROI
            </span>
          </div>

          <TradeChips trades={renovation.scopeNodes.map(s => s.trade)} limit={3} />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function RenovationCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-border">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="ml-auto">
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="mb-4">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="flex gap-1 mb-4">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-5 w-10 rounded" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function RenovationsPage() {
  const [renovations, setRenovations] = useState<Renovation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  // Sheet state
  const [selectedRenovation, setSelectedRenovation] = useState<Renovation | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  // Dialog states
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Request Bid dialog states
  const [requestBidDialogOpen, setRequestBidDialogOpen] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);

  // Fetch renovations - use seed data for demo, combine with API data
  useEffect(() => {
    const fetchRenovations = async () => {
      try {
        const response = await fetch('/api/renovations');
        if (response.ok) {
          const data = await response.json();
          if (data.renovations && data.renovations.length > 0) {
            // Map API data to match seed structure
            const mapped = data.renovations.map((r: any) => ({
              ...r,
              city: r.property?.city || r.region?.split(", ")[0] || "Unknown",
              state: r.property?.state || r.region?.split(", ")[1] || "FL",
              budgetLedger: r.budgetLedger ? {
                baseline: r.maxExposureUsd,
                committed: JSON.parse(r.budgetLedger.committed || "{}").total || 0,
                actuals: JSON.parse(r.budgetLedger.actuals || "{}").total || 0,
                contingencyRemaining: r.budgetLedger.contingencyRemaining || 0,
              } : undefined,
              scopeNodes: r.scopeNodes || [],
              bids: r.bids || [],
              changeOrders: r.changeOrders || [],
            }));
            // Combine API data with seed data for demo purposes
            // Mark API data with isDemo: false, seed data with isDemo: true
            const apiWithFlag = mapped.map((r: any) => ({ ...r, isDemo: false }));
            const seedWithFlag = seedRenovations.map(r => ({ ...r, isDemo: true }));
            setRenovations([...apiWithFlag, ...seedWithFlag]);
          } else {
            setRenovations(seedRenovations);
          }
        } else {
          setRenovations(seedRenovations);
        }
      } catch (error) {
        console.error('Error fetching renovations:', error);
        setRenovations(seedRenovations);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchRenovations, 500);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  // Filter renovations
  const filteredRenovations = useMemo(() => {
    return renovations.filter(renovation => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesAddress = renovation.address.toLowerCase().includes(query);
        const matchesCity = renovation.city.toLowerCase().includes(query);
        if (!matchesAddress && !matchesCity) return false;
      }
      if (statusFilter !== "all" && renovation.status !== statusFilter) return false;
      return true;
    });
  }, [renovations, searchQuery, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => calculateRenovationStats(renovations), [renovations]);

  // Handlers
  const handleRenovationAction = (renovationId: string, action: string) => {
    const renovation = renovations.find(r => r.id === renovationId);
    if (!renovation) return;

    switch (action) {
      case "view":
        setSelectedRenovation(renovation);
        setDetailTab("overview");
        setDetailSheetOpen(true);
        break;
      case "edit":
        setSelectedRenovation(renovation);
        setNewStatus(renovation.status);
        setStatusNotes("");
        setUpdateStatusDialogOpen(true);
        break;
      case "start":
      case "resume":
        handleQuickStatusChange(renovationId, "active");
        break;
      case "pause":
        handleQuickStatusChange(renovationId, "on_hold");
        break;
    }
  };

  const handleQuickStatusChange = async (renovationId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/renovations/${renovationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "active" && { startAt: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        toast.success(`Project ${newStatus === "active" ? "started" : "paused"}`);
        setRenovations(prev => prev.map(r =>
          r.id === renovationId
            ? { ...r, status: newStatus, startAt: newStatus === "active" ? new Date().toISOString() : r.startAt }
            : r
        ));
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      // Update local state anyway for demo
      setRenovations(prev => prev.map(r =>
        r.id === renovationId
          ? { ...r, status: newStatus, startAt: newStatus === "active" ? new Date().toISOString() : r.startAt }
          : r
      ));
      toast.success(`Project ${newStatus === "active" ? "started" : "paused"}`);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRenovation) return;
    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/renovations/${selectedRenovation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "active" && !selectedRenovation.startAt && { startAt: new Date().toISOString() }),
          ...(newStatus === "completed" && { completedAt: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        toast.success('Status updated');
        setUpdateStatusDialogOpen(false);
        setRenovations(prev => prev.map(r =>
          r.id === selectedRenovation.id
            ? {
                ...r,
                status: newStatus,
                startAt: newStatus === "active" && !r.startAt ? new Date().toISOString() : r.startAt,
                completedAt: newStatus === "completed" ? new Date().toISOString() : r.completedAt,
              }
            : r
        ));
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      // Update local state anyway for demo
      setRenovations(prev => prev.map(r =>
        r.id === selectedRenovation.id
          ? {
              ...r,
              status: newStatus,
              startAt: newStatus === "active" && !r.startAt ? new Date().toISOString() : r.startAt,
              completedAt: newStatus === "completed" ? new Date().toISOString() : r.completedAt,
            }
          : r
      ));
      toast.success('Status updated');
      setUpdateStatusDialogOpen(false);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Fetch vendors by trade
  const fetchVendorsByTrade = async (trade: string) => {
    setLoadingVendors(true);
    try {
      const response = await fetch(`/api/vendors?trade=${encodeURIComponent(trade)}`);
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Open request bid dialog
  const openRequestBidDialog = (trade?: string) => {
    setSelectedTrade(trade || "");
    setSelectedVendorId("");
    setBidAmount("");
    setBidNotes("");
    setRequestBidDialogOpen(true);
    if (trade) {
      fetchVendorsByTrade(trade);
    }
  };

  // Handle trade selection change
  const handleTradeChange = (trade: string) => {
    setSelectedTrade(trade);
    setSelectedVendorId("");
    if (trade) {
      fetchVendorsByTrade(trade);
    } else {
      setVendors([]);
    }
  };

  // Submit bid request
  const handleSubmitBid = async () => {
    if (!selectedRenovation || !selectedVendorId || !bidAmount) return;

    setSubmittingBid(true);
    try {
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: selectedRenovation.id,
          vendorId: selectedVendorId,
          trade: selectedTrade,
          subtotal: parseFloat(bidAmount),
          items: [{
            trade: selectedTrade,
            task: `${selectedTrade} work`,
            quantity: 1,
            unit: 'lot',
            unitPrice: parseFloat(bidAmount),
            totalPrice: parseFloat(bidAmount),
          }],
          includes: [],
          excludes: [],
          notes: bidNotes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Bid created successfully');
        setRequestBidDialogOpen(false);

        // Add the new bid to the selected renovation's bids
        const vendor = vendors.find(v => v.id === selectedVendorId);
        const newBid = {
          id: data.bid.id,
          vendorId: selectedVendorId,
          vendorName: vendor?.name || 'Unknown Vendor',
          subtotal: parseFloat(bidAmount),
          status: 'pending',
          trade: selectedTrade,
          createdAt: new Date().toISOString(),
        };

        // Update the renovation in state
        setRenovations(prev => prev.map(r =>
          r.id === selectedRenovation.id
            ? {
                ...r,
                bids: [...r.bids, newBid],
                _count: { ...r._count, bids: r._count.bids + 1 },
              }
            : r
        ));

        // Update selected renovation
        setSelectedRenovation(prev => prev ? {
          ...prev,
          bids: [...prev.bids, newBid],
          _count: { ...prev._count, bids: prev._count.bids + 1 },
        } : null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create bid');
      }
    } catch (error) {
      console.error('Error creating bid:', error);
      toast.error('Failed to create bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  const exportToCSV = () => {
    const renovationsToExport = filteredRenovations.length > 0 ? filteredRenovations : renovations;
    if (renovationsToExport.length === 0) {
      toast.error("No renovations to export");
      return;
    }

    let csvContent = "Address,City,State,Status,Budget,Spent,Target ROI,ARV,Start Date,Completed\n";
    renovationsToExport.forEach(r => {
      csvContent += `"${r.address}",${r.city},${r.state},${r.status},${r.maxExposureUsd},${r.budgetLedger?.actuals || 0},${r.targetRoiPct}%,${r.arv || ""},${r.startAt || ""},${r.completedAt || ""}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `renovations-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${renovationsToExport.length} renovations`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Renovations
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Manage fix and flip renovation projects
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={renovations.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {/* Stats bar - mobile grid, desktop horizontal scroll */}
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <StatChip label="Active" value={stats.active} icon={<Hammer className="h-4 w-4" />} color="blue" />
          <StatChip label="Budget" value={formatCompactCurrency(stats.totalBudget)} icon={<DollarSign className="h-4 w-4" />} color="emerald" />
          <StatChip label="Avg ROI" value={`${stats.avgTargetRoi.toFixed(0)}%`} icon={<Target className="h-4 w-4" />} color="purple" />
        </div>
        <div className="hidden sm:block -mx-6">
          <div className="flex gap-3 overflow-x-auto py-2 px-6 scrollbar-hide">
            <StatChip label="Total" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} color="gray" />
            <StatChip label="Active" value={stats.active} icon={<Hammer className="h-4 w-4" />} color="blue" />
            <StatChip label="Planning" value={stats.planning} icon={<FileText className="h-4 w-4" />} color="gray" />
            <StatChip label="On Hold" value={stats.onHold} icon={<Pause className="h-4 w-4" />} color="amber" warning={stats.onHold > 0} />
            <StatChip label="Total Budget" value={formatCompactCurrency(stats.totalBudget)} icon={<DollarSign className="h-4 w-4" />} color="emerald" />
            <StatChip label="Spent" value={formatCompactCurrency(stats.totalSpent)} icon={<Receipt className="h-4 w-4" />} color="orange" />
            <StatChip label="Avg ROI" value={`${stats.avgTargetRoi.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} color="purple" />
            {stats.pendingChangeOrders > 0 && (
              <StatChip label="Pending COs" value={stats.pendingChangeOrders} icon={<AlertTriangle className="h-4 w-4" />} color="amber" warning />
            )}
          </div>
        </div>

        {/* Status Pipeline */}
        <div className="mt-4 mb-4">
          <StatusPipeline
            renovations={renovations}
            activeStatus={statusFilter}
            onStatusClick={setStatusFilter}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center justify-between">
          <div className="flex flex-1 gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-card"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[90px] sm:w-[126px] bg-white dark:bg-card flex-shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list" | "kanban")}>
            <TabsList className="bg-white dark:bg-card flex-shrink-0">
              <TabsTrigger value="grid" className="px-2.5 sm:px-3.5 py-2">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2.5 sm:px-3.5 py-2">
                <List className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="kanban" className="px-2.5 sm:px-3.5 py-2">
                <Columns3 className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="pr-4 pb-6 pt-1">
          {isLoading ? (
            viewMode === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {PIPELINE_STAGES.map((stage) => (
                  <div key={stage} className="flex-shrink-0 w-72">
                    <Skeleton className="h-10 w-full rounded-t-lg" />
                    <Card className="rounded-t-none py-0 gap-0">
                      <div className="p-2 space-y-2">
                        {[1, 2].map(i => (
                          <Skeleton key={i} className="h-32 w-full rounded" />
                        ))}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
              )}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <RenovationCardSkeleton key={i} />
                ))}
              </div>
            )
          ) : filteredRenovations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center mb-4">
                <Hammer className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No renovations found</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters to see more projects"
                  : "Start a renovation from a closed contract to begin tracking progress"
                }
              </p>
              <Button asChild>
                <Link href="/app/contracts">
                  <Plus className="h-4 w-4 mr-2" />
                  View Contracts
                </Link>
              </Button>
            </div>
          ) : viewMode === "kanban" ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {PIPELINE_STAGES.map((stage) => {
                const config = STATUS_CONFIG[stage];
                const stageRenovations = filteredRenovations.filter(r => r.status === stage);
                const Icon = config.icon;

                return (
                  <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0",
                      config.bgColor, config.borderColor
                    )}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <span className={cn("font-medium text-sm", config.color)}>{config.label}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {stageRenovations.length}
                      </Badge>
                    </div>
                    <Card className="flex-1 rounded-t-none py-0 gap-0 border-t-0 min-h-[360px]">
                      <ScrollArea className="h-full">
                        <div className="p-2 space-y-2">
                          {stageRenovations.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                              No projects
                            </div>
                          ) : (
                            stageRenovations.map((renovation) => (
                              <KanbanCard
                                key={renovation.id}
                                renovation={renovation}
                                onClick={() => {
                                  setSelectedRenovation(renovation);
                                  setDetailTab("overview");
                                  setDetailSheetOpen(true);
                                }}
                              />
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </Card>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
              {filteredRenovations.map((renovation) => (
                <RenovationCard
                  key={renovation.id}
                  renovation={renovation}
                  onSelect={() => {
                    setSelectedRenovation(renovation);
                    setDetailTab("overview");
                    setDetailSheetOpen(true);
                  }}
                  onAction={(action) => handleRenovationAction(renovation.id, action)}
                  compact={viewMode === "list"}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col bg-white dark:bg-card">
          {selectedRenovation && (
            <>
              <SheetHeader className="p-4 border-b flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{selectedRenovation.address}</SheetTitle>
                    <SheetDescription>
                      {selectedRenovation.city}, {selectedRenovation.state}
                    </SheetDescription>
                  </div>
                  <StatusBadge status={selectedRenovation.status} />
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(selectedRenovation.maxExposureUsd)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">budget</span>
                  </div>
                  <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                  <div>
                    <span className={cn(
                      "text-2xl font-bold",
                      selectedRenovation.targetRoiPct >= 25 ? "text-emerald-600" : "text-blue-600"
                    )}>
                      {selectedRenovation.targetRoiPct}%
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">target ROI</span>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="flex-shrink-0 grid w-full grid-cols-5 rounded-none border-b bg-transparent h-auto p-0">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5 text-xs">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="scope" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5 text-xs">
                    Scope
                  </TabsTrigger>
                  <TabsTrigger value="bids" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5 text-xs">
                    Bids
                  </TabsTrigger>
                  <TabsTrigger value="changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5 text-xs">
                    Changes
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5 text-xs">
                    Actions
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  <TabsContent value="overview" className="m-0 p-4 space-y-4">
                    {/* Property Info */}
                    {selectedRenovation.property && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Property</h4>
                        <Card className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-muted flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium">{selectedRenovation.address}</p>
                              <p className="text-sm text-muted-foreground">
                                {selectedRenovation.property.beds}bd · {selectedRenovation.property.baths}ba · {selectedRenovation.property.sqft.toLocaleString()} sqft
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    )}

                    {/* Budget Overview */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Budget</h4>
                      <Card className="py-4 px-4">
                        <BudgetGauge
                          baseline={selectedRenovation.budgetLedger?.baseline || selectedRenovation.maxExposureUsd}
                          spent={selectedRenovation.budgetLedger?.actuals || 0}
                          committed={selectedRenovation.budgetLedger?.committed || 0}
                          size="lg"
                        />
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div className="text-center">
                            <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedRenovation.budgetLedger?.committed || 0)}</p>
                            <p className="text-xs text-muted-foreground">Committed</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedRenovation.budgetLedger?.actuals || 0)}</p>
                            <p className="text-xs text-muted-foreground">Spent</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(selectedRenovation.budgetLedger?.contingencyRemaining || 0)}</p>
                            <p className="text-xs text-muted-foreground">Contingency</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Key Dates */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Timeline</h4>
                      <Card className="py-0 gap-0">
                        <div className="divide-y dark:divide-gray-800">
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Created</span>
                            <span className="text-sm font-medium">{format(new Date(selectedRenovation.createdAt), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Started</span>
                            <span className="text-sm font-medium">{selectedRenovation.startAt ? format(new Date(selectedRenovation.startAt), "MMM d, yyyy") : "Not started"}</span>
                          </div>
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Completed</span>
                            <span className="text-sm font-medium">{selectedRenovation.completedAt ? format(new Date(selectedRenovation.completedAt), "MMM d, yyyy") : "In progress"}</span>
                          </div>
                          {selectedRenovation.startAt && !selectedRenovation.completedAt && (
                            <div className="flex justify-between py-2.5 px-4 bg-blue-50 dark:bg-blue-900/20">
                              <span className="text-sm text-blue-700 dark:text-blue-400">Days Active</span>
                              <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                {differenceInDays(new Date(), new Date(selectedRenovation.startAt))} days
                              </span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="scope" className="m-0 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Scope Items ({selectedRenovation.scopeNodes.length})
                      </h4>
                    </div>
                    {selectedRenovation.scopeNodes.length === 0 ? (
                      <div className="text-center py-12">
                        <Ruler className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h4 className="font-medium text-gray-900 dark:text-white">No scope items yet</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add scope items to track renovation work
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedRenovation.scopeNodes.map((scope) => {
                          const tradeConfig = TRADE_CONFIG[scope.trade] || { label: scope.trade, color: "text-gray-600", bgColor: "bg-gray-100" };
                          return (
                            <Card key={scope.id} className="py-3 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className={cn("px-2 py-1 text-xs font-medium rounded", tradeConfig.bgColor, tradeConfig.color)}>
                                    {tradeConfig.label}
                                  </span>
                                  <div>
                                    <p className="font-medium text-sm">{scope.task}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {scope.quantity.value} {scope.quantity.unit} · {scope.finishLvl}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-semibold tabular-nums">{formatCurrency(scope.estimatedCost)}</span>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="bids" className="m-0 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Vendor Bids ({selectedRenovation.bids.length})
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => openRequestBidDialog()}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Request Bid
                      </Button>
                    </div>
                    {selectedRenovation.bids.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h4 className="font-medium text-gray-900 dark:text-white">No bids yet</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Request bids from contractors for scope items
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedRenovation.bids.map((bid) => {
                          const tradeConfig = TRADE_CONFIG[bid.trade] || { label: bid.trade, color: "text-gray-600", bgColor: "bg-gray-100" };
                          return (
                            <Card key={bid.id} className={cn(
                              "py-3 px-4",
                              bid.status === "awarded" && "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center">
                                    <span className="text-sm font-medium text-gray-600">{bid.vendorName[0]}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{bid.vendorName}</p>
                                    <div className="flex items-center gap-2">
                                      <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", tradeConfig.bgColor, tradeConfig.color)}>
                                        {tradeConfig.label}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(bid.createdAt), "MMM d")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold tabular-nums">{formatCurrency(bid.subtotal)}</span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "ml-2 text-[10px]",
                                      bid.status === "awarded" && "border-emerald-300 text-emerald-600",
                                      bid.status === "pending" && "border-blue-300 text-blue-600",
                                      bid.status === "rejected" && "border-rose-300 text-rose-600"
                                    )}
                                  >
                                    {bid.status}
                                  </Badge>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="changes" className="m-0 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Change Orders ({selectedRenovation.changeOrders.length})
                      </h4>
                    </div>
                    {selectedRenovation.changeOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h4 className="font-medium text-gray-900 dark:text-white">No change orders</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Change orders will appear here when scope changes
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedRenovation.changeOrders.map((co) => {
                          const tradeConfig = TRADE_CONFIG[co.trade] || { label: co.trade, color: "text-gray-600", bgColor: "bg-gray-100" };
                          return (
                            <Card key={co.id} className={cn(
                              "py-3 px-4",
                              co.status === "proposed" && "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                            )}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", tradeConfig.bgColor, tradeConfig.color)}>
                                      {tradeConfig.label}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px]",
                                        co.status === "approved" && "border-emerald-300 text-emerald-600",
                                        co.status === "proposed" && "border-amber-300 text-amber-600",
                                        co.status === "denied" && "border-rose-300 text-rose-600"
                                      )}
                                    >
                                      {co.status}
                                    </Badge>
                                  </div>
                                  {co.rationale && (
                                    <p className="text-sm text-muted-foreground">{co.rationale}</p>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className={cn(
                                    "font-bold tabular-nums",
                                    co.deltaUsd > 0 ? "text-rose-600" : "text-emerald-600"
                                  )}>
                                    {co.deltaUsd > 0 ? "+" : ""}{formatCurrency(co.deltaUsd)}
                                  </span>
                                  {co.impactDays > 0 && (
                                    <p className="text-xs text-muted-foreground">+{co.impactDays} days</p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="actions" className="m-0 p-4 space-y-3">
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => { setDetailSheetOpen(false); handleRenovationAction(selectedRenovation.id, "edit"); }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Update Status
                    </Button>

                    {selectedRenovation.status === "planning" && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailSheetOpen(false); handleQuickStatusChange(selectedRenovation.id, "active"); }}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start Project
                      </Button>
                    )}

                    {selectedRenovation.status === "active" && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailSheetOpen(false); handleQuickStatusChange(selectedRenovation.id, "on_hold"); }}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Put On Hold
                      </Button>
                    )}

                    {selectedRenovation.status === "on_hold" && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailSheetOpen(false); handleQuickStatusChange(selectedRenovation.id, "active"); }}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Resume Project
                      </Button>
                    )}

                    {selectedRenovation.status === "active" && (
                      <Button
                        className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setDetailSheetOpen(false); handleQuickStatusChange(selectedRenovation.id, "completed"); }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Completed
                      </Button>
                    )}

                    {selectedRenovation.propertyId && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        asChild
                      >
                        <Link href={`/app/properties/${selectedRenovation.propertyId}`}>
                          <Home className="mr-2 h-4 w-4" />
                          View Property
                        </Link>
                      </Button>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent className="bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle>Update Renovation Status</DialogTitle>
            <DialogDescription>Change the status of this renovation project</DialogDescription>
          </DialogHeader>
          {selectedRenovation && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Property</h3>
                <p className="text-sm text-muted-foreground">{selectedRenovation.address}</p>
              </div>

              <div>
                <Label htmlFor="newStatus">New Status *</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="newStatus">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="statusNotes">Notes (Optional)</Label>
                <Textarea
                  id="statusNotes"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Add notes about this status change..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(false)} disabled={updatingStatus}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus || !newStatus}>
              {updatingStatus ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Bid Dialog */}
      <Dialog open={requestBidDialogOpen} onOpenChange={setRequestBidDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle>Request Vendor Bid</DialogTitle>
            <DialogDescription>
              Select a trade and vendor to request a bid for this renovation
            </DialogDescription>
          </DialogHeader>
          {selectedRenovation && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Property</h3>
                <p className="text-sm text-muted-foreground">{selectedRenovation.address}</p>
              </div>

              <div>
                <Label htmlFor="bidTrade">Trade *</Label>
                <Select value={selectedTrade} onValueChange={handleTradeChange}>
                  <SelectTrigger id="bidTrade">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRADE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bidVendor">Vendor *</Label>
                <Select
                  value={selectedVendorId}
                  onValueChange={setSelectedVendorId}
                  disabled={!selectedTrade || loadingVendors}
                >
                  <SelectTrigger id="bidVendor">
                    <SelectValue placeholder={loadingVendors ? "Loading vendors..." : "Select vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.length === 0 && !loadingVendors && (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No vendors found for this trade
                      </div>
                    )}
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{vendor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {vendor.reliability?.toFixed(0) || 100}% reliable
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTrade && vendors.length === 0 && !loadingVendors && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Link href="/app/vendors" className="text-blue-500 hover:underline">
                      Add a vendor
                    </Link>
                    {" "}for this trade first
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="bidAmount">Bid Amount ($) *</Label>
                <Input
                  id="bidAmount"
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter bid amount"
                />
              </div>

              <div>
                <Label htmlFor="bidNotes">Notes (Optional)</Label>
                <Textarea
                  id="bidNotes"
                  value={bidNotes}
                  onChange={(e) => setBidNotes(e.target.value)}
                  placeholder="Add any notes about this bid..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestBidDialogOpen(false)} disabled={submittingBid}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBid}
              disabled={submittingBid || !selectedTrade || !selectedVendorId || !bidAmount}
            >
              {submittingBid ? "Creating..." : "Create Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
