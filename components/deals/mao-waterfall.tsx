"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Home,
  Wrench,
  Clock,
  FileText,
  TrendingUp,
  Target,
  Calculator,
  Info,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ============================================================================
// TYPES
// ============================================================================

export interface MAOAssumptions {
  realtorPct: number; // Sell-side realtor fees (typically 5-6%)
  buyClosingPct: number; // Buy-side closing costs (typically 1-2%)
  sellClosingPct: number; // Sell-side closing costs (typically 2-3%)
  holdingPerDay: number; // Daily holding costs
  rehabDays: number; // Expected rehab duration
  profitTargetPct: number; // Target profit percentage
}

export interface MAOWaterfallProps {
  arv: number;
  repairs: number;
  assumptions?: Partial<MAOAssumptions>;
  onAssumptionsChange?: (assumptions: MAOAssumptions) => void;
  showSettings?: boolean;
  className?: string;
}

// ============================================================================
// DEFAULT ASSUMPTIONS
// ============================================================================

const DEFAULT_ASSUMPTIONS: MAOAssumptions = {
  realtorPct: 0.06, // 6% realtor commission
  buyClosingPct: 0.015, // 1.5% buy closing
  sellClosingPct: 0.02, // 2% sell closing
  holdingPerDay: 50, // $50/day holding
  rehabDays: 90, // 90 day rehab
  profitTargetPct: 0.15, // 15% profit target
};

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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================================================
// WATERFALL LINE COMPONENT
// ============================================================================

interface WaterfallLineProps {
  icon: React.ReactNode;
  label: string;
  amount: number;
  type: "base" | "subtract" | "result";
  sublabel?: string;
  tooltip?: string;
  editable?: boolean;
  onEdit?: (value: number) => void;
}

function WaterfallLine({
  icon,
  label,
  amount,
  type,
  sublabel,
  tooltip,
}: WaterfallLineProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 px-3 rounded-lg transition-all",
        type === "base" && "bg-blue-50/50 dark:bg-blue-900/20",
        type === "subtract" && "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        type === "result" &&
          "bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            type === "base" && "bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400",
            type === "subtract" && "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
            type === "result" && "bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                type === "result"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-gray-700 dark:text-gray-300"
              )}
            >
              {label}
            </span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {sublabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums font-semibold",
          type === "base" && "text-blue-600 dark:text-blue-400",
          type === "subtract" && "text-gray-600 dark:text-gray-400",
          type === "result" && "text-lg text-emerald-600 dark:text-emerald-400"
        )}
      >
        {type === "subtract" && "−"}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

interface SettingsPanelProps {
  assumptions: MAOAssumptions;
  arv: number;
  onChange: (assumptions: MAOAssumptions) => void;
}

function SettingsPanel({ assumptions, arv, onChange }: SettingsPanelProps) {
  const updateAssumption = <K extends keyof MAOAssumptions>(
    key: K,
    value: MAOAssumptions[K]
  ) => {
    onChange({ ...assumptions, [key]: value });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Settings2 className="w-4 h-4" />
        Deal Assumptions
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Realtor Commission */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Realtor Commission</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[assumptions.realtorPct * 100]}
              onValueChange={([v]) => updateAssumption("realtorPct", v / 100)}
              min={0}
              max={10}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs font-mono w-12 text-right">
              {(assumptions.realtorPct * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            {formatCurrency(arv * assumptions.realtorPct)}
          </p>
        </div>

        {/* Buy Closing */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Buy Closing Costs</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[assumptions.buyClosingPct * 100]}
              onValueChange={([v]) => updateAssumption("buyClosingPct", v / 100)}
              min={0}
              max={5}
              step={0.25}
              className="flex-1"
            />
            <span className="text-xs font-mono w-12 text-right">
              {(assumptions.buyClosingPct * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Sell Closing */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Sell Closing Costs</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[assumptions.sellClosingPct * 100]}
              onValueChange={([v]) => updateAssumption("sellClosingPct", v / 100)}
              min={0}
              max={5}
              step={0.25}
              className="flex-1"
            />
            <span className="text-xs font-mono w-12 text-right">
              {(assumptions.sellClosingPct * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Profit Target */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Profit Target</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[assumptions.profitTargetPct * 100]}
              onValueChange={([v]) => updateAssumption("profitTargetPct", v / 100)}
              min={5}
              max={30}
              step={1}
              className="flex-1"
            />
            <span className="text-xs font-mono w-12 text-right">
              {(assumptions.profitTargetPct * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            {formatCurrency(arv * assumptions.profitTargetPct)}
          </p>
        </div>

        {/* Holding Per Day */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Holding Cost/Day</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">$</span>
            <Input
              type="number"
              value={assumptions.holdingPerDay}
              onChange={(e) =>
                updateAssumption("holdingPerDay", parseFloat(e.target.value) || 0)
              }
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Rehab Days */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Rehab Duration</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={assumptions.rehabDays}
              onChange={(e) =>
                updateAssumption("rehabDays", parseInt(e.target.value) || 0)
              }
              className="h-8 text-xs"
            />
            <span className="text-xs text-gray-400">days</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Holding: {formatCurrency(assumptions.holdingPerDay * assumptions.rehabDays)}
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-gray-500"
        onClick={() => onChange(DEFAULT_ASSUMPTIONS)}
      >
        Reset to Defaults
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MAOWaterfall({
  arv,
  repairs,
  assumptions: initialAssumptions,
  onAssumptionsChange,
  showSettings = true,
  className,
}: MAOWaterfallProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [assumptions, setAssumptions] = useState<MAOAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
    ...initialAssumptions,
  });

  // Update parent when assumptions change
  const handleAssumptionsChange = (newAssumptions: MAOAssumptions) => {
    setAssumptions(newAssumptions);
    onAssumptionsChange?.(newAssumptions);
  };

  // Calculate all costs
  const realtorFees = arv * assumptions.realtorPct;
  const buyClosingCosts = arv * assumptions.buyClosingPct;
  const sellClosingCosts = arv * assumptions.sellClosingPct;
  const holdingCosts = assumptions.holdingPerDay * assumptions.rehabDays;
  const profitTarget = arv * assumptions.profitTargetPct;

  const totalCosts = repairs + realtorFees + buyClosingCosts + sellClosingCosts + holdingCosts + profitTarget;
  const mao = Math.max(0, arv - totalCosts);

  // Calculate percentages for visual bar
  const costBreakdown = [
    { label: "Repairs", amount: repairs, color: "bg-amber-500" },
    { label: "Realtor", amount: realtorFees, color: "bg-purple-500" },
    { label: "Closing", amount: buyClosingCosts + sellClosingCosts, color: "bg-blue-500" },
    { label: "Holding", amount: holdingCosts, color: "bg-orange-500" },
    { label: "Profit", amount: profitTarget, color: "bg-emerald-500" },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  MAO Calculation
                </h3>
                <p className="text-xs text-gray-500">
                  Maximum Allowable Offer Breakdown
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(mao)}
                </p>
                <p className="text-xs text-gray-500">
                  {arv > 0 ? `${((mao / arv) * 100).toFixed(0)}% of ARV` : "—"}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Visual cost breakdown bar */}
            <div className="space-y-2">
              <TooltipProvider delayDuration={100}>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {arv > 0 &&
                    costBreakdown.map((item, i) => {
                      const pct = (item.amount / arv) * 100;
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(item.color, "transition-all duration-500 cursor-help")}
                              style={{ width: `${pct}%` }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{item.label}</div>
                            <div className="font-mono tabular-nums">
                              {formatCurrency(item.amount)} · {pct.toFixed(1)}% of ARV
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="bg-emerald-200 dark:bg-emerald-800 cursor-help"
                        style={{ width: `${arv > 0 ? (mao / arv) * 100 : 0}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-medium">MAO</div>
                      <div className="font-mono tabular-nums">
                        {formatCurrency(mao)} · {arv > 0 ? ((mao / arv) * 100).toFixed(1) : "0.0"}% of ARV
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <div className="flex flex-wrap gap-3 text-[10px]">
                {costBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <span className="text-gray-500">{item.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-200 dark:bg-emerald-800" />
                  <span className="text-gray-500">MAO</span>
                </div>
              </div>
            </div>

            {/* Waterfall breakdown */}
            <div className="space-y-1">
              <WaterfallLine
                icon={<TrendingUp className="w-4 h-4" />}
                label="After Repair Value (ARV)"
                amount={arv}
                type="base"
                tooltip="Expected sale price after repairs"
              />

              <WaterfallLine
                icon={<Wrench className="w-4 h-4" />}
                label="Repair Costs"
                amount={repairs}
                type="subtract"
                sublabel="Estimated rehab budget"
              />

              <WaterfallLine
                icon={<Home className="w-4 h-4" />}
                label="Realtor Commission"
                amount={realtorFees}
                type="subtract"
                sublabel={formatPercent(assumptions.realtorPct)}
                tooltip="Typical sell-side agent commission"
              />

              <WaterfallLine
                icon={<FileText className="w-4 h-4" />}
                label="Buy Closing Costs"
                amount={buyClosingCosts}
                type="subtract"
                sublabel={formatPercent(assumptions.buyClosingPct)}
                tooltip="Title, escrow, recording fees at purchase"
              />

              <WaterfallLine
                icon={<FileText className="w-4 h-4" />}
                label="Sell Closing Costs"
                amount={sellClosingCosts}
                type="subtract"
                sublabel={formatPercent(assumptions.sellClosingPct)}
                tooltip="Title, escrow, transfer taxes at sale"
              />

              <WaterfallLine
                icon={<Clock className="w-4 h-4" />}
                label="Holding Costs"
                amount={holdingCosts}
                type="subtract"
                sublabel={`$${assumptions.holdingPerDay}/day × ${assumptions.rehabDays} days`}
                tooltip="Insurance, utilities, taxes, interest during rehab"
              />

              <WaterfallLine
                icon={<Target className="w-4 h-4" />}
                label="Profit Target"
                amount={profitTarget}
                type="subtract"
                sublabel={formatPercent(assumptions.profitTargetPct)}
                tooltip="Your minimum required profit"
              />

              <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />

              <WaterfallLine
                icon={<Sparkles className="w-4 h-4" />}
                label="Maximum Allowable Offer"
                amount={mao}
                type="result"
              />
            </div>

            {/* Settings toggle */}
            {showSettings && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                >
                  <Settings2 className="w-3.5 h-3.5 mr-2" />
                  {showSettingsPanel ? "Hide" : "Adjust"} Assumptions
                </Button>

                {showSettingsPanel && (
                  <div className="mt-3">
                    <SettingsPanel
                      assumptions={assumptions}
                      arv={arv}
                      onChange={handleAssumptionsChange}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// PANEL VERSION (for embedding in tabs)
// ============================================================================

export interface MAOWaterfallPanelProps {
  arv: number;
  repairs: number;
  assumptions?: Partial<MAOAssumptions>;
  onAssumptionsChange?: (assumptions: MAOAssumptions) => void;
}

export function MAOWaterfallPanel({
  arv,
  repairs,
  assumptions: initialAssumptions,
  onAssumptionsChange,
}: MAOWaterfallPanelProps) {
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [assumptions, setAssumptions] = useState<MAOAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
    ...initialAssumptions,
  });

  const handleAssumptionsChange = (newAssumptions: MAOAssumptions) => {
    setAssumptions(newAssumptions);
    onAssumptionsChange?.(newAssumptions);
  };

  const realtorFees = arv * assumptions.realtorPct;
  const buyClosingCosts = arv * assumptions.buyClosingPct;
  const sellClosingCosts = arv * assumptions.sellClosingPct;
  const holdingCosts = assumptions.holdingPerDay * assumptions.rehabDays;
  const profitTarget = arv * assumptions.profitTargetPct;

  const totalCosts = repairs + realtorFees + buyClosingCosts + sellClosingCosts + holdingCosts + profitTarget;
  const mao = Math.max(0, arv - totalCosts);

  const costBreakdown = [
    { label: "Repairs", amount: repairs, color: "bg-amber-500" },
    { label: "Realtor", amount: realtorFees, color: "bg-purple-500" },
    { label: "Closing", amount: buyClosingCosts + sellClosingCosts, color: "bg-blue-500" },
    { label: "Holding", amount: holdingCosts, color: "bg-orange-500" },
    { label: "Profit", amount: profitTarget, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Header with MAO value */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">MAO Breakdown</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Maximum Allowable Offer Calculation
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(mao)}
          </p>
          <p className="text-xs text-gray-500">
            {arv > 0 ? `${((mao / arv) * 100).toFixed(0)}% of ARV` : "—"}
          </p>
        </div>
      </div>

      {/* Visual cost breakdown bar */}
      <div className="space-y-2">
        <TooltipProvider delayDuration={100}>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            {arv > 0 &&
              costBreakdown.map((item, i) => {
                const pct = (item.amount / arv) * 100;
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(item.color, "transition-all duration-500 cursor-help")}
                        style={{ width: `${pct}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-medium">{item.label}</div>
                      <div className="font-mono tabular-nums">
                        {formatCurrency(item.amount)} · {pct.toFixed(1)}% of ARV
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="bg-emerald-200 dark:bg-emerald-800 cursor-help"
                  style={{ width: `${arv > 0 ? (mao / arv) * 100 : 0}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-medium">MAO</div>
                <div className="font-mono tabular-nums">
                  {formatCurrency(mao)} · {arv > 0 ? ((mao / arv) * 100).toFixed(1) : "0.0"}% of ARV
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <div className="flex flex-wrap gap-3 text-[10px]">
          {costBreakdown.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", item.color)} />
              <span className="text-gray-500">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-200 dark:bg-emerald-800" />
            <span className="text-gray-500">MAO</span>
          </div>
        </div>
      </div>

      {/* Waterfall breakdown */}
      <div className="space-y-1">
        <WaterfallLine
          icon={<TrendingUp className="w-4 h-4" />}
          label="After Repair Value (ARV)"
          amount={arv}
          type="base"
          tooltip="Expected sale price after repairs"
        />
        <WaterfallLine
          icon={<Wrench className="w-4 h-4" />}
          label="Repair Costs"
          amount={repairs}
          type="subtract"
          sublabel="Estimated rehab budget"
        />
        <WaterfallLine
          icon={<Home className="w-4 h-4" />}
          label="Realtor Commission"
          amount={realtorFees}
          type="subtract"
          sublabel={formatPercent(assumptions.realtorPct)}
          tooltip="Typical sell-side agent commission"
        />
        <WaterfallLine
          icon={<FileText className="w-4 h-4" />}
          label="Buy Closing Costs"
          amount={buyClosingCosts}
          type="subtract"
          sublabel={formatPercent(assumptions.buyClosingPct)}
          tooltip="Title, escrow, recording fees at purchase"
        />
        <WaterfallLine
          icon={<FileText className="w-4 h-4" />}
          label="Sell Closing Costs"
          amount={sellClosingCosts}
          type="subtract"
          sublabel={formatPercent(assumptions.sellClosingPct)}
          tooltip="Title, escrow, transfer taxes at sale"
        />
        <WaterfallLine
          icon={<Clock className="w-4 h-4" />}
          label="Holding Costs"
          amount={holdingCosts}
          type="subtract"
          sublabel={`$${assumptions.holdingPerDay}/day × ${assumptions.rehabDays} days`}
          tooltip="Insurance, utilities, taxes, interest during rehab"
        />
        <WaterfallLine
          icon={<Target className="w-4 h-4" />}
          label="Profit Target"
          amount={profitTarget}
          type="subtract"
          sublabel={formatPercent(assumptions.profitTargetPct)}
          tooltip="Your minimum required profit"
        />

        <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2" />

        <WaterfallLine
          icon={<Sparkles className="w-4 h-4" />}
          label="Maximum Allowable Offer"
          amount={mao}
          type="result"
        />
      </div>

      {/* Settings */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
        >
          <Settings2 className="w-3.5 h-3.5 mr-2" />
          {showSettingsPanel ? "Hide" : "Adjust"} Assumptions
        </Button>

        {showSettingsPanel && (
          <div className="mt-3">
            <SettingsPanel
              assumptions={assumptions}
              arv={arv}
              onChange={handleAssumptionsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT INLINE VERSION
// ============================================================================

export function MAOWaterfallInline({
  arv,
  repairs,
  assumptions: initialAssumptions,
}: {
  arv: number;
  repairs: number;
  assumptions?: Partial<MAOAssumptions>;
}) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...initialAssumptions };

  const realtorFees = arv * assumptions.realtorPct;
  const buyClosingCosts = arv * assumptions.buyClosingPct;
  const sellClosingCosts = arv * assumptions.sellClosingPct;
  const holdingCosts = assumptions.holdingPerDay * assumptions.rehabDays;
  const profitTarget = arv * assumptions.profitTargetPct;
  const mao = Math.max(0, arv - repairs - realtorFees - buyClosingCosts - sellClosingCosts - holdingCosts - profitTarget);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-help">
            <Info className="w-3.5 h-3.5" />
            See calculation
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm p-0">
          <div className="p-3 space-y-2 text-xs">
            <div className="font-medium text-gray-900 dark:text-white mb-2">
              MAO Breakdown
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>ARV</span>
                <span className="font-mono">{formatCurrency(arv)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>− Repairs</span>
                <span className="font-mono">{formatCurrency(repairs)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>− Realtor ({formatPercent(assumptions.realtorPct)})</span>
                <span className="font-mono">{formatCurrency(realtorFees)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>− Closing Costs</span>
                <span className="font-mono">{formatCurrency(buyClosingCosts + sellClosingCosts)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>− Holding ({assumptions.rehabDays}d)</span>
                <span className="font-mono">{formatCurrency(holdingCosts)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>− Profit ({formatPercent(assumptions.profitTargetPct)})</span>
                <span className="font-mono">{formatCurrency(profitTarget)}</span>
              </div>
              <div className="border-t pt-1 flex justify-between font-medium text-emerald-600">
                <span>= MAO</span>
                <span className="font-mono">{formatCurrency(mao)}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
