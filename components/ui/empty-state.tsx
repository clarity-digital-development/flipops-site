"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ---------------------------------------------------------------------------
// EmptyState — single shared component used by every page that previously
// silently fell back to seed-data fabrications. Per the platform UX
// walkthrough (2026-06-04), seed-data masquerading as live data was the
// #2 systemic issue. This component replaces that pattern across the app.
//
// Usage:
//
//   <EmptyState
//     icon={<Home className="h-10 w-10" />}
//     title="No leads yet"
//     description="Pull leads by ZIP to start surfacing real distress signals."
//     actionLabel="Pull leads"
//     actionHref="/app/leads"
//   />
//
// Or with onClick:
//
//   <EmptyState
//     icon={<Sparkles className="h-10 w-10" />}
//     title="No tasks yet"
//     description="Tasks get auto-created when you skip-trace or take action on a lead."
//     actionLabel="Create task"
//     onAction={() => setCreateOpen(true)}
//   />
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  /** Use a tighter compact variant for in-card empty states (no extra padding). */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref}>
        <Button size="sm">{actionLabel}</Button>
      </Link>
    ) : (
      <Button size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-16 px-6 gap-3",
        className,
      )}
    >
      {icon && (
        <div className="mb-1 inline-flex items-center justify-center rounded-full bg-muted p-3 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-lg")}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
