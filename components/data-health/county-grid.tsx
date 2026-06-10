"use client";

// ---------------------------------------------------------------------------
// FL county coverage grid — a styled CSS-grid "tile choropleth" of all 67
// Florida counties (no mapping library). Tile color encodes signal depth:
//   parcels only  →  light
//   +1 signal     →  medium  (tax-delinquency OR foreclosure/auction rows)
//   +2 signals    →  deep    (both signal families present)
// ---------------------------------------------------------------------------

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCompact, type CountyHealth } from "./types";

const DEPTH_CLASSES: Record<number, string> = {
  0: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
  1: "bg-sky-300/80 text-sky-950 border-sky-400/60 dark:bg-sky-800/70 dark:text-sky-100 dark:border-sky-700",
  2: "bg-sky-600 text-white border-sky-700 dark:bg-sky-500 dark:text-white dark:border-sky-400",
};

const NO_DATA_CLASSES =
  "bg-muted text-muted-foreground border-transparent opacity-60";

function tileTitle(county: CountyHealth): string {
  const signals: string[] = [];
  if (county.signals.taxDelinquent) signals.push("Tax-delinquent");
  if (county.signals.foreclosure) signals.push("Foreclosure/Auction");
  const signalText = signals.length > 0 ? signals.join(" + ") : "Parcels only";
  return `${county.name} — ${county.parcels.toLocaleString()} parcels · ${signalText}`;
}

function CountyTile({ county }: { county: CountyHealth }) {
  const classes =
    county.parcels === 0 ? NO_DATA_CLASSES : DEPTH_CLASSES[county.signalCount];

  return (
    <div
      title={tileTitle(county)}
      className={cn(
        "rounded-md border px-1 py-1.5 text-center cursor-default select-none transition-transform hover:scale-[1.06] hover:z-10",
        classes
      )}
    >
      <p className="text-[10px] font-semibold leading-tight truncate">
        {county.name}
      </p>
      <p className="text-[9px] leading-tight tabular-nums opacity-75">
        {county.parcels > 0 ? formatCompact(county.parcels) : "—"}
      </p>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("inline-block h-3 w-3 rounded-sm border", className)} />
      {label}
    </span>
  );
}

export function CountyGridSkeleton() {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-10 gap-1.5">
      {Array.from({ length: 67 }).map((_, i) => (
        <Skeleton key={i} className="h-9 rounded-md" />
      ))}
    </div>
  );
}

export function CountyGrid({ counties }: { counties: CountyHealth[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-10 gap-1.5">
        {counties.map((county) => (
          <CountyTile key={county.fips} county={county} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendSwatch className={DEPTH_CLASSES[0]} label="Parcels only" />
        <LegendSwatch className={DEPTH_CLASSES[1]} label="+1 distress signal" />
        <LegendSwatch className={DEPTH_CLASSES[2]} label="+2 distress signals" />
        <span className="text-[11px] text-muted-foreground">
          Signals: tax-delinquency · foreclosure/auction
        </span>
      </div>
    </div>
  );
}
