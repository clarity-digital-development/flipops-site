"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  DollarSign,
  FileText,
  MessageSquare,
  CheckCircle,
  Upload,
  Send,
  Building,
  HardHat,
  Droplet,
  Zap,
  Wind,
  Trees,
  Paintbrush,
  Square,
  Home,
  Users,
  Briefcase,
  RefreshCw,
  LayoutGrid,
  List,
  Wrench,
  CircleDollarSign,
  BadgeCheck,
  Hammer,
  Heart,
  UserPlus,
  Lock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  type Vendor,
  type Project,
  vendors as demoVendors,
  projects as demoProjects,
} from "./seed-data";

// Use real API data — seed data is no longer used.
// Per the platform UX walkthrough (2026-06-04), the seed-data fallback was
// hard-locking every user to 12 AZ contractors regardless of their actual
// vendor network. /api/vendors/my returns the user's real vendors.
const USE_DEMO_DATA = false;

// ============================================================================
// TRADE CONFIGURATION (matches VendorCategory enum)
// ============================================================================

const TRADE_CONFIG: Record<string, { label: string; color: string; gradient: string; icon: any }> = {
  // Primary trades
  GENERAL_CONTRACTOR: { label: "General Contractor", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400", gradient: "from-slate-400 to-slate-500", icon: HardHat },
  ROOFER: { label: "Roofing", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", gradient: "from-orange-400 to-orange-500", icon: Home },
  PLUMBER: { label: "Plumbing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", gradient: "from-blue-400 to-blue-500", icon: Droplet },
  ELECTRICIAN: { label: "Electrical", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", gradient: "from-yellow-400 to-yellow-500", icon: Zap },
  HVAC: { label: "HVAC", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", gradient: "from-teal-400 to-teal-500", icon: Wind },
  FLOORING: { label: "Flooring", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", gradient: "from-emerald-400 to-emerald-500", icon: Square },
  PAINTER: { label: "Painting", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", gradient: "from-violet-400 to-violet-500", icon: Paintbrush },
  LANDSCAPER: { label: "Landscaping", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", gradient: "from-green-400 to-green-500", icon: Trees },
  // Other trades
  DEMOLITION: { label: "Demolition", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", gradient: "from-red-400 to-red-500", icon: Hammer },
  FRAMING: { label: "Framing", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", gradient: "from-amber-400 to-amber-500", icon: Building },
  DUMPSTER_RENTAL: { label: "Dumpster", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400", gradient: "from-zinc-400 to-zinc-500", icon: Building },
  LOCKSMITH: { label: "Locksmith", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", gradient: "from-gray-400 to-gray-500", icon: Wrench },
  CLEANING_SERVICE: { label: "Cleaning", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", gradient: "from-cyan-400 to-cyan-500", icon: Sparkles },
  HOME_INSPECTOR: { label: "Inspector", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", gradient: "from-indigo-400 to-indigo-500", icon: Search },
  APPRAISER: { label: "Appraiser", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", gradient: "from-purple-400 to-purple-500", icon: DollarSign },
  SIDING: { label: "Siding", color: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400", gradient: "from-stone-400 to-stone-500", icon: Building },
  WINDOWS: { label: "Windows", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", gradient: "from-sky-400 to-sky-500", icon: Square },
  INSULATION: { label: "Insulation", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", gradient: "from-pink-400 to-pink-500", icon: Building },
  DRYWALL: { label: "Drywall", color: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400", gradient: "from-neutral-400 to-neutral-500", icon: Square },
  KITCHEN: { label: "Kitchen", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", gradient: "from-rose-400 to-rose-500", icon: Home },
  BATHROOM: { label: "Bathroom", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", gradient: "from-blue-400 to-blue-500", icon: Droplet },
  FENCING: { label: "Fencing", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400", gradient: "from-lime-400 to-lime-500", icon: Square },
  CONCRETE: { label: "Concrete", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400", gradient: "from-slate-400 to-slate-500", icon: Square },
  POOL: { label: "Pool", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", gradient: "from-cyan-400 to-cyan-500", icon: Droplet },
  PEST_CONTROL: { label: "Pest Control", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", gradient: "from-amber-400 to-amber-500", icon: Wrench },
  GARAGE_DOOR: { label: "Garage Door", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400", gradient: "from-zinc-400 to-zinc-500", icon: Building },
  APPLIANCE_REPAIR: { label: "Appliance", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", gradient: "from-indigo-400 to-indigo-500", icon: Wrench },
  OTHER: { label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", gradient: "from-gray-400 to-gray-500", icon: Wrench },
  // Legacy lowercase mappings for backward compatibility
  roofing: { label: "Roofing", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", gradient: "from-orange-400 to-orange-500", icon: Home },
  plumbing: { label: "Plumbing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", gradient: "from-blue-400 to-blue-500", icon: Droplet },
  electrical: { label: "Electrical", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", gradient: "from-yellow-400 to-yellow-500", icon: Zap },
  hvac: { label: "HVAC", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", gradient: "from-teal-400 to-teal-500", icon: Wind },
  landscaping: { label: "Landscaping", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", gradient: "from-green-400 to-green-500", icon: Trees },
  'general-contractor': { label: "General", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400", gradient: "from-slate-400 to-slate-500", icon: HardHat },
  painting: { label: "Painting", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", gradient: "from-violet-400 to-violet-500", icon: Paintbrush },
  flooring: { label: "Flooring", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", gradient: "from-emerald-400 to-emerald-500", icon: Square },
  demolition: { label: "Demolition", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", gradient: "from-red-400 to-red-500", icon: Hammer },
  framing: { label: "Framing", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", gradient: "from-amber-400 to-amber-500", icon: Building },
};

// Primary categories for filter dropdown
const PRIMARY_CATEGORIES = [
  'GENERAL_CONTRACTOR', 'ROOFER', 'PLUMBER', 'ELECTRICIAN',
  'HVAC', 'FLOORING', 'PAINTER', 'LANDSCAPER'
];

// Helper to get trade config
const getTradeConfig = (trade: string | undefined) => {
  if (!trade) return TRADE_CONFIG['GENERAL_CONTRACTOR'];
  // Try direct match first (for enum values like ROOFER)
  if (TRADE_CONFIG[trade]) return TRADE_CONFIG[trade];
  // Try lowercase/normalized version
  const key = trade.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  return TRADE_CONFIG[key] || TRADE_CONFIG['GENERAL_CONTRACTOR'];
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Response from /api/vendors/my endpoint
interface MyVendorResponse {
  id: string;
  type: 'user_vendor' | 'platform_vendor';
  name: string;
  description?: string | null;
  categories: string[];
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  personalRating?: number | null;
  sourceRating?: number | null;
  sourceReviewCount?: number | null;
  isFavorite: boolean;
  isPreferred: boolean;
  notes?: string | null;
  tags: string[];
  status: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

// Response from /api/vendors/platform endpoint
interface PlatformVendorResponse {
  id: string;
  name: string;
  description?: string | null;
  categories: string[];
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  sourceRating?: number | null;
  sourceReviewCount?: number | null;
  priceLevel?: number | null;
  status: string;
  source: string;
  googlePlaceId?: string | null;
  isInMyList: boolean;
}

// ============================================================================
// STAT CHIP COMPONENT
// ============================================================================

interface StatChipProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive?: boolean };
  color?: "blue" | "emerald" | "purple" | "amber" | "rose" | "teal" | "default";
  highlight?: boolean;
}

function StatChip({ label, value, subValue, icon, trend, color = "default", highlight = false }: StatChipProps) {
  const colorMap = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5",
    teal: "border-teal-200/50 dark:border-teal-800/50 bg-teal-500/5",
    default: "border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-500/5",
  };

  const iconColorMap = {
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    purple: "text-purple-600 dark:text-purple-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    teal: "text-teal-600 dark:text-teal-400",
    default: "text-zinc-600 dark:text-zinc-400",
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-xl border shrink-0",
      colorMap[color],
      highlight && "ring-2 ring-offset-2 ring-offset-background ring-amber-500/50"
    )}>
      <div className={cn("shrink-0", iconColorMap[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-foreground tabular-nums leading-tight">
            {value}
          </p>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
          {trend && (
            <span className={cn(
              "text-xs font-medium flex items-center gap-0.5",
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RELIABILITY GAUGE COMPONENT
// ============================================================================

interface ReliabilityGaugeProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
}

function ReliabilityGauge({ percentage, size = "md" }: ReliabilityGaugeProps) {
  const sizeConfig = {
    sm: { width: 40, stroke: 4, fontSize: "text-[10px]" },
    md: { width: 56, stroke: 5, fontSize: "text-xs" },
    lg: { width: 72, stroke: 6, fontSize: "text-sm" },
  };

  const { width, stroke, fontSize } = sizeConfig[size];
  const radius = (width - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Color coding based on reliability
  let color = "stroke-rose-500";
  let bgColor = "stroke-rose-100 dark:stroke-rose-900/30";
  if (percentage >= 90) {
    color = "stroke-emerald-500";
    bgColor = "stroke-emerald-100 dark:stroke-emerald-900/30";
  } else if (percentage >= 75) {
    color = "stroke-amber-500";
    bgColor = "stroke-amber-100 dark:stroke-amber-900/30";
  } else if (percentage >= 50) {
    color = "stroke-orange-500";
    bgColor = "stroke-orange-100 dark:stroke-orange-900/30";
  }

  return (
    <div className="relative" style={{ width, height: width }}>
      <svg width={width} height={width} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={bgColor}
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(color, "transition-all duration-500")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(fontSize, "font-bold tabular-nums text-foreground")}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// VENDOR CARD COMPONENT
// ============================================================================

interface VendorCardProps {
  vendor: Vendor;
  isSelected: boolean;
  onClick: () => void;
  viewMode: "grid" | "list";
}

function VendorCard({ vendor, isSelected, onClick, viewMode }: VendorCardProps) {
  const primaryTrade = vendor.categories[0];
  const tradeConfig = getTradeConfig(primaryTrade);
  const TradeIcon = tradeConfig.icon;

  // Get availability badge config
  const availabilityConfig = {
    available: { label: "Available", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    limited: { label: "Limited", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    booked: { label: "Booked", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    unknown: { label: "Unknown", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
  };
  const availability = availabilityConfig[vendor.availabilityStatus || 'unknown'];

  // Compute reliability from API data or fallback
  const reliability = Math.round((vendor.ratingAvg / 5) * 100);

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-4 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-all hover:bg-muted/50",
          isSelected && "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500"
        )}
      >
        {/* Trade color bar */}
        <div className={cn("w-1 h-10 rounded-full bg-gradient-to-b shrink-0", tradeConfig.gradient)} />

        {/* Trade icon */}
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", tradeConfig.color)}>
          <TradeIcon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
            {vendor.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{vendor.locationCity}, {vendor.locationState}</span>
            {vendor.hourlyRateMin && vendor.hourlyRateMax && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>${vendor.hourlyRateMin}-${vendor.hourlyRateMax}/hr</span>
              </>
            )}
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-sm font-medium tabular-nums">
            {vendor.ratingAvg > 0 ? vendor.ratingAvg.toFixed(1) : "N/A"}
          </span>
        </div>

        {/* Reliability gauge */}
        <div className="shrink-0 w-10 flex justify-center">
          <ReliabilityGauge percentage={reliability} size="sm" />
        </div>

        {/* Availability badge */}
        <Badge className={cn("shrink-0 w-20 justify-center", availability.className)}>
          {availability.label}
        </Badge>
      </div>
    );
  }

  // Grid view card
  return (
    <Card
      onClick={onClick}
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
        isSelected && "ring-2 ring-blue-500"
      )}
    >
      {/* Trade-colored gradient bar */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", tradeConfig.gradient)} />

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", tradeConfig.color)}>
              <TradeIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{vendor.name}</h3>
                {vendor.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{vendor.locationCity}, {vendor.locationState}</span>
              </div>
            </div>
          </div>
          <ReliabilityGauge percentage={reliability} size="md" />
        </div>

        {/* Trade badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {vendor.categories.slice(0, 3).map(cat => {
            const config = getTradeConfig(cat);
            return (
              <Badge key={cat} variant="outline" className={cn("text-xs capitalize", config.color)}>
                {config.label}
              </Badge>
            );
          })}
          {vendor.categories.length > 3 && (
            <Badge variant="outline" className="text-xs">+{vendor.categories.length - 3}</Badge>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-b">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="font-bold tabular-nums">
                {vendor.ratingAvg > 0 ? vendor.ratingAvg.toFixed(1) : "N/A"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Rating</p>
          </div>
          <div className="text-center border-x">
            <span className="font-bold tabular-nums text-foreground">{vendor.ratingCount}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Reviews</p>
          </div>
          <div className="text-center">
            {vendor.hourlyRateMin ? (
              <span className="font-bold tabular-nums text-foreground">${vendor.hourlyRateMin}+</span>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Rate</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <Badge className={availability.className}>
            {availability.label}
          </Badge>
          <div className="flex items-center gap-1">
            {vendor.email && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); }}>
                <Mail className="h-4 w-4" />
              </Button>
            )}
            {vendor.phone && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); }}>
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// VENDOR CARD SKELETON
// ============================================================================

function VendorCardSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        <Skeleton className="w-1 h-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-1.5 w-full" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
        <div className="flex gap-1.5 mb-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-b">
          <Skeleton className="h-8 mx-auto w-12" />
          <Skeleton className="h-8 mx-auto w-12" />
          <Skeleton className="h-8 mx-auto w-12" />
        </div>
        <div className="flex items-center justify-between mt-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// VENDOR DETAIL SHEET
// ============================================================================

interface VendorDetailSheetProps {
  vendor: Vendor | null;
  open: boolean;
  onClose: () => void;
  onMessage: () => void;
  onContract: () => void;
  onInvoice: () => void;
}

function VendorDetailSheet({ vendor, open, onClose, onMessage, onContract, onInvoice }: VendorDetailSheetProps) {
  const [detailTab, setDetailTab] = useState("overview");
  const { toast } = useToast();

  if (!vendor) return null;

  const primaryTrade = vendor.categories[0];
  const tradeConfig = getTradeConfig(primaryTrade);
  const TradeIcon = tradeConfig.icon;
  const reliability = Math.round((vendor.ratingAvg / 5) * 100);

  // Availability config
  const availabilityConfig = {
    available: { label: "Available", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    limited: { label: "Limited", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    booked: { label: "Booked", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    unknown: { label: "Unknown", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
  };
  const availability = availabilityConfig[vendor.availabilityStatus || 'unknown'];

  // Render star rating
  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"
          )}
        />
      ))}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[486px] p-0 flex flex-col bg-white dark:bg-gray-900">
        <VisuallyHidden>
          <SheetTitle>Vendor Details: {vendor.name}</SheetTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="shrink-0 p-6 border-b bg-muted/30">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg", tradeConfig.color)}>
                <TradeIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{vendor.name}</h2>
                  {vendor.isVerified && (
                    <Badge variant="secondary" className="gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{vendor.locationCity}, {vendor.locationState}</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {renderStars(vendor.ratingAvg)}
                  <span className="text-sm text-muted-foreground">({vendor.ratingCount} reviews)</span>
                </div>
              </div>
            </div>
            <ReliabilityGauge percentage={reliability} size="lg" />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="text-center p-2 rounded-lg bg-background border">
              <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{vendor.ratingAvg > 0 ? vendor.ratingAvg.toFixed(1) : "N/A"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Rating</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background border">
              <span className="font-bold text-foreground">{vendor.ratingCount}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Reviews</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background border">
              <span className="font-bold text-foreground">
                {vendor.hourlyRateMin ? `$${vendor.hourlyRateMin}` : "-"}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Min Rate</p>
            </div>
            <div className={cn("text-center p-2 rounded-lg border", availability.className)}>
              <span className="font-bold">{availability.label}</span>
              <p className="text-[10px] opacity-70 mt-0.5">Status</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start shrink-0 rounded-none border-b px-6 bg-transparent">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 dark:data-[state=active]:bg-blue-900/30">
              Overview
            </TabsTrigger>
            <TabsTrigger value="reviews" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 dark:data-[state=active]:bg-amber-900/30">
              Reviews
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-900/30">
              Projects
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-violet-50 data-[state=active]:text-violet-600 dark:data-[state=active]:bg-violet-900/30">
              Documents
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Overview Tab */}
                {detailTab === "overview" && (
                  <>
                    {/* Contact Info */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-foreground">Contact Information</h3>
                      <div className="space-y-3">
                        {vendor.phone && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <p className="font-medium text-foreground">{vendor.phone}</p>
                            </div>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium text-foreground">{vendor.email}</p>
                            </div>
                          </div>
                        )}
                        {vendor.website && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Website</p>
                              <a href={vendor.website} className="font-medium text-blue-600 hover:underline">{vendor.website}</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Services */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-foreground">Services & Trades</h3>
                      <div className="flex flex-wrap gap-2">
                        {vendor.categories.map(cat => {
                          const config = getTradeConfig(cat);
                          return (
                            <Badge key={cat} className={cn("gap-1.5", config.color)}>
                              <config.icon className="h-3.5 w-3.5" />
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rates */}
                    {(vendor.hourlyRateMin || vendor.hourlyRateMax) && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-foreground">Rates</h3>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200/50 dark:border-amber-800/50">
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <span className="text-xl font-bold text-foreground">
                              ${vendor.hourlyRateMin} - ${vendor.hourlyRateMax}
                            </span>
                            <span className="text-muted-foreground">/hr</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {vendor.description && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-foreground">About</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{vendor.description}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {vendor.tags.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-foreground">Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {vendor.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Reviews Tab */}
                {detailTab === "reviews" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No reviews yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                      Reviews will appear here after completing projects with this vendor
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => toast({ title: "Request Review", description: "Review request functionality coming soon" })}>
                      Request Review
                    </Button>
                  </div>
                )}

                {/* Projects Tab */}
                {detailTab === "projects" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
                      <Briefcase className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                      Invite this vendor to a renovation project to get started
                    </p>
                    <Button className="mt-4" onClick={() => toast({ title: "Invite to Project", description: "Navigate to Renovations to invite this vendor" })}>
                      <Plus className="h-4 w-4 mr-2" />
                      Invite to Project
                    </Button>
                  </div>
                )}

                {/* Documents Tab */}
                {detailTab === "documents" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No documents uploaded</h3>
                    <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                      Upload insurance certificates, licenses, and W-9 forms
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => toast({ title: "Upload Document", description: "Document upload functionality coming soon" })}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>

        {/* Footer actions */}
        <div className="shrink-0 border-t p-4 space-y-2 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={onMessage} className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>
            <Button variant="outline" onClick={onContract} className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Contract
            </Button>
            <Button variant="outline" onClick={onInvoice} className="flex-1">
              <DollarSign className="h-4 w-4 mr-2" />
              Invoice
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

// Tier checking for premium features (placeholder - will integrate with subscription system)
const PREMIUM_TIERS = ['SCALE', 'ACCELERATOR', 'PARTNER'];
const hasPremiumAccess = (tier?: string) => PREMIUM_TIERS.includes(tier?.toUpperCase() || '');

export default function VendorsPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Tab state for My Vendors vs Find Vendors
  const [activeTab, setActiveTab] = useState<"my" | "find">("my");

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Modal states
  const [showContractModal, setShowContractModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);

  // API state for My Vendors
  const [myVendors, setMyVendors] = useState<MyVendorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  // API state for Platform Vendors (Find Vendors tab)
  const [platformVendors, setPlatformVendors] = useState<PlatformVendorResponse[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformSearchQuery, setPlatformSearchQuery] = useState("");
  const [platformCategory, setPlatformCategory] = useState<string>("all");
  const [markets, setMarkets] = useState<{ id: string; name: string; city: string; state: string }[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("all");

  // User tier state (placeholder - will come from user profile)
  const [userTier, setUserTier] = useState<string>("SCALE"); // Temporarily enabled for testing

  // Messaging state
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Add Vendor state
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    categories: [] as string[],
    notes: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Convert API response to Vendor format for compatibility with existing components
  const convertMyVendorToVendor = useCallback((v: MyVendorResponse): Vendor => ({
    id: v.id,
    name: v.name,
    categories: v.categories.map(c => c.toLowerCase().replace(/_/g, '-')),
    phone: v.phone || "",
    email: v.email || "",
    website: v.website || undefined,
    locationCity: v.city || "",
    locationState: v.state || "",
    zip: v.zip || "",
    description: v.description || "",
    ratingAvg: v.personalRating || v.sourceRating || 0,
    ratingCount: v.sourceReviewCount || 0,
    isVerified: v.type === 'platform_vendor',
    availabilityStatus: 'available',
    currency: "USD",
    tags: v.tags || [],
    createdAt: new Date(v.createdAt),
    updatedAt: new Date(v.createdAt),
    // Extended properties for UI
    isFavorite: v.isFavorite,
    isPreferred: v.isPreferred,
    vendorType: v.type,
  }), []);

  const convertPlatformVendorToVendor = useCallback((v: PlatformVendorResponse): Vendor => ({
    id: v.id,
    name: v.name,
    categories: v.categories.map(c => c.toLowerCase().replace(/_/g, '-')),
    phone: v.phone || "",
    email: v.email || "",
    website: v.website || undefined,
    locationCity: v.city || "",
    locationState: v.state || "",
    zip: v.zip || "",
    description: v.description || "",
    ratingAvg: v.sourceRating || 0,
    ratingCount: v.sourceReviewCount || 0,
    isVerified: true,
    availabilityStatus: 'available',
    currency: "USD",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // Extended properties
    isInMyList: v.isInMyList,
    vendorType: 'platform_vendor',
    googlePlaceId: v.googlePlaceId,
  }), []);

  // Fetch my vendors from new API (or use demo data)
  const fetchMyVendors = useCallback(async () => {
    if (USE_DEMO_DATA) {
      // Use demo data - skip API call
      setLoading(false);
      setProjects(demoProjects);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategories.length > 0) {
        params.set('category', selectedCategories[0]);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (showFavoritesOnly) {
        params.set('favorites', 'true');
      }

      const response = await fetch(`/api/vendors/my?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMyVendors(data.vendors || []);
      } else {
        console.warn('Failed to fetch vendors');
        setMyVendors([]);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setMyVendors([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, searchQuery, showFavoritesOnly]);

  // Fetch platform vendors for Find tab
  const fetchPlatformVendors = useCallback(async () => {
    if (!hasPremiumAccess(userTier)) return;

    try {
      setPlatformLoading(true);
      const params = new URLSearchParams();
      if (selectedMarket !== 'all') {
        params.set('marketId', selectedMarket);
      }
      if (platformCategory !== 'all') {
        params.set('category', platformCategory);
      }
      if (platformSearchQuery) {
        params.set('search', platformSearchQuery);
      }
      if (minRating > 0) {
        params.set('minRating', minRating.toString());
      }

      const response = await fetch(`/api/vendors/platform?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPlatformVendors(data.vendors || []);
      } else {
        console.warn('Failed to fetch platform vendors');
        setPlatformVendors([]);
      }
    } catch (error) {
      console.error('Error fetching platform vendors:', error);
      setPlatformVendors([]);
    } finally {
      setPlatformLoading(false);
    }
  }, [userTier, selectedMarket, platformCategory, platformSearchQuery, minRating]);

  // Fetch markets for the filter dropdown
  const fetchMarkets = useCallback(async () => {
    try {
      const response = await fetch('/api/markets');
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || []);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  }, []);

  // Add platform vendor to my list
  const addPlatformVendorToMyList = async (platformVendorId: string) => {
    try {
      const response = await fetch('/api/vendors/my/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformVendorId }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Vendor added to your list" });
        // Refresh both lists
        fetchMyVendors();
        fetchPlatformVendors();
      } else if (response.status === 409) {
        toast({ title: "Already Added", description: "This vendor is already in your list" });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to add vendor", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast({ title: "Error", description: "Failed to add vendor", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchMyVendors();
      fetchMarkets();
    }
  }, [mounted, fetchMyVendors, fetchMarkets]);

  // Refetch when tab changes
  useEffect(() => {
    if (mounted && activeTab === 'find' && hasPremiumAccess(userTier)) {
      fetchPlatformVendors();
    }
  }, [mounted, activeTab, userTier, fetchPlatformVendors]);

  // Refetch my vendors when filters change
  useEffect(() => {
    if (mounted && activeTab === 'my') {
      fetchMyVendors();
    }
  }, [mounted, activeTab, selectedCategories, searchQuery, showFavoritesOnly, fetchMyVendors]);

  // Get effective vendors list for My Vendors tab
  const effectiveVendors = useMemo(() => {
    if (USE_DEMO_DATA) {
      // Use demo vendors directly
      return demoVendors;
    }
    return myVendors.map(convertMyVendorToVendor);
  }, [myVendors, convertMyVendorToVendor]);

  // Get platform vendors for Find tab
  const effectivePlatformVendors = useMemo(() => {
    return platformVendors.map(convertPlatformVendorToVendor);
  }, [platformVendors, convertPlatformVendorToVendor]);

  // Filter vendors (additional client-side filtering)
  const filteredVendors = useMemo(() => {
    return effectiveVendors.filter(vendor => {
      const matchesRating = vendor.ratingAvg >= minRating;
      const matchesCity = selectedCity === "all" || vendor.locationCity === selectedCity;
      const matchesAvailability = selectedAvailability === "all" ||
        vendor.availabilityStatus === selectedAvailability;
      return matchesRating && matchesCity && matchesAvailability;
    });
  }, [effectiveVendors, minRating, selectedCity, selectedAvailability]);

  // Get unique cities from my vendors
  const uniqueCities = useMemo(() => {
    return Array.from(new Set(effectiveVendors.map(v => v.locationCity).filter(Boolean)));
  }, [effectiveVendors]);

  // Compute stats for My Vendors
  const stats = useMemo(() => {
    const total = effectiveVendors.length;
    const verified = effectiveVendors.filter(v => v.isVerified).length;
    const favorites = myVendors.filter(v => v.isFavorite).length;
    const avgRating = effectiveVendors.length > 0
      ? effectiveVendors.reduce((sum, v) => sum + (v.ratingAvg || 0), 0) / effectiveVendors.length
      : 0;
    const tradeCount = new Set(effectiveVendors.flatMap(v => v.categories)).size;
    return { total, verified, favorites, avgRating, tradeCount };
  }, [effectiveVendors, myVendors]);

  // Handle adding a new private vendor
  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) {
      toast({ title: "Error", description: "Vendor name is required", variant: "destructive" });
      return;
    }
    if (newVendor.categories.length === 0) {
      toast({ title: "Error", description: "Please select at least one category", variant: "destructive" });
      return;
    }

    setAddingVendor(true);
    try {
      const response = await fetch('/api/vendors/my/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVendor.name.trim(),
          email: newVendor.email.trim() || undefined,
          phone: newVendor.phone.trim() || undefined,
          website: newVendor.website.trim() || undefined,
          address: newVendor.address.trim() || undefined,
          city: newVendor.city.trim() || undefined,
          state: newVendor.state.trim() || undefined,
          zip: newVendor.zip.trim() || undefined,
          categories: newVendor.categories,
          notes: newVendor.notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Vendor added successfully" });
        setShowAddVendorModal(false);
        setNewVendor({ name: "", email: "", phone: "", website: "", address: "", city: "", state: "", zip: "", categories: [], notes: "" });
        await fetchMyVendors();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to add vendor", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast({ title: "Error", description: "Failed to add vendor", variant: "destructive" });
    } finally {
      setAddingVendor(false);
    }
  };

  // Toggle category for new vendor
  const toggleCategory = (category: string) => {
    setNewVendor(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!selectedVendor?.email || !messageBody.trim()) {
      toast({ title: "Error", description: "Please enter a message", variant: "destructive" });
      return;
    }

    setSendingMessage(true);
    try {
      const signatureEnabled = localStorage.getItem('emailSignatureEnabled') === 'true';
      const senderName = localStorage.getItem('emailSenderName') || '';
      const companyName = localStorage.getItem('emailCompanyName') || '';
      const customSignature = localStorage.getItem('emailSignature') || '';

      let emailBody = messageBody;
      if (signatureEnabled && (senderName || companyName || customSignature)) {
        emailBody += '\n\n---\n';
        if (customSignature) {
          emailBody += customSignature;
        } else {
          if (senderName) emailBody += senderName + '\n';
          if (companyName) emailBody += companyName;
        }
      }

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [{ email: selectedVendor.email, name: selectedVendor.name }],
          subject: messageSubject || `Message from FlipOps`,
          body: emailBody,
        }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Message sent successfully" });
        setMessageSubject("");
        setMessageBody("");
        setShowMessageModal(false);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to send message", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  // Open message modal
  const openMessageModal = () => {
    if (!selectedVendor?.email) {
      toast({ title: "Error", description: "This vendor doesn't have an email address", variant: "destructive" });
      return;
    }
    setMessageSubject("");
    setMessageBody("");
    setShowMessageModal(true);
  };

  // Loading state
  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendors</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your trusted bench of contractors, inspectors, and trades — ranked by reliability and ready to bid.
              </p>
            </div>
            <Button onClick={() => setShowAddVendorModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="shrink-0 border-b px-6 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <StatChip
              label="Total Vendors"
              value={stats.total}
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
            <StatChip
              label="Verified"
              value={stats.verified}
              subValue={stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}%` : undefined}
              icon={<BadgeCheck className="h-5 w-5" />}
              color="emerald"
            />
            <StatChip
              label="Favorites"
              value={stats.favorites}
              icon={<Heart className="h-5 w-5" />}
              color="rose"
            />
            <StatChip
              label="Avg Rating"
              value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"}
              icon={<Star className="h-5 w-5" />}
              color="amber"
            />
            <StatChip
              label="Trade Types"
              value={stats.tradeCount}
              icon={<Wrench className="h-5 w-5" />}
              color="purple"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="shrink-0 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {(selectedCategories.length > 0 || minRating > 0 || selectedCity !== "all" || selectedAvailability !== "all") && (
                    <Badge variant="secondary" className="ml-2">
                      {[selectedCategories.length, minRating > 0 ? 1 : 0, selectedCity !== "all" ? 1 : 0, selectedAvailability !== "all" ? 1 : 0].filter(Boolean).reduce((a, b) => a + b, 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="p-2">
                  <Label className="text-xs font-medium">Categories</Label>
                  {Object.entries(TRADE_CONFIG).slice(0, 6).map(([key, config]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={selectedCategories.includes(key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, key]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== key));
                        }
                      }}
                    >
                      {config.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Label className="text-xs font-medium">Min Rating</Label>
                  <Select value={minRating.toString()} onValueChange={(value) => setMinRating(Number(value))}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Ratings</SelectItem>
                      <SelectItem value="4">4+ Stars</SelectItem>
                      <SelectItem value="4.5">4.5+ Stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Label className="text-xs font-medium">Availability</Label>
                  <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* View toggle */}
            <div className="flex rounded-lg border p-0.5 bg-muted/50">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2.5", viewMode === "grid" && "bg-background shadow-sm")}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2.5", viewMode === "list" && "bg-background shadow-sm")}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            {loading ? (
              // Loading skeleton
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {[...Array(6)].map((_, i) => (
                    <VendorCardSkeleton key={i} viewMode="grid" />
                  ))}
                </div>
              ) : (
                <div>
                  {[...Array(8)].map((_, i) => (
                    <VendorCardSkeleton key={i} viewMode="list" />
                  ))}
                </div>
              )
            ) : effectiveVendors.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center mb-6">
                  <Building className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No vendors yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Add your first contractor or service provider to start building your vendor network
                </p>
                <Button onClick={() => setShowAddVendorModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Vendor
                </Button>
              </div>
            ) : filteredVendors.length === 0 ? (
              // No results
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No vendors found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : viewMode === "grid" ? (
              // Grid view
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {filteredVendors.map(vendor => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    isSelected={selectedVendor?.id === vendor.id}
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setDetailSheetOpen(true);
                    }}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              // List view
              <div>
                {filteredVendors.map(vendor => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    isSelected={selectedVendor?.id === vendor.id}
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setDetailSheetOpen(true);
                    }}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Status bar */}
        <div className="shrink-0 border-t px-6 py-1.5 text-xs text-muted-foreground">
          Showing {filteredVendors.length} of {effectiveVendors.length} vendors
        </div>
      </div>

      {/* Vendor Detail Sheet */}
      <VendorDetailSheet
        vendor={selectedVendor}
        open={detailSheetOpen}
        onClose={() => setDetailSheetOpen(false)}
        onMessage={openMessageModal}
        onContract={() => setShowContractModal(true)}
        onInvoice={() => setShowInvoiceModal(true)}
      />

      {/* Contract Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>
              Generate a contract for {selectedVendor?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="none" disabled>No projects available</SelectItem>
                  ) : (
                    projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract Amount</Label>
              <Input type="number" placeholder="Enter amount" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast({ title: "Success", description: "Contract created and sent for signature" });
              setShowContractModal(false);
            }}>
              Create & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Generate an invoice for {selectedVendor?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="none" disabled>No projects available</SelectItem>
                  ) : (
                    projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Amount</Label>
              <Input type="number" placeholder="Enter amount" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Enter invoice description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast({ title: "Success", description: "Invoice created and sent" });
              setShowInvoiceModal(false);
            }}>
              Create & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send an email to {selectedVendor?.name}
              {selectedVendor?.email && <span className="text-muted-foreground ml-1">({selectedVendor.email})</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subject</Label>
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Enter subject..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your message..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">Your email signature will be automatically appended.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} disabled={sendingMessage}>
              {sendingMessage ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Modal */}
      <Dialog open={showAddVendorModal} onOpenChange={setShowAddVendorModal}>
        <DialogContent className="max-w-lg bg-white dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
            <DialogDescription>
              Add a contractor or service provider to your vendor network
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company/Vendor Name *</Label>
              <Input
                value={newVendor.name}
                onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ABC Plumbing Co"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Category *</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                {PRIMARY_CATEGORIES.map((key) => {
                  const config = TRADE_CONFIG[key];
                  if (!config) return null;
                  return (
                    <Badge
                      key={key}
                      variant={newVendor.categories.includes(key) ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all",
                        newVendor.categories.includes(key) && config.color
                      )}
                      onClick={() => toggleCategory(key)}
                    >
                      {config.label}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Click to select one or more categories</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone</Label>
                <Input
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Website</Label>
              <Input
                value={newVendor.website}
                onChange={(e) => setNewVendor(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Address</Label>
              <Input
                value={newVendor.address}
                onChange={(e) => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">City</Label>
                <Input
                  value={newVendor.city}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Phoenix"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">State</Label>
                <Input
                  value={newVendor.state}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="AZ"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ZIP</Label>
                <Input
                  value={newVendor.zip}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, zip: e.target.value }))}
                  placeholder="85001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                value={newVendor.notes}
                onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about this vendor..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddVendorModal(false);
              setNewVendor({ name: "", email: "", phone: "", website: "", address: "", city: "", state: "", zip: "", categories: [], notes: "" });
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddVendor} disabled={addingVendor}>
              {addingVendor ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
