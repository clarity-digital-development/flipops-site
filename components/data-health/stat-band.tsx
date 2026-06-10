"use client";

// ---------------------------------------------------------------------------
// Headline stat band for the Data Health & Coverage page. Six compact stat
// chips that let an investor grasp the data moat in seconds:
// parcels, county coverage, sale events, tax-delinquent (+$ owed),
// foreclosure filings, scheduled auctions.
// ---------------------------------------------------------------------------

import {
  Database,
  Map,
  TrendingUp,
  Receipt,
  Gavel,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatCompact,
  formatMoneyCompact,
  type DataHealthPayload,
} from "./types";

interface StatChipProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
  sub: string;
}

function StatChip({ icon: Icon, iconClassName, label, value, sub }: StatChipProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 min-w-0">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          iconClassName
        )}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">{sub}</span>
        </div>
      </div>
    </div>
  );
}

export function StatBandSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
        >
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatBand({ headline }: { headline: DataHealthPayload["headline"] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
      <StatChip
        icon={Database}
        iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
        label="Parcels"
        value={formatCompact(headline.parcels)}
        sub="statewide FL"
      />
      <StatChip
        icon={Map}
        iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        label="FL Counties"
        value={`${headline.flCountiesCovered}/${headline.flCountiesTotal}`}
        sub="full coverage"
      />
      <StatChip
        icon={TrendingUp}
        iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
        label="Sale Events"
        value={formatCompact(headline.sales)}
        sub="since 2009"
      />
      <StatChip
        icon={Receipt}
        iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
        label="Tax-Delinquent"
        value={formatCompact(headline.taxDelinquentParcels)}
        sub={`${formatMoneyCompact(headline.taxDelinquentOwed)} owed`}
      />
      <StatChip
        icon={Gavel}
        iconClassName="bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
        label="Foreclosures"
        value={formatCompact(headline.foreclosureFilings)}
        sub="filings tracked"
      />
      <StatChip
        icon={CalendarClock}
        iconClassName="bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
        label="Auctions"
        value={formatCompact(headline.auctionsScheduled)}
        sub="scheduled ahead"
      />
    </div>
  );
}
