"use client";

import { Search, Flame, Home, Ban, X, SlidersHorizontal, Receipt, Gavel } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// LeadFilterBar — the top toolbar of the new Leads page.
// ZIP search + distress chips + score threshold popover + result count.
// ---------------------------------------------------------------------------

export type DistressFilter =
  | "foreclosure"
  | "preForeclosure"
  | "taxDelinquent"
  | "vacant"
  | "auctionScheduled";

const DISTRESS_CHIPS: {
  key: DistressFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}[] = [
  {
    key: "foreclosure",
    label: "Foreclosure",
    icon: Ban,
    activeClass: "bg-red-500 text-white border-red-500 dark:bg-red-600 dark:border-red-600",
  },
  {
    key: "preForeclosure",
    label: "Pre-Foreclosure",
    icon: Flame,
    activeClass: "bg-orange-500 text-white border-orange-500 dark:bg-orange-600 dark:border-orange-600",
  },
  {
    key: "taxDelinquent",
    label: "Tax Delinquent",
    icon: Flame,
    activeClass: "bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600",
  },
  {
    key: "vacant",
    label: "Vacant",
    icon: Home,
    activeClass: "bg-violet-500 text-white border-violet-500 dark:bg-violet-600 dark:border-violet-600",
  },
  {
    key: "auctionScheduled",
    label: "Auction Scheduled",
    icon: Gavel,
    activeClass: "bg-red-600 text-white border-red-600 dark:bg-red-700 dark:border-red-700",
  },
];

interface LeadFilterBarProps {
  zip: string;
  onZipChange: (zip: string) => void;
  distress: Set<DistressFilter>;
  onDistressChange: (next: Set<DistressFilter>) => void;
  scoreMin: number;
  onScoreMinChange: (min: number) => void;
  taxOwedMin: number;
  onTaxOwedMinChange: (min: number) => void;
  resultCount: number;
  onSearch?: () => void;
  onClear?: () => void;
}

const TAX_OWED_STEPS = [0, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000];

function formatTaxOwedCompact(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

export function LeadFilterBar({
  zip,
  onZipChange,
  distress,
  onDistressChange,
  scoreMin,
  onScoreMinChange,
  taxOwedMin,
  onTaxOwedMinChange,
  resultCount,
  onSearch,
  onClear,
}: LeadFilterBarProps) {
  const toggleDistress = (key: DistressFilter) => {
    const next = new Set(distress);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onDistressChange(next);
  };

  const hasActiveFilters =
    distress.size > 0 || scoreMin > 0 || taxOwedMin > 0 || zip.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
      {/* ZIP search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.();
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={zip}
          onChange={(e) => onZipChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="Search ZIP..."
          className="w-40 pl-9 h-9 text-sm"
          inputMode="numeric"
          maxLength={5}
        />
        {zip.length === 5 && (
          <Button
            type="submit"
            size="sm"
            variant="default"
            className="ml-2 h-9"
          >
            Pull leads
          </Button>
        )}
      </form>

      {/* Distress chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DISTRESS_CHIPS.map((chip) => {
          const active = distress.has(chip.key);
          const Icon = chip.icon;
          return (
            <button
              key={chip.key}
              onClick={() => toggleDistress(chip.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? chip.activeClass
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              aria-pressed={active}
            >
              <Icon className="h-3 w-3" />
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Score threshold popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5",
              scoreMin > 0 && "border-primary text-primary",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Score {scoreMin > 0 ? `≥ ${scoreMin}` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Minimum score</Label>
              <span className="text-sm font-semibold tabular-nums">
                {scoreMin}
              </span>
            </div>
            <Slider
              value={[scoreMin]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => onScoreMinChange(v[0])}
            />
            <p className="text-xs text-muted-foreground">
              Only show leads scoring at or above this threshold.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Tax Owed threshold popover (Option A) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5",
              taxOwedMin > 0 && "border-amber-500 text-amber-600 dark:text-amber-400",
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            Tax Owed {taxOwedMin > 0 ? `≥ ${formatTaxOwedCompact(taxOwedMin)}` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Minimum tax owed</Label>
              <span className="text-sm font-semibold tabular-nums">
                {formatTaxOwedCompact(taxOwedMin)}
              </span>
            </div>
            <Slider
              value={[TAX_OWED_STEPS.indexOf(taxOwedMin) === -1 ? 0 : TAX_OWED_STEPS.indexOf(taxOwedMin)]}
              min={0}
              max={TAX_OWED_STEPS.length - 1}
              step={1}
              onValueChange={(v) => onTaxOwedMinChange(TAX_OWED_STEPS[v[0]])}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              {TAX_OWED_STEPS.map((step) => (
                <span key={step}>{formatTaxOwedCompact(step)}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Only show leads with tax delinquency at or above this amount.
              Surfaces high-motivation owners faster.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => {
            onClear?.();
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}

      {/* Result count */}
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {resultCount} {resultCount === 1 ? "lead" : "leads"}
        </Badge>
      </div>
    </div>
  );
}
