"use client";

import { cn } from "@/lib/utils";
import {
  Users,
  MessageSquare,
  Calculator,
  FileText,
  FileSignature,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// PipelineBreadcrumb — visual indicator of where a property sits in the deal flow.
// Drop into property detail drawers, cards, hero sections.
//
// Stages mirror the sidebar order so users build a mental map of the flow:
//   Lead → Contacted → Analyzed → Offered → Under Contract → Closed
// ---------------------------------------------------------------------------

export type PipelineStage =
  | "lead"
  | "contacted"
  | "analyzed"
  | "offered"
  | "under_contract"
  | "closed";

const STAGES: {
  key: PipelineStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // active tailwind classes
}[] = [
  { key: "lead", label: "Lead", icon: Users, color: "text-blue-600 dark:text-blue-400" },
  { key: "contacted", label: "Contacted", icon: MessageSquare, color: "text-violet-600 dark:text-violet-400" },
  { key: "analyzed", label: "Analyzed", icon: Calculator, color: "text-amber-600 dark:text-amber-400" },
  { key: "offered", label: "Offered", icon: FileText, color: "text-orange-600 dark:text-orange-400" },
  { key: "under_contract", label: "Under Contract", icon: FileSignature, color: "text-teal-600 dark:text-teal-400" },
  { key: "closed", label: "Closed", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
];

interface PipelineBreadcrumbProps {
  /** Current stage the property is in. */
  currentStage: PipelineStage;
  /** Visual density — "compact" for drawers, "full" for hero sections. */
  variant?: "compact" | "full";
  className?: string;
}

export function PipelineBreadcrumb({
  currentStage,
  variant = "full",
  className,
}: PipelineBreadcrumbProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        variant === "compact" ? "flex-wrap" : "",
        className,
      )}
      role="navigation"
      aria-label="Deal pipeline progress"
    >
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={stage.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
                isCurrent && [
                  "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
                  "ring-2 ring-offset-1 ring-gray-300 dark:ring-gray-700 dark:ring-offset-gray-900",
                ],
                isDone && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                isFuture && "text-gray-400 dark:text-gray-600",
              )}
            >
              <Icon className="h-3 w-3" />
              {(variant === "full" || isCurrent) && (
                <span className="whitespace-nowrap">{stage.label}</span>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <ChevronRight
                className={cn(
                  "h-3 w-3",
                  i < currentIndex
                    ? "text-gray-400 dark:text-gray-600"
                    : "text-gray-300 dark:text-gray-700",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: derive stage from a Property's current DB state.
// Pass in relevant flags and we'll figure out the furthest stage reached.
// ---------------------------------------------------------------------------

export function derivePipelineStage(property: {
  outreachStatus?: string | null;
  hasAnalysis?: boolean;
  hasOffer?: boolean;
  hasSignedContract?: boolean;
  isClosed?: boolean;
}): PipelineStage {
  if (property.isClosed) return "closed";
  if (property.hasSignedContract) return "under_contract";
  if (property.hasOffer) return "offered";
  if (property.hasAnalysis) return "analyzed";
  if (
    property.outreachStatus &&
    property.outreachStatus !== "not_contacted"
  ) {
    return "contacted";
  }
  return "lead";
}
