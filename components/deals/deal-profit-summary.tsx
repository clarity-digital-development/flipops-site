"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Home,
  DollarSign,
  ArrowDown,
  Minus,
  Clock,
  Trophy,
  Sparkles,
  Share2,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

export interface DealProfitData {
  // Property info
  address: string;
  city: string;
  state: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;

  // Deal type
  dealType: "wholesale" | "flip" | "rental";

  // Timeline
  contractDate: Date;
  closedDate: Date;

  // Financials - Acquisition
  purchasePrice: number;
  closingCostsBuy: number;

  // Financials - Wholesale (assignment)
  assignmentFee?: number;

  // Financials - Flip
  repairCosts?: number;
  holdingCosts?: number;
  closingCostsSell?: number;
  salePrice?: number;

  // Financials - Rental (optional for portfolio view)
  monthlyRent?: number;
  monthlyExpenses?: number;
  capRate?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getDaysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateProfit(data: DealProfitData): {
  totalInvested: number;
  totalReturned: number;
  netProfit: number;
  roi: number;
} {
  if (data.dealType === "wholesale") {
    const totalInvested = 0; // Wholesaling typically requires no capital
    const totalReturned = data.assignmentFee || 0;
    return {
      totalInvested,
      totalReturned,
      netProfit: totalReturned,
      roi: 100, // Infinite ROI technically, show 100%
    };
  }

  if (data.dealType === "flip") {
    const totalInvested =
      data.purchasePrice +
      (data.closingCostsBuy || 0) +
      (data.repairCosts || 0) +
      (data.holdingCosts || 0);
    const totalReturned = (data.salePrice || 0) - (data.closingCostsSell || 0);
    const netProfit = totalReturned - totalInvested;
    const roi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
    return { totalInvested, totalReturned, netProfit, roi };
  }

  // Rental - show first year projection
  const annualIncome = (data.monthlyRent || 0) * 12;
  const annualExpenses = (data.monthlyExpenses || 0) * 12;
  const netProfit = annualIncome - annualExpenses;
  const totalInvested = data.purchasePrice + (data.closingCostsBuy || 0);
  const roi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  return { totalInvested, totalReturned: annualIncome, netProfit, roi };
}

// ============================================================================
// WATERFALL LINE COMPONENT
// ============================================================================

interface WaterfallLineProps {
  label: string;
  amount: number;
  type: "add" | "subtract" | "total" | "result";
  highlight?: boolean;
  delay?: number;
}

function WaterfallLine({
  label,
  amount,
  type,
  highlight,
  delay = 0,
}: WaterfallLineProps) {
  const isPositive = amount >= 0;
  const displayAmount =
    type === "subtract" ? -Math.abs(amount) : Math.abs(amount);

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 px-4 rounded-lg transition-all duration-300",
        "animate-in fade-in slide-in-from-left-2",
        type === "total" && "bg-gray-100/50 dark:bg-white/5 font-medium",
        type === "result" &&
          "bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 dark:from-amber-500/20 dark:via-yellow-500/20 dark:to-amber-500/20",
        highlight && "ring-1 ring-amber-500/30"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        {type === "subtract" && (
          <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center">
            <Minus className="w-3 h-3 text-rose-500" />
          </div>
        )}
        {type === "add" && (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          </div>
        )}
        {type === "total" && (
          <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center">
            <ArrowDown className="w-3 h-3 text-gray-500" />
          </div>
        )}
        {type === "result" && (
          <div className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center">
            <Trophy className="w-3 h-3 text-amber-500" />
          </div>
        )}
        <span
          className={cn(
            "text-sm",
            type === "result"
              ? "font-semibold text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-400"
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          type === "subtract" && "text-rose-600 dark:text-rose-400",
          type === "add" && "text-emerald-600 dark:text-emerald-400",
          type === "total" && "text-gray-700 dark:text-gray-300",
          type === "result" &&
            "text-lg font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent"
        )}
      >
        {type === "subtract" ? "−" : type === "add" ? "+" : ""}
        {formatCurrency(Math.abs(displayAmount))}
      </span>
    </div>
  );
}

// ============================================================================
// STAT PILL COMPONENT
// ============================================================================

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

function StatPill({ icon, label, value, trend }: StatPillProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/50 dark:border-white/10">
      <div className="text-gray-500 dark:text-gray-400">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 font-medium">
          {label}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            trend === "up" && "text-emerald-600 dark:text-emerald-400",
            trend === "down" && "text-rose-600 dark:text-rose-400",
            !trend && "text-gray-900 dark:text-white"
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface DealProfitSummaryProps {
  data: DealProfitData;
  className?: string;
  variant?: "card" | "sheet" | "export";
  onShare?: () => void;
  onExport?: () => void;
}

export function DealProfitSummary({
  data,
  className,
  variant = "card",
  onShare,
  onExport,
}: DealProfitSummaryProps) {
  const { totalInvested, totalReturned, netProfit, roi } = calculateProfit(data);
  const daysToClose = getDaysBetween(data.contractDate, data.closedDate);
  const isProfitable = netProfit > 0;

  // Determine deal type label and icon
  const dealTypeConfig = {
    wholesale: {
      label: "Wholesale",
      color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
      icon: <Share2 className="w-3 h-3" />,
    },
    flip: {
      label: "Fix & Flip",
      color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
      icon: <Home className="w-3 h-3" />,
    },
    rental: {
      label: "Buy & Hold",
      color: "bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30",
      icon: <DollarSign className="w-3 h-3" />,
    },
  };

  const dealConfig = dealTypeConfig[data.dealType];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        // Base styling
        "bg-gradient-to-br from-gray-50 via-white to-gray-50",
        "dark:from-gray-950 dark:via-gray-900 dark:to-gray-950",
        "border border-gray-200/80 dark:border-gray-800/80",
        "shadow-xl shadow-gray-200/50 dark:shadow-black/50",
        // Size variants
        variant === "card" && "max-w-md",
        variant === "sheet" && "w-full",
        variant === "export" && "w-[480px]",
        className
      )}
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-400/20 via-yellow-500/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-emerald-400/10 via-teal-500/5 to-transparent rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative">
        {/* Header with property info */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Deal type badge */}
              <Badge
                className={cn(
                  "mb-3 border",
                  dealConfig.color
                )}
              >
                {dealConfig.icon}
                {dealConfig.label}
              </Badge>

              {/* Address */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {data.address}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {data.city}, {data.state}
              </p>

              {/* Property details */}
              {(data.bedrooms || data.bathrooms || data.sqft) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {data.bedrooms && `${data.bedrooms} bed`}
                  {data.bathrooms && ` · ${data.bathrooms} bath`}
                  {data.sqft && ` · ${data.sqft.toLocaleString()} sqft`}
                </p>
              )}
            </div>

            {/* ROI Circle */}
            <div className="relative flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200 dark:text-gray-800"
                />
                {/* Progress ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#roiGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(roi, 100) * 2.64} 264`}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="roiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {roi.toFixed(1)}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                  ROI
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profit Hero Section */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-50/50 via-white to-gray-50/50 dark:from-gray-900/50 dark:via-gray-800/30 dark:to-gray-900/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">
                Net Profit
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-bold tracking-tight",
                    isProfitable
                      ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {isProfitable ? "+" : ""}
                  {formatCurrency(netProfit)}
                </span>
                {isProfitable && (
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                )}
              </div>
            </div>
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                isProfitable
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30"
                  : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/30"
              )}
            >
              {isProfitable ? (
                <TrendingUp className="w-6 h-6 text-white" />
              ) : (
                <TrendingDown className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Timeline Stats */}
        <div className="px-6 py-4 flex gap-3 overflow-x-auto">
          <StatPill
            icon={<Calendar className="w-4 h-4" />}
            label="Contract"
            value={formatDate(data.contractDate)}
          />
          <StatPill
            icon={<Calendar className="w-4 h-4" />}
            label="Closed"
            value={formatDate(data.closedDate)}
          />
          <StatPill
            icon={<Clock className="w-4 h-4" />}
            label="Duration"
            value={`${daysToClose} days`}
            trend={daysToClose <= 30 ? "up" : daysToClose >= 90 ? "down" : "neutral"}
          />
        </div>

        {/* Waterfall Breakdown */}
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {data.dealType === "wholesale" && (
              <>
                <WaterfallLine
                  label="Assignment Fee"
                  amount={data.assignmentFee || 0}
                  type="add"
                  delay={0}
                />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />
                <WaterfallLine
                  label="Net Profit"
                  amount={netProfit}
                  type="result"
                  highlight
                  delay={100}
                />
              </>
            )}

            {data.dealType === "flip" && (
              <>
                <WaterfallLine
                  label="Sale Price"
                  amount={data.salePrice || 0}
                  type="add"
                  delay={0}
                />
                <WaterfallLine
                  label="Purchase Price"
                  amount={data.purchasePrice}
                  type="subtract"
                  delay={50}
                />
                <WaterfallLine
                  label="Buy Closing Costs"
                  amount={data.closingCostsBuy}
                  type="subtract"
                  delay={100}
                />
                <WaterfallLine
                  label="Repair Costs"
                  amount={data.repairCosts || 0}
                  type="subtract"
                  delay={150}
                />
                <WaterfallLine
                  label="Holding Costs"
                  amount={data.holdingCosts || 0}
                  type="subtract"
                  delay={200}
                />
                <WaterfallLine
                  label="Sell Closing Costs"
                  amount={data.closingCostsSell || 0}
                  type="subtract"
                  delay={250}
                />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />
                <WaterfallLine
                  label="Net Profit"
                  amount={netProfit}
                  type="result"
                  highlight
                  delay={300}
                />
              </>
            )}

            {data.dealType === "rental" && (
              <>
                <WaterfallLine
                  label="Annual Rental Income"
                  amount={(data.monthlyRent || 0) * 12}
                  type="add"
                  delay={0}
                />
                <WaterfallLine
                  label="Annual Expenses"
                  amount={(data.monthlyExpenses || 0) * 12}
                  type="subtract"
                  delay={50}
                />
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />
                <WaterfallLine
                  label="Annual Cash Flow"
                  amount={netProfit}
                  type="result"
                  highlight
                  delay={100}
                />
                <div className="mt-3 px-4 py-2 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-teal-700 dark:text-teal-300 font-medium">
                      Cap Rate
                    </span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      {data.capRate?.toFixed(1) || roi.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">FO</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Powered by FlipOps
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onShare && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onShare}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DEMO/PREVIEW COMPONENT
// ============================================================================

export function DealProfitSummaryDemo() {
  const sampleFlipData: DealProfitData = {
    address: "1847 Riverside Drive",
    city: "Jacksonville",
    state: "FL",
    propertyType: "Single Family",
    bedrooms: 4,
    bathrooms: 2,
    sqft: 1850,
    dealType: "flip",
    contractDate: new Date("2025-09-15"),
    closedDate: new Date("2026-01-20"),
    purchasePrice: 165000,
    closingCostsBuy: 4200,
    repairCosts: 48500,
    holdingCosts: 6800,
    closingCostsSell: 17100,
    salePrice: 285000,
  };

  const sampleWholesaleData: DealProfitData = {
    address: "2234 Oak Street",
    city: "Miami",
    state: "FL",
    dealType: "wholesale",
    contractDate: new Date("2026-01-05"),
    closedDate: new Date("2026-01-25"),
    purchasePrice: 180000,
    closingCostsBuy: 0,
    assignmentFee: 12500,
  };

  const sampleRentalData: DealProfitData = {
    address: "456 Pine Avenue",
    city: "Tampa",
    state: "FL",
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1450,
    dealType: "rental",
    contractDate: new Date("2025-11-01"),
    closedDate: new Date("2025-12-15"),
    purchasePrice: 220000,
    closingCostsBuy: 5500,
    monthlyRent: 2150,
    monthlyExpenses: 1350,
    capRate: 4.4,
  };

  return (
    <div className="p-8 space-y-8 bg-gray-100 dark:bg-gray-950 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Deal Profit Summary Cards
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DealProfitSummary
          data={sampleFlipData}
          onShare={() => console.log("Share flip")}
          onExport={() => console.log("Export flip")}
        />
        <DealProfitSummary
          data={sampleWholesaleData}
          onShare={() => console.log("Share wholesale")}
          onExport={() => console.log("Export wholesale")}
        />
        <DealProfitSummary
          data={sampleRentalData}
          onShare={() => console.log("Share rental")}
          onExport={() => console.log("Export rental")}
        />
      </div>
    </div>
  );
}
