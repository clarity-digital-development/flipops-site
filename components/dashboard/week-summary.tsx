"use client";

import {
  UserPlus,
  UserCheck,
  MessageSquare,
  FileText,
  FileSignature,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// WeekSummary — dense vertical stack of the week's key activity metrics.
// Each row shows icon + label + count + 7-day trend delta.
// ---------------------------------------------------------------------------

export interface WeekMetric {
  key: "new_leads" | "skip_traces" | "contacts" | "offers" | "contracts";
  label: string;
  count: number;
  deltaVsPrevious?: number;
}

const METRIC_META: Record<
  WeekMetric["key"],
  { icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  new_leads: {
    icon: UserPlus,
    accent: "text-blue-600 dark:text-blue-400",
  },
  skip_traces: {
    icon: UserCheck,
    accent: "text-violet-600 dark:text-violet-400",
  },
  contacts: {
    icon: MessageSquare,
    accent: "text-amber-600 dark:text-amber-400",
  },
  offers: {
    icon: FileText,
    accent: "text-orange-600 dark:text-orange-400",
  },
  contracts: {
    icon: FileSignature,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
};

interface WeekSummaryProps {
  metrics: WeekMetric[];
  className?: string;
}

export function WeekSummary({ metrics, className }: WeekSummaryProps) {
  return (
    <Card className={cn("p-0 gap-0 overflow-hidden", className)}>
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">This week</h2>
      </div>
      <ul className="divide-y divide-border">
        {metrics.map((m) => {
          const meta = METRIC_META[m.key];
          const Icon = meta.icon;
          const delta = m.deltaVsPrevious ?? 0;
          const Trend = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const trendColor =
            delta > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : delta < 0
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground";
          return (
            <li
              key={m.key}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <Icon className={cn("h-4 w-4 shrink-0", meta.accent)} />
              <span className="flex-1 text-sm font-medium text-foreground">
                {m.label}
              </span>
              <span className="text-lg font-semibold tabular-nums tracking-tight">
                {m.count}
              </span>
              {m.deltaVsPrevious !== undefined && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] font-medium tabular-nums w-12 justify-end",
                    trendColor,
                  )}
                >
                  <Trend className="h-3 w-3" />
                  {delta > 0 ? "+" : ""}
                  {delta}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
