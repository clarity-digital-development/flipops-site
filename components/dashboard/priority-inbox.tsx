"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Flame,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PriorityInbox — the top-of-dashboard attention list.
// Merges the most time-sensitive things an investor needs to act on:
//   overdue tasks → uncontacted hot leads → expiring offers → closing deals.
// Every item is a direct link to the page where action happens.
// ---------------------------------------------------------------------------

export type PriorityKind =
  | "overdue_task"
  | "hot_uncontacted"
  | "offer_expiring"
  | "contract_closing";

export interface PriorityItem {
  id: string;
  kind: PriorityKind;
  title: string;
  detail: string;
  href: string;
  meta?: string;
}

const KIND_STYLES: Record<
  PriorityKind,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    label: string;
  }
> = {
  overdue_task: {
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-50 dark:bg-red-950/40",
    label: "Overdue",
  },
  hot_uncontacted: {
    icon: Flame,
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    label: "Hot lead uncontacted",
  },
  offer_expiring: {
    icon: Clock,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    label: "Offer expiring",
  },
  contract_closing: {
    icon: Calendar,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "Closing soon",
  },
};

interface PriorityInboxProps {
  items: PriorityItem[];
  className?: string;
}

export function PriorityInbox({ items, className }: PriorityInboxProps) {
  if (items.length === 0) {
    return (
      <Card className={cn("flex items-center gap-4 p-5", className)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold">Nothing urgent today</p>
          <p className="text-xs text-muted-foreground">
            You're caught up. Time to scout new leads or advance deals.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden p-0 gap-0", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Needs your attention</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums">
            {items.length}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.slice(0, 6).map((item) => {
          const styles = KIND_STYLES[item.kind];
          const Icon = styles.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    styles.iconBg,
                  )}
                >
                  <Icon className={cn("h-4 w-4", styles.iconColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.meta && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {item.meta}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    <span className={cn("font-medium", styles.iconColor)}>
                      {styles.label}
                    </span>
                    <span className="mx-1.5 text-muted-foreground/60">·</span>
                    {item.detail}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
