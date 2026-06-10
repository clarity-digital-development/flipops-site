"use client";

// ---------------------------------------------------------------------------
// Per-source cards for the Data Health & Coverage page. Two groups:
//   - Live scrapers (ScrapeRegistry-driven, with freshness chips vs cadence)
//   - Bulk vintage snapshots (one-time statewide ingests, always "static")
// Every number comes from BulkIngestJob audit rows — these are the live
// scraper receipts no data reseller can show.
// ---------------------------------------------------------------------------

import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Archive,
  Globe,
  MapPin,
  PauseCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatCompact,
  formatRelativeTime,
  type Cadence,
  type SourceHealth,
} from "./types";

// --- Chips -------------------------------------------------------------------

const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  static: "Bulk vintage",
};

function FreshnessChip({ source }: { source: SourceHealth }) {
  if (!source.enabled) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
      >
        <PauseCircle className="h-3 w-3" /> Paused
      </Badge>
    );
  }

  switch (source.freshness) {
    case "fresh":
      return (
        <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10">
          <CheckCircle2 className="h-3 w-3" /> Fresh
        </Badge>
      );
    case "stale":
      return (
        <Badge className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/10">
          <AlertTriangle className="h-3 w-3" /> Stale
        </Badge>
      );
    case "critical":
      return (
        <Badge className="gap-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/10">
          <AlertCircle className="h-3 w-3" /> Overdue
        </Badge>
      );
    case "static":
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          <Archive className="h-3 w-3" /> Static
        </Badge>
      );
  }
}

// --- Cards -------------------------------------------------------------------

function SourceCard({ source }: { source: SourceHealth }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 transition-shadow hover:shadow-md">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {source.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {source.description}
          </p>
        </div>
        <FreshnessChip source={source} />
      </div>

      {/* Scope row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {source.countyName ? `${source.countyName} County` : "Statewide FL"}
        </span>
        {source.domain && (
          <span className="inline-flex items-center gap-1 truncate">
            <Globe className="h-3 w-3" />
            {source.domain}
          </span>
        )}
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
          {CADENCE_LABELS[source.cadence]}
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Last run
          </p>
          <p
            className="text-xs font-medium tabular-nums truncate"
            title={source.lastRunAt ?? undefined}
          >
            {formatRelativeTime(source.lastRunAt)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p
            className={cn(
              "text-xs font-medium capitalize truncate",
              source.lastStatus === "failed" && "text-red-600 dark:text-red-400",
              source.lastStatus === "succeeded" &&
                "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {source.lastStatus ?? "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Records
          </p>
          <p className="text-xs font-medium tabular-nums truncate">
            {source.totalRecords > 0 ? (
              <>
                {formatCompact(source.totalRecords)}
                <span className="text-muted-foreground font-normal"> total</span>
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SourceCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SourceCards({ sources }: { sources: SourceHealth[] }) {
  const liveScrapers = sources.filter((s) => s.cadence !== "static");
  const bulkSnapshots = sources.filter((s) => s.cadence === "static");

  return (
    <div className="space-y-6">
      {liveScrapers.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Live scrapers
            </h3>
            <p className="text-xs text-muted-foreground">
              Scheduled county-record scrapers with run-by-run audit receipts
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {liveScrapers.map((source) => (
              <SourceCard key={source.key} source={source} />
            ))}
          </div>
        </div>
      )}

      {bulkSnapshots.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Bulk vintage snapshots
            </h3>
            <p className="text-xs text-muted-foreground">
              One-time statewide ingests — refreshed on roll-release cadence
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bulkSnapshots.map((source) => (
              <SourceCard key={source.key} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
