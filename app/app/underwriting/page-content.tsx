"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PipelineBreadcrumb, derivePipelineStage } from "@/components/shared/pipeline-breadcrumb";
import {
  Search,
  Home,
  DollarSign,
  Calculator,
  Wrench,
  TrendingUp,
  AlertTriangle,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Plus,
  Save,
  Send,
  AlertCircle,
  Building,
  Star,
  Trash2,
  Zap,
  Target,
  ArrowRight,
  Calendar,
  Ruler,
  BedDouble,
  Bath,
  SquareStack,
  Sparkles,
  BarChart3,
  Layers,
  Check,
  Hammer,
  PaintBucket,
  Plug,
  Droplets,
  Wind,
  Grid3X3,
  Flame,
  Minus,
  Equal
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { type RepairItem } from "./seed-data";
import { MAOWaterfallPanel } from "@/components/deals/mao-waterfall";
import { EmptyState as CompsEmptyState } from "@/components/ui/empty-state";
import { trackLeadEvent } from "@/lib/behavior/client";

// ============================================================================
// TYPES
// ============================================================================

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  county: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  assessedValue: number | null;
  estimatedValue: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  listingDate: Date | null;
  daysOnMarket: number | null;
  score: number | null;
  scoreBreakdown: string | null;
  dataSource: string | null;
  ownerName: string | null;
  enriched: boolean;
  phoneNumbers: string | null;
  emails: string | null;
  foreclosure: boolean;
  preForeclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  bankruptcy: boolean;
  absenteeOwner: boolean;
  metadata: string | null;
  createdAt: Date;
}

interface PropertyMetadata {
  equityPercent?: number;
  estimatedEquity?: number;
  openMortgageBalance?: number;
  yearsOwned?: number;
  totalPropertiesOwned?: string;
  inherited?: boolean;
  death?: boolean;
  taxLien?: boolean;
  judgment?: boolean;
  highEquity?: boolean;
  freeClear?: boolean;
  corporateOwned?: boolean;
  outOfStateAbsenteeOwner?: boolean;
  inStateAbsenteeOwner?: boolean;
  distressScore?: number;
  distressGrade?: string;
  distressSignals?: string[];
}

interface Comp {
  id: string;
  address: string;
  soldDate: string;
  soldPrice: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  distance: number;
  pricePerSqft: number;
  similarity: number;
  selected: boolean;
  weight: number;
}


// ============================================================================
// ANIMATED NUMBER COMPONENT
// ============================================================================

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const duration = 500;
    const steps = 20;
    const stepValue = (value - displayValue) / steps;
    let current = displayValue;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += stepValue;
      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>;
}

// ============================================================================
// DEAL GAUGE - Visual deal viability indicator
// ============================================================================

function DealGauge({
  value,
  maxValue,
  label,
  size = 160
}: {
  value: number;
  maxValue: number;
  label: string;
  size?: number;
}) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  const rawPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const percentage = Math.min(100, Math.max(0, isNaN(rawPercentage) ? 0 : rawPercentage));
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // Half circle

  // Animate on mount and value change
  useEffect(() => {
    if (!hasAnimated) {
      // Initial mount animation - start from 0
      const timer = setTimeout(() => {
        setAnimatedPercentage(percentage);
        setHasAnimated(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Subsequent value changes - animate directly
      setAnimatedPercentage(percentage);
    }
  }, [percentage, hasAnimated]);

  const offset = circumference - (animatedPercentage / 100) * circumference;

  // Color based on deal quality (higher = better deal)
  const getStrokeColor = () => {
    if (percentage >= 75) return "#10b981";
    if (percentage >= 50) return "#f59e0b";
    if (percentage >= 25) return "#f97316";
    return "#ef4444";
  };

  const stroke = getStrokeColor();

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
          strokeLinecap="round"
        />

        {/* Foreground arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease'
          }}
        />

        {/* Center value */}
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          className="fill-current text-gray-900 dark:text-white font-bold"
          style={{ fontSize: size * 0.18 }}
        >
          {animatedPercentage.toFixed(0)}%
        </text>

        {/* Label */}
        <text
          x={size / 2}
          y={size / 2 + 15}
          textAnchor="middle"
          className="fill-current text-gray-500 dark:text-gray-400"
          style={{ fontSize: size * 0.08 }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

// ============================================================================
// SIMILARITY RING - Visual comp similarity indicator
// ============================================================================

function SimilarityRing({ similarity, size = 40 }: { similarity: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (similarity / 100) * circumference;

  const getColor = () => {
    if (similarity >= 90) return "#10b981";
    if (similarity >= 80) return "#84cc16";
    if (similarity >= 70) return "#f59e0b";
    return "#f97316";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 0.5s ease-out'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums">{similarity}</span>
      </div>
    </div>
  );
}

// ============================================================================
// REPAIR CATEGORY ICON
// ============================================================================

// Category display labels
const categoryLabels: Record<string, string> = {
  roof: "Roof",
  kitchen: "Kitchen",
  bath: "Bathroom",
  flooring: "Flooring",
  paint: "Paint",
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  windows: "Windows",
  exterior: "Exterior",
  foundation: "Foundation",
  landscaping: "Landscaping",
  other: "Other"
};

function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function RepairCategoryIcon({ category }: { category: string }) {
  const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
    roof: { icon: <Home className="h-4 w-4" />, color: "text-amber-500 bg-amber-500/10" },
    kitchen: { icon: <Grid3X3 className="h-4 w-4" />, color: "text-purple-500 bg-purple-500/10" },
    bath: { icon: <Droplets className="h-4 w-4" />, color: "text-blue-500 bg-blue-500/10" },
    flooring: { icon: <Layers className="h-4 w-4" />, color: "text-emerald-500 bg-emerald-500/10" },
    paint: { icon: <PaintBucket className="h-4 w-4" />, color: "text-pink-500 bg-pink-500/10" },
    hvac: { icon: <Wind className="h-4 w-4" />, color: "text-cyan-500 bg-cyan-500/10" },
    electrical: { icon: <Plug className="h-4 w-4" />, color: "text-yellow-500 bg-yellow-500/10" },
    plumbing: { icon: <Droplets className="h-4 w-4" />, color: "text-indigo-500 bg-indigo-500/10" },
    windows: { icon: <SquareStack className="h-4 w-4" />, color: "text-sky-500 bg-sky-500/10" },
    exterior: { icon: <Building className="h-4 w-4" />, color: "text-stone-500 bg-stone-500/10" },
    foundation: { icon: <Hammer className="h-4 w-4" />, color: "text-red-500 bg-red-500/10" },
    landscaping: { icon: <Sparkles className="h-4 w-4" />, color: "text-green-500 bg-green-500/10" },
    other: { icon: <Wrench className="h-4 w-4" />, color: "text-gray-500 bg-gray-500/10" }
  };

  const config = iconMap[category] || iconMap.other;

  return (
    <div className={cn("p-2 rounded-lg", config.color)}>
      {config.icon}
    </div>
  );
}

// ============================================================================
// PROPERTY CARD - Left panel property selector
// ============================================================================

function PropertyCard({
  property,
  isSelected,
  onClick
}: {
  property: Property;
  isSelected: boolean;
  onClick: () => void;
}) {
  const score = property.score || 0;
  const isHot = score >= 85;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-3 rounded-xl cursor-pointer transition-all duration-200",
        "border border-transparent",
        isSelected
          ? "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Score indicator with fire icon for hot leads */}
        <div className={cn(
          "relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
          score >= 85 ? "bg-gradient-to-br from-red-500 to-orange-500 text-white" :
          score >= 70 ? "bg-gradient-to-br from-amber-500 to-yellow-500 text-white" :
          score >= 50 ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white" :
          "bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400"
        )}>
          {score}
          {/* Fire icon for hot leads */}
          {isHot && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Flame className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium text-sm truncate",
            isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"
          )}>
            {property.address}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {property.city}, {property.state}
          </p>

          {/* Quick stats */}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
            {property.bedrooms && (
              <span className="flex items-center gap-0.5">
                <BedDouble className="h-3 w-3" />
                {property.bedrooms}
              </span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-0.5">
                <Bath className="h-3 w-3" />
                {property.bathrooms}
              </span>
            )}
            {property.squareFeet && (
              <span className="flex items-center gap-0.5">
                <Ruler className="h-3 w-3" />
                {property.squareFeet.toLocaleString()}
              </span>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {property.enriched && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                Skip Traced
              </Badge>
            )}
            {property.preForeclosure && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                Pre-FC
              </Badge>
            )}
            {property.vacant && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                Vacant
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMP CARD - Comparable property card
// ============================================================================

function CompCard({
  comp,
  isSelected,
  isOutlier,
  onToggle
}: {
  comp: Comp;
  isSelected: boolean;
  isOutlier: boolean;
  onToggle: () => void;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div
      onClick={onToggle}
      className={cn(
        "group relative p-3 rounded-xl cursor-pointer transition-all duration-200",
        "border",
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
          : "bg-white dark:bg-card border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-border",
        isOutlier && "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-gray-900"
      )}
    >
      {/* Selection indicator */}
      <div className={cn(
        "absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
        isSelected
          ? "bg-blue-500 border-blue-500"
          : "border-gray-300 dark:border-border"
      )}>
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Outlier warning */}
      {isOutlier && (
        <div className="absolute -top-2 -left-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-3 w-3 text-amber-900" />
        </div>
      )}

      <div className="flex items-start gap-3 pr-6">
        {/* Similarity ring */}
        <SimilarityRing similarity={comp.similarity} />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {comp.address}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Sold {new Date(comp.soldDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>

          {/* Price and stats */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(comp.soldPrice)}
            </span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
              ${comp.pricePerSqft}/sf
            </span>
          </div>

          {/* Property details */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{comp.beds}bd / {comp.baths}ba</span>
            <span>{comp.sqft.toLocaleString()} sf</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {comp.distance.toFixed(2)}mi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NET SHEET SUMMARY - Sticky bottom bar
// ============================================================================

function NetSheetSummary({
  arv,
  repairs,
  mao,
  suggestedOffer,
  arvSource,
  onCreateOffer,
  onSaveAnalysis,
  saving
}: {
  arv: number;
  repairs: number;
  mao: number;
  suggestedOffer: number;
  arvSource: "comps" | "avm";
  onCreateOffer: () => void;
  onSaveAnalysis: () => void;
  saving: boolean;
}) {
  const dealMargin = arv > 0 ? ((arv - suggestedOffer - repairs) / arv * 100) : 0;

  return (
    <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-border">
      <div className="flex items-center justify-between gap-4">
        {/* Key metrics - centered alignment */}
        <div className="flex items-center gap-3">
          {/* ARV */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              <BarChart3 className="h-3 w-3" />
              ARV
              <Badge variant="outline" className="ml-1 text-[8px] h-4 px-1 border-gray-300 dark:border-border text-gray-500 dark:text-gray-400">
                {arvSource === "comps" ? "Comps" : "AVM"}
              </Badge>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedNumber value={arv} prefix="$" />
            </div>
          </div>

          {/* Minus sign */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-muted mt-5">
            <Minus className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </div>

          {/* Repairs */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              <Wrench className="h-3 w-3" />
              Repairs
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              <AnimatedNumber value={repairs} prefix="$" />
            </div>
          </div>

          {/* Equals sign */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-muted mt-5">
            <Equal className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </div>

          {/* MAO */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              <Target className="h-3 w-3" />
              MAO (70%)
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              <AnimatedNumber value={mao} prefix="$" />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 mt-5">
            <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Suggested Offer */}
          <div className="text-center px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">
              <DollarSign className="h-3 w-3" />
              Offer
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              <AnimatedNumber value={suggestedOffer} prefix="$" />
            </div>
          </div>

          {/* Deal Margin */}
          <div className="text-center pl-4 border-l border-gray-300 dark:border-border">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Margin
            </div>
            <div className={cn(
              "text-lg font-bold tabular-nums",
              dealMargin >= 20 ? "text-emerald-600 dark:text-emerald-400" :
              dealMargin >= 10 ? "text-amber-600 dark:text-amber-400" :
              "text-red-600 dark:text-red-400"
            )}>
              {dealMargin.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveAnalysis}
            disabled={saving}
            className="border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          >
            {saving ? (
              <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          <Button
            onClick={onCreateOffer}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30"
          >
            <Send className="h-4 w-4 mr-2" />
            Create Offer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCENARIO CARD
// ============================================================================

function ScenarioCard({
  strategy,
  purchasePrice,
  arv,
  repairs,
  isRecommended
}: {
  strategy: "wholesale" | "flip" | "rental";
  purchasePrice: number;
  arv: number;
  repairs: number;
  isRecommended?: boolean;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate values based on strategy
  const getStrategyData = () => {
    switch (strategy) {
      case "wholesale":
        return {
          name: "Wholesale",
          icon: <Zap className="h-5 w-5" />,
          color: "from-blue-500 to-cyan-500",
          profit: 10000,
          roi: purchasePrice > 0 ? (10000 / purchasePrice * 100) : 0,
          holdTime: "0-30 days"
        };
      case "flip":
        const flipProfit = arv - purchasePrice - repairs - (arv * 0.09) - (50 * 90);
        return {
          name: "Fix & Flip",
          icon: <Hammer className="h-5 w-5" />,
          color: "from-amber-500 to-orange-500",
          profit: flipProfit,
          roi: purchasePrice > 0 ? (flipProfit / (purchasePrice + repairs) * 100) : 0,
          holdTime: "90-180 days"
        };
      case "rental":
        const cashFlow = Math.round((arv * 0.008) - 500);
        const capRate = arv > 0 ? (((arv * 0.008 * 12) - 2000) / (purchasePrice + repairs) * 100) : 0;
        return {
          name: "Buy & Hold",
          icon: <Building className="h-5 w-5" />,
          color: "from-emerald-500 to-teal-500",
          cashFlow,
          capRate,
          holdTime: "5+ years"
        };
    }
  };

  const config = getStrategyData();

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
      isRecommended && "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900"
    )}>
      {/* Gradient header */}
      <div className={cn("h-1.5 bg-gradient-to-r", config.color)} />

      {isRecommended && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-emerald-500 text-white text-[10px]">
            <Star className="h-3 w-3 mr-1" />
            Best Fit
          </Badge>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white", config.color)}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{config.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{config.holdTime}</p>
          </div>
        </div>

        {strategy === "rental" && "cashFlow" in config && config.cashFlow !== undefined && config.capRate !== undefined ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Est. Cash Flow</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                config.cashFlow > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                ${config.cashFlow.toLocaleString()}/mo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Cap Rate</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {config.capRate.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : "profit" in config && config.profit !== undefined && config.roi !== undefined ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Est. Profit</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                config.profit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(Math.round(config.profit))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">ROI</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                config.roi > 15 ? "text-emerald-600 dark:text-emerald-400" :
                config.roi > 5 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {config.roi.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function UnderwritingSkeleton() {
  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left panel skeleton */}
      <div className="w-80 flex-shrink-0 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6">
        <Calculator className="h-10 w-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        No Properties to Analyze
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
        Properties will appear here once discovered by ATTOM or imported manually.
        Use the Leads page to add properties to your pipeline.
      </p>
      <Button variant="outline" asChild>
        <a href="/app/leads">
          <Plus className="h-4 w-4 mr-2" />
          Go to Leads
        </a>
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnderwritingPage() {
  const { isLoaded, user } = useUser();
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams?.get("propertyId") ?? null;

  // State management
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);

  // API Comps state
  const [apiComps, setApiComps] = useState<Comp[]>([]);
  const [loadingComps, setLoadingComps] = useState(false);

  // Offer creation
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState(0);
  const [offerTerms, setOfferTerms] = useState("cash");
  const [offerContingencies, setOfferContingencies] = useState<string[]>(["inspection"]);
  const [offerClosingDate, setOfferClosingDate] = useState("");
  const [offerExpiresAt, setOfferExpiresAt] = useState("");
  const [offerEarnestMoney, setOfferEarnestMoney] = useState(0);
  const [offerNotes, setOfferNotes] = useState("");

  // What-if sliders
  const [arvAdjustment, setArvAdjustment] = useState(0);
  const [repairsAdjustment, setRepairsAdjustment] = useState(0);

  // Comps state
  const [selectedComps, setSelectedComps] = useState<string[]>([]);
  const [arvMethod, setArvMethod] = useState<"median" | "weighted" | "knn">("weighted");

  // Repairs state
  const [repairItems, setRepairItems] = useState<RepairItem[]>([]);
  const [showAddRepair, setShowAddRepair] = useState(false);
  const [newRepairCategory, setNewRepairCategory] = useState("other");
  const [newRepairDescription, setNewRepairDescription] = useState("");
  const [newRepairCost, setNewRepairCost] = useState(0);

  // Fetch properties — trigger once Clerk has initialized (user may be null on public routes)
  useEffect(() => {
    if (isLoaded) {
      fetchProperties();
    }
  }, [isLoaded]);

  const fetchProperties = async () => {
    try {
      setLoadingProperties(true);
      const response = await fetch('/api/properties?limit=50');
      if (response.ok) {
        const data = await response.json();
        const list: Property[] = (data.properties ?? []) as Property[];
        setProperties(list);
        if (list.length > 0 && !selectedPropertyId) {
          setSelectedPropertyId(list[0].id);
        }
      } else {
        setProperties([]);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setProperties([]);
    } finally {
      setLoadingProperties(false);
    }
  };

  // Sync ?propertyId=X from URL → selection once properties have loaded.
  // Fired when the Leads drawer's "Underwrite" button routes here.
  useEffect(() => {
    if (!urlPropertyId || properties.length === 0) return;
    const exists = properties.some((p) => p.id === urlPropertyId);
    if (exists && selectedPropertyId !== urlPropertyId) {
      setSelectedPropertyId(urlPropertyId);
    }
  }, [urlPropertyId, properties, selectedPropertyId]);

  // Fetch comps when property changes
  useEffect(() => {
    if (selectedPropertyId) {
      fetchComps();
      // Repair items start empty — Flippers add real line items via the
      // Add Item dialog. No synthetic age/distress-based fabrication.
      setRepairItems([]);
      setArvAdjustment(0);
      setRepairsAdjustment(0);
    }
  }, [selectedPropertyId, properties]);


  const fetchComps = async () => {
    if (!selectedPropertyId) return;

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    try {
      setLoadingComps(true);
      const params = new URLSearchParams({
        city: selectedProperty.city,
        state: selectedProperty.state,
        excludeId: selectedPropertyId,
        limit: '10',
      });

      if (selectedProperty.propertyType) params.set('propertyType', selectedProperty.propertyType);
      if (selectedProperty.bedrooms) params.set('beds', String(selectedProperty.bedrooms));
      if (selectedProperty.bathrooms) params.set('baths', String(selectedProperty.bathrooms));
      if (selectedProperty.squareFeet) params.set('sqft', String(selectedProperty.squareFeet));

      const response = await fetch(`/api/comps?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const comps: Comp[] = (data.comps ?? []) as Comp[];
        setApiComps(comps);
        setSelectedComps(comps.filter((c) => c.selected).map((c) => c.id));
      } else {
        setApiComps([]);
        setSelectedComps([]);
      }
    } catch (error) {
      console.error('Error fetching comps:', error);
      setApiComps([]);
      setSelectedComps([]);
    } finally {
      setLoadingComps(false);
    }
  };

  // Get selected property
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Parse metadata
  const parseMetadata = (metadata: string | null): PropertyMetadata => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata) as PropertyMetadata;
    } catch {
      return {};
    }
  };

  const selectedPropertyMetadata = selectedProperty ? parseMetadata(selectedProperty.metadata) : {};

  // Calculate ARV
  const calculateARV = useCallback(() => {
    const selected = apiComps.filter(c => selectedComps.includes(c.id));
    const subjectSqft = selectedProperty?.squareFeet || 0;
    const attomAVM = selectedProperty?.estimatedValue || 0;

    if (selected.length === 0 || subjectSqft === 0) {
      return attomAVM;
    }

    switch (arvMethod) {
      case "median": {
        const prices = selected.map(c => c.pricePerSqft).sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        return median * subjectSqft;
      }
      case "weighted": {
        let totalWeight = 0;
        let weightedSum = 0;
        selected.forEach(comp => {
          const distanceWeight = 1 / (1 + comp.distance);
          const similarityWeight = comp.similarity / 100;
          const weight = (distanceWeight * 0.4 + similarityWeight * 0.6);
          totalWeight += weight;
          weightedSum += comp.pricePerSqft * weight;
        });
        return (weightedSum / totalWeight) * subjectSqft;
      }
      case "knn": {
        const top3 = [...selected].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
        const avgPricePerSqft = top3.reduce((sum, c) => sum + c.pricePerSqft, 0) / top3.length;
        return avgPricePerSqft * subjectSqft;
      }
      default:
        return attomAVM;
    }
  }, [apiComps, selectedComps, selectedProperty, arvMethod]);

  // Calculate values
  const baseARV = calculateARV();
  const adjustedARV = baseARV * (1 + arvAdjustment / 100);
  const baseRepairs = repairItems.reduce((sum, item) => sum + item.totalCost, 0);
  const adjustedRepairs = baseRepairs * (1 + repairsAdjustment / 100);

  // ARV source
  const arvSource = (selectedComps.length === 0 || (selectedProperty?.squareFeet || 0) === 0) ? "avm" : "comps";

  // Calculate MAO
  const defaultAssumptions = {
    realtorPct: 0.06,
    closingPct: 0.03,
    holdingPerDay: 50,
    rehabDays: 90,
    profitTargetPct: 0.15,
  };

  const calculateMAO = useCallback(() => {
    if (adjustedARV === 0) return 0;

    const realtorFees = adjustedARV * defaultAssumptions.realtorPct;
    const closingCosts = adjustedARV * defaultAssumptions.closingPct;
    const holdingCosts = defaultAssumptions.holdingPerDay * defaultAssumptions.rehabDays;
    const desiredProfit = adjustedARV * defaultAssumptions.profitTargetPct;

    const calculatedMAO = adjustedARV - adjustedRepairs - realtorFees - closingCosts - holdingCosts - desiredProfit;
    return Math.max(0, calculatedMAO);
  }, [adjustedARV, adjustedRepairs]);

  const mao = calculateMAO();
  const suggestedOffer = Math.max(0, mao * 0.95);

  // Outlier detection
  const compPricesPerSqft = apiComps.filter(c => selectedComps.includes(c.id)).map(c => c.pricePerSqft).filter(p => p > 0);
  const medianPricePerSqft = compPricesPerSqft.length > 0
    ? compPricesPerSqft.sort((a, b) => a - b)[Math.floor(compPricesPerSqft.length / 2)]
    : 0;
  const outlierCompIds = medianPricePerSqft > 0
    ? apiComps
        .filter(c => selectedComps.includes(c.id))
        .filter(c => c.pricePerSqft > medianPricePerSqft * 2 || c.pricePerSqft < medianPricePerSqft * 0.5)
        .map(c => c.id)
    : [];

  // Toggle comp selection
  const toggleCompSelection = (compId: string) => {
    setSelectedComps(prev =>
      prev.includes(compId)
        ? prev.filter(id => id !== compId)
        : [...prev, compId]
    );
  };

  // Add repair item
  const addRepairItem = () => {
    if (!newRepairDescription || newRepairCost <= 0) {
      toast.error('Please enter description and cost');
      return;
    }

    const newItem: RepairItem = {
      id: `REPAIR-${Date.now()}`,
      sessionId: "",
      category: newRepairCategory,
      description: newRepairDescription,
      qty: 1,
      uom: "each",
      unitCost: newRepairCost,
      totalCost: newRepairCost,
      confidence: "medium"
    };

    setRepairItems(prev => [...prev, newItem]);
    setNewRepairDescription("");
    setNewRepairCost(0);
    setShowAddRepair(false);
  };

  // Remove repair item
  const removeRepairItem = (itemId: string) => {
    setRepairItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Save analysis
  const handleSaveAnalysis = async () => {
    if (!selectedPropertyId) {
      toast.error('Please select a property first');
      return;
    }

    try {
      setSavingAnalysis(true);

      const analysisData = {
        propertyId: selectedPropertyId,
        arv: adjustedARV,
        arvMethod: arvMethod,
        compsUsed: apiComps.filter(c => selectedComps.includes(c.id)),
        repairTotal: adjustedRepairs,
        repairItems: repairItems,
        maxOffer: mao,
        offerAmount: suggestedOffer,
        rule: '70%',
        notes: '',
      };

      const response = await fetch('/api/deal-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData),
      });

      if (response.ok) {
        toast.success('Analysis saved successfully!');
      } else {
        throw new Error('Failed to save analysis');
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
      toast.error('Failed to save analysis');
    } finally {
      setSavingAnalysis(false);
    }
  };

  // Open offer dialog
  const handleOpenOfferDialog = () => {
    if (!selectedPropertyId) {
      toast.error('Please select a property first');
      return;
    }

    setOfferAmount(Math.round(suggestedOffer));

    const closingDate = new Date();
    closingDate.setDate(closingDate.getDate() + 45);
    setOfferClosingDate(closingDate.toISOString().split('T')[0]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    setOfferExpiresAt(expiresAt.toISOString().split('T')[0]);

    setOfferEarnestMoney(Math.round(suggestedOffer * 0.01));

    setOfferDialogOpen(true);
  };

  // Create offer
  const handleCreateOffer = async () => {
    if (!selectedPropertyId || !offerAmount || offerAmount <= 0) {
      toast.error('Please enter a valid offer amount');
      return;
    }

    try {
      setCreatingOffer(true);

      const offerData = {
        propertyId: selectedPropertyId,
        amount: offerAmount,
        terms: offerTerms,
        contingencies: offerContingencies,
        closingDate: offerClosingDate || null,
        expiresAt: offerExpiresAt || null,
        earnestMoney: offerEarnestMoney || null,
        notes: offerNotes || null,
      };

      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerData),
      });

      if (response.ok) {
        // Behavioral signal: offer_made is the strongest mid-funnel label
        // before contract_signed. Capture the full deal math at action time
        // so the model can learn "what ARV/repair/margin shape made this
        // user pull the trigger." DO NOT recompute from current state later
        // — sliders move, snapshots are immutable.
        if (selectedProperty) {
          void trackLeadEvent("offer_made", selectedProperty, {
            offerAmount,
            arv: adjustedARV,
            repairs: adjustedRepairs,
            mao,
            suggestedOffer,
            offerVsMao: mao > 0 ? offerAmount / mao : null,
            offerVsArv: adjustedARV > 0 ? offerAmount / adjustedARV : null,
            arvMethod,
            arvSource,
            terms: offerTerms,
            contingencies: offerContingencies,
            earnestMoney: offerEarnestMoney,
          });
        }
        toast.success('Offer created successfully!');
        setOfferDialogOpen(false);
        setOfferNotes("");
        setOfferContingencies(["inspection"]);
        setOfferTerms("cash");
      } else {
        throw new Error('Failed to create offer');
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      toast.error('Failed to create offer');
    } finally {
      setCreatingOffer(false);
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Filter properties
  const filteredProperties = properties.filter(property =>
    property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (property.ownerName && property.ownerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Loading state
  if (loadingProperties) {
    return <UnderwritingSkeleton />;
  }

  // Empty state
  if (properties.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Left Panel - Property Selector */}
      <div className={cn(
        "flex-shrink-0 flex flex-col h-full transition-all duration-300 ease-out",
        leftPanelCollapsed ? "w-14" : "w-80"
      )}>
        <Card className="flex flex-col h-full border-0 shadow-lg py-0 gap-0">
          {/* Header */}
          <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-border">
            <div className="flex items-center justify-between">
              {!leftPanelCollapsed && (
                <h2 className="font-semibold text-gray-900 dark:text-white">Properties</h2>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                className={cn("h-8 w-8", leftPanelCollapsed && "mx-auto")}
              >
                {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>

            {!leftPanelCollapsed && (
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-gray-50 dark:bg-muted border-gray-200 dark:border-border"
                />
              </div>
            )}
          </div>

          {/* Property List */}
          {!leftPanelCollapsed && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {filteredProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isSelected={selectedPropertyId === property.id}
                    onClick={() => {
                      setSelectedPropertyId(property.id);
                      // Behavioral: user explicitly chose to underwrite this
                      // deal. Distinct from a Leads-drawer 'opened' — surface
                      // metadata lets the model weight underwriting-stage
                      // attention higher than scroll-past attention.
                      void trackLeadEvent("opened", property, { surface: "underwriting" });
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Collapsed state - show property count */}
          {leftPanelCollapsed && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{properties.length}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 gap-4">
        {selectedProperty ? (
          <>
            {/* Property Hero + Deal Gauge + Net Sheet Summary */}
            <div className="flex-shrink-0 space-y-4">
              {/* Property Hero Card with Deal Gauge */}
              <Card className="shadow-lg overflow-hidden">
                <div className="flex">
                  {/* Property photo */}
                  <div className="w-48 flex-shrink-0 m-3 mr-0">
                    <div className="relative h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5">
                      <img
                        src="/property-placeholder.jpg"
                        alt={`${selectedProperty.address} exterior`}
                        className="w-full h-full object-cover"
                      />
                      {/* Subtle gradient overlay for depth */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                    </div>
                  </div>

                  <CardContent className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {selectedProperty.address}
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
                          </p>
                        </div>

                        {/* Score badge */}
                        {selectedProperty.score && (
                          <div className={cn(
                            "px-3 py-1.5 rounded-lg font-bold text-sm",
                            selectedProperty.score >= 85 ? "bg-gradient-to-r from-red-500 to-orange-500 text-white" :
                            selectedProperty.score >= 70 ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white" :
                            "bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400"
                          )}>
                            Score: {selectedProperty.score}
                          </div>
                        )}
                      </div>

                      {/* Pipeline stage — property is in Underwriting so show "analyzed" */}
                      <div className="mb-3">
                        <PipelineBreadcrumb
                          currentStage={derivePipelineStage({
                            outreachStatus: selectedProperty.outreachStatus,
                            hasAnalysis: true,
                            hasOffer: false,
                            hasSignedContract: false,
                            isClosed: false,
                          })}
                          variant="compact"
                        />
                      </div>

                      {/* Property details grid */}
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div className="text-center p-2 bg-gray-50 dark:bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                            <BedDouble className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedProperty.bedrooms || '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Beds</span>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                            <Bath className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedProperty.bathrooms || '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Baths</span>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                            <Ruler className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedProperty.squareFeet?.toLocaleString() || '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Sq Ft</span>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedProperty.yearBuilt || '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Built</span>
                        </div>
                      </div>

                      {/* Distress signals */}
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProperty.preForeclosure && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pre-Foreclosure
                          </Badge>
                        )}
                        {selectedProperty.foreclosure && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Foreclosure
                          </Badge>
                        )}
                        {selectedProperty.vacant && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                            <Building className="h-3 w-3 mr-1" />
                            Vacant
                          </Badge>
                        )}
                        {selectedProperty.taxDelinquent && (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Tax Delinquent
                          </Badge>
                        )}
                        {selectedProperty.absenteeOwner && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                            <MapPin className="h-3 w-3 mr-1" />
                            Absentee Owner
                          </Badge>
                        )}
                        {selectedPropertyMetadata.highEquity && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            High Equity
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                  {/* Deal Gauge - inside the same card */}
                  <div className="flex flex-col items-center justify-center px-6 border-l border-gray-100 dark:border-border">
                    <DealGauge
                      value={adjustedARV > 0 ? Math.max(0, adjustedARV - suggestedOffer - adjustedRepairs) : 0}
                      maxValue={adjustedARV * 0.30}
                      label="Deal Score"
                      size={140}
                    />
                    <div className="mt-2 text-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {(() => {
                          const profitMargin = adjustedARV > 0 ? ((adjustedARV - suggestedOffer - adjustedRepairs) / adjustedARV * 100) : 0;
                          if (profitMargin >= 25) return "Excellent Deal";
                          if (profitMargin >= 20) return "Strong Deal";
                          if (profitMargin >= 15) return "Good Deal";
                          if (profitMargin >= 10) return "Fair Deal";
                          return "Needs Work";
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {adjustedARV > 0 ? `${((adjustedARV - suggestedOffer - adjustedRepairs) / adjustedARV * 100).toFixed(1)}% profit margin` : "Add comps to calculate"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Net Sheet Summary - directly under property details */}
              <NetSheetSummary
                arv={adjustedARV}
                repairs={adjustedRepairs}
                mao={mao}
                suggestedOffer={suggestedOffer}
                arvSource={arvSource as "comps" | "avm"}
                onCreateOffer={handleOpenOfferDialog}
                onSaveAnalysis={handleSaveAnalysis}
                saving={savingAnalysis}
              />
            </div>

            {/* Analysis Tabs */}
            <Card className="flex-1 min-h-0 border-0 shadow-lg overflow-hidden py-0 gap-0">
              <Tabs defaultValue="comps" className="flex flex-col h-full">
                <TabsList className="flex-shrink-0 w-full justify-start rounded-none border-b border-gray-200 dark:border-border bg-transparent p-0 px-2">
                  <TabsTrigger
                    value="comps"
                    className="rounded-t-lg border-0 px-5 py-2.5 text-gray-500 dark:text-gray-400 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400 transition-colors"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Comps & ARV
                  </TabsTrigger>
                  <TabsTrigger
                    value="repairs"
                    className="rounded-t-lg border-0 px-5 py-2.5 text-gray-500 dark:text-gray-400 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 dark:data-[state=active]:bg-amber-900/30 dark:data-[state=active]:text-amber-400 transition-colors"
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Repairs
                    {repairItems.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                        {formatCurrency(baseRepairs)}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="mao"
                    className="rounded-t-lg border-0 px-5 py-2.5 text-gray-500 dark:text-gray-400 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-600 dark:data-[state=active]:bg-teal-900/30 dark:data-[state=active]:text-teal-400 transition-colors"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    MAO
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {formatCurrency(mao)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="scenarios"
                    className="rounded-t-lg border-0 px-5 py-2.5 text-gray-500 dark:text-gray-400 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400 transition-colors"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Exit Scenarios
                  </TabsTrigger>
                </TabsList>

                {/* Comps Tab */}
                <TabsContent value="comps" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {/* ARV Method selector */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Comparable Sales</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedComps.length} of {apiComps.length} comps selected
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm text-gray-500">ARV Method:</Label>
                            <Select value={arvMethod} onValueChange={(v) => setArvMethod(v as typeof arvMethod)}>
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weighted">Weighted</SelectItem>
                                <SelectItem value="median">Median</SelectItem>
                                <SelectItem value="knn">k-NN (Top 3)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Separator orientation="vertical" className="h-6" />
                          <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Calculated ARV</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                              {formatCurrency(adjustedARV)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ARV Adjustment slider */}
                      <div className="p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">ARV Adjustment</Label>
                          <span className={cn(
                            "text-sm font-medium tabular-nums",
                            arvAdjustment > 0 ? "text-emerald-600" : arvAdjustment < 0 ? "text-red-600" : "text-gray-600"
                          )}>
                            {arvAdjustment > 0 ? "+" : ""}{arvAdjustment}%
                          </span>
                        </div>
                        <Slider
                          value={[arvAdjustment]}
                          onValueChange={([v]) => setArvAdjustment(v)}
                          min={-20}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Comps grid */}
                      {loadingComps ? (
                        <div className="grid grid-cols-2 gap-3">
                          {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-32 rounded-xl" />
                          ))}
                        </div>
                      ) : apiComps.length === 0 ? (
                        <CompsEmptyState
                          icon={<Search className="h-10 w-10" />}
                          title="No comparable sales found"
                          description="Broaden the search radius, relax bed/bath/sqft filters, or check a wider time window. Real comps in this area will appear here as they come back from the API."
                          actionLabel="Back to Leads"
                          actionHref="/app/leads"
                        />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {apiComps.map(comp => (
                            <CompCard
                              key={comp.id}
                              comp={comp}
                              isSelected={selectedComps.includes(comp.id)}
                              isOutlier={outlierCompIds.includes(comp.id)}
                              onToggle={() => toggleCompSelection(comp.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Repairs Tab */}
                <TabsContent value="repairs" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Repair Estimate</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {repairItems.length} items totaling {formatCurrency(baseRepairs)}
                          </p>
                        </div>
                        <Button onClick={() => setShowAddRepair(true)} size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Item
                        </Button>
                      </div>

                      {/* Repairs adjustment slider */}
                      <div className="p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">Contingency Buffer</Label>
                          <span className={cn(
                            "text-sm font-medium tabular-nums",
                            repairsAdjustment > 0 ? "text-amber-600" : "text-gray-600"
                          )}>
                            +{repairsAdjustment}%
                          </span>
                        </div>
                        <Slider
                          value={[repairsAdjustment]}
                          onValueChange={([v]) => setRepairsAdjustment(v)}
                          min={0}
                          max={30}
                          step={5}
                          className="w-full"
                        />
                      </div>

                      {/* Repair items list */}
                      {repairItems.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center">
                            <Wrench className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400">No repair items added</p>
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            Click "Add Item" to start building your repair estimate
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {repairItems.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-3 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border"
                            >
                              <RepairCategoryIcon category={item.category} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                  {item.description}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {getCategoryLabel(item.category)}
                                </p>
                              </div>
                              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(item.totalCost)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-500"
                                onClick={() => removeRepairItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}

                          {/* Total with contingency */}
                          {repairsAdjustment > 0 && (
                            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                Total with {repairsAdjustment}% contingency
                              </span>
                              <span className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                                {formatCurrency(adjustedRepairs)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Scenarios Tab */}
                <TabsContent value="scenarios" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Exit Strategy Comparison</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Compare potential returns across different strategies
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <ScenarioCard
                          strategy="wholesale"
                          purchasePrice={suggestedOffer}
                          arv={adjustedARV}
                          repairs={adjustedRepairs}
                        />
                        <ScenarioCard
                          strategy="flip"
                          purchasePrice={suggestedOffer}
                          arv={adjustedARV}
                          repairs={adjustedRepairs}
                          isRecommended={adjustedRepairs > 0}
                        />
                        <ScenarioCard
                          strategy="rental"
                          purchasePrice={suggestedOffer}
                          arv={adjustedARV}
                          repairs={adjustedRepairs}
                        />
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* MAO Tab */}
                <TabsContent value="mao" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <MAOWaterfallPanel
                        arv={adjustedARV}
                        repairs={adjustedRepairs}
                      />
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Select a property to begin analysis</p>
          </div>
        )}
      </div>

      {/* Add Repair Dialog */}
      <Dialog open={showAddRepair} onOpenChange={setShowAddRepair}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Repair Item</DialogTitle>
            <DialogDescription>
              Enter the repair details below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newRepairCategory} onValueChange={setNewRepairCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roof">Roof</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="bath">Bathroom</SelectItem>
                  <SelectItem value="flooring">Flooring</SelectItem>
                  <SelectItem value="paint">Paint</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="exterior">Exterior</SelectItem>
                  <SelectItem value="foundation">Foundation</SelectItem>
                  <SelectItem value="landscaping">Landscaping</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="e.g., Replace shingle roof"
                value={newRepairDescription}
                onChange={(e) => setNewRepairDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Estimated Cost</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="0"
                  value={newRepairCost || ""}
                  onChange={(e) => setNewRepairCost(Number(e.target.value))}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRepair(false)}>
              Cancel
            </Button>
            <Button onClick={addRepairItem}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Offer Dialog */}
      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Offer</DialogTitle>
            <DialogDescription>
              Submit an offer for {selectedProperty?.address}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Offer Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    value={offerAmount || ""}
                    onChange={(e) => setOfferAmount(Number(e.target.value))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Earnest Money</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    value={offerEarnestMoney || ""}
                    onChange={(e) => setOfferEarnestMoney(Number(e.target.value))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Terms</Label>
              <Select value={offerTerms} onValueChange={setOfferTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="conventional">Conventional Financing</SelectItem>
                  <SelectItem value="hard_money">Hard Money</SelectItem>
                  <SelectItem value="seller_financing">Seller Financing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Closing Date</Label>
                <Input
                  type="date"
                  value={offerClosingDate}
                  onChange={(e) => setOfferClosingDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Offer Expires</Label>
                <Input
                  type="date"
                  value={offerExpiresAt}
                  onChange={(e) => setOfferExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contingencies</Label>
              <div className="flex flex-wrap gap-2">
                {["inspection", "appraisal", "financing", "title"].map(contingency => (
                  <label
                    key={contingency}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors",
                      offerContingencies.includes(contingency)
                        ? "bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                        : "border-gray-200 dark:border-border hover:border-gray-300"
                    )}
                  >
                    <Checkbox
                      checked={offerContingencies.includes(contingency)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setOfferContingencies([...offerContingencies, contingency]);
                        } else {
                          setOfferContingencies(offerContingencies.filter(c => c !== contingency));
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{contingency}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional terms or notes..."
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOffer} disabled={creatingOffer}>
              {creatingOffer ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Offer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
