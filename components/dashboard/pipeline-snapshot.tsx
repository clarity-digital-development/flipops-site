"use client";

import Link from "next/link";
import {
  Users,
  MessageSquare,
  Calculator,
  FileText,
  FileSignature,
  CheckCircle2,
  ArrowRight,
  Hammer,
  Key,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PipelineSnapshot — vertical ladder of pipeline stages.
// Replaces the horizontal PipelineFunnel. Shows real counts + $ totals,
// each stage is a link to the page where that work happens.
// ---------------------------------------------------------------------------

export interface PipelineStageMetric {
  // Keys cover both the original wholesaler-flavored stages (analyzed,
  // offered, under_contract, closed) and the flipper-targeted stages
  // (underwriting, acquired, in_rehab, sold) added 2026-06-04 when the
  // Dashboard pivoted to the flipper persona as primary target.
  key:
    | "leads"
    | "contacted"
    | "analyzed"
    | "underwriting"
    | "offered"
    | "under_contract"
    | "acquired"
    | "in_rehab"
    | "sold"
    | "closed";
  label: string;
  count: number;
  subtitle?: string;
  value?: number;
  href: string;
}

const STAGE_META: Record<
  PipelineStageMetric["key"],
  { icon: React.ComponentType<{ className?: string }>; accent: string; dot: string }
> = {
  leads: {
    icon: Users,
    accent: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  contacted: {
    icon: MessageSquare,
    accent: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  analyzed: {
    icon: Calculator,
    accent: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  underwriting: {
    icon: Calculator,
    accent: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  offered: {
    icon: FileText,
    accent: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  under_contract: {
    icon: FileSignature,
    accent: "text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  acquired: {
    icon: Key,
    accent: "text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  in_rehab: {
    icon: Hammer,
    accent: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  sold: {
    icon: TrendingUp,
    accent: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  closed: {
    icon: CheckCircle2,
    accent: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

interface PipelineSnapshotProps {
  stages: PipelineStageMetric[];
  className?: string;
}

export function PipelineSnapshot({
  stages,
  className,
}: PipelineSnapshotProps) {
  // Used for the connecting line to reach from first icon to last.
  return (
    <Card className={cn("p-0 gap-0 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Pipeline</h2>
        <Link
          href="/app/analytics"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Analytics
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative px-5 py-4">
        {/* Vertical connector */}
        <div
          className="absolute left-[33px] top-7 bottom-7 w-px bg-border"
          aria-hidden
        />

        <ul className="space-y-1">
          {stages.map((stage) => {
            const meta = STAGE_META[stage.key];
            const Icon = meta.icon;
            const hasValue = stage.value != null && stage.value > 0;
            return (
              <li key={stage.key} className="relative">
                <Link
                  href={stage.href}
                  className="group flex items-center gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card border border-border">
                    <Icon className={cn("h-4 w-4", meta.accent)} />
                  </div>
                  <div className="min-w-0 flex-1 flex items-baseline gap-3">
                    <span className="text-sm font-medium">{stage.label}</span>
                    {stage.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {stage.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {hasValue && (
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {formatCompact(stage.value!)}
                      </span>
                    )}
                    <span className="text-lg font-semibold tabular-nums tracking-tight min-w-[2ch] text-right">
                      {stage.count}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
