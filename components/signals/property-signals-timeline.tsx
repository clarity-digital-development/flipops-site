"use client";

import { useEffect, useState } from "react";
import {
  Gavel,
  Receipt,
  Scale,
  Landmark,
  DollarSign,
  Home,
  Clock,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertySignalsTimeline (M3.4)
//
// Vertical, color-coded chronological stream of every dated event tied to a
// parcel — pulled from GET /api/properties/[id]/signals. Future events
// (scheduled auctions / tax-deed sales) pin to the top with a live countdown;
// past events flow newest → oldest below. Renders REAL data only; honest empty
// state when a property has no parcel-linked signals.
//
// Drop-in: <PropertySignalsTimeline propertyId={id} /> — works for both real
// Property ids and virtual lead ids (virt-{fips}-{apn}).
// ---------------------------------------------------------------------------

type SignalEventType =
  | "sale"
  | "mortgage"
  | "lien"
  | "tax_delinquent"
  | "foreclosure"
  | "auction";

interface SignalEvent {
  key: string;
  type: SignalEventType;
  date: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  future?: boolean;
  released?: boolean;
}

interface SignalsPayload {
  countyFips: string;
  apn: string;
  events: SignalEvent[];
  eventTypes: SignalEventType[];
}

const TYPE_CONFIG: Record<
  SignalEventType,
  { label: string; icon: React.ElementType; dot: string; ring: string; chip: string }
> = {
  sale: {
    label: "Sale",
    icon: Home,
    dot: "bg-blue-500",
    ring: "ring-blue-500/20 dark:ring-blue-400/20",
    chip: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400",
  },
  mortgage: {
    label: "Mortgage",
    icon: Landmark,
    dot: "bg-indigo-500",
    ring: "ring-indigo-500/20 dark:ring-indigo-400/20",
    chip: "border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400",
  },
  lien: {
    label: "Lien",
    icon: Scale,
    dot: "bg-purple-500",
    ring: "ring-purple-500/20 dark:ring-purple-400/20",
    chip: "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400",
  },
  tax_delinquent: {
    label: "Tax",
    icon: Receipt,
    dot: "bg-amber-500",
    ring: "ring-amber-500/20 dark:ring-amber-400/20",
    chip: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  },
  foreclosure: {
    label: "Foreclosure",
    icon: Gavel,
    dot: "bg-rose-500",
    ring: "ring-rose-500/20 dark:ring-rose-400/20",
    chip: "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-400",
  },
  auction: {
    label: "Auction",
    icon: Gavel,
    dot: "bg-red-600",
    ring: "ring-red-600/20 dark:ring-red-500/20",
    chip: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  },
};

function formatCurrency(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCountdown(input: string): string | null {
  const d = new Date(input).getTime();
  if (Number.isNaN(d)) return null;
  const days = Math.round((d - Date.now()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 60) return `In ${days} days`;
  const months = Math.round(days / 30);
  return `In ${months} month${months === 1 ? "" : "s"}`;
}

function TimelineNode({ event, isFuture }: { event: SignalEvent; isFuture: boolean }) {
  const cfg = TYPE_CONFIG[event.type];
  const Icon = cfg.icon;
  const amount = formatCurrency(event.amount);
  const countdown = isFuture ? formatCountdown(event.date) : null;

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      {/* Connector line + node dot */}
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4",
            "bg-card",
            cfg.ring,
          )}
        >
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", cfg.dot)}>
            <Icon className="h-4 w-4" />
          </span>
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</span>
          {amount ? (
            <span className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-3 w-3" />
              {amount.replace("$", "")}
            </span>
          ) : null}
          {event.released ? (
            <Badge variant="outline" className="border-gray-300 text-[10px] text-gray-500 dark:border-gray-600 dark:text-gray-400">
              Released
            </Badge>
          ) : null}
          {isFuture && countdown ? (
            <Badge className="border-0 bg-red-100 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <Clock className="mr-1 h-2.5 w-2.5" />
              {countdown}
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDate(event.date)}</span>
          {event.detail ? <span className="truncate">· {event.detail}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function PropertySignalsTimeline({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<SignalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/signals`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`Failed to load signals (${res.status})`);
            setData(null);
          }
          return;
        }
        const payload = (await res.json()) as SignalsPayload;
        if (!cancelled) setData(payload);
      } catch (err) {
        console.error("Failed to load property signals", err);
        if (!cancelled) {
          setError("Unable to load the signals timeline.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const now = Date.now();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-rose-500" />
          Signals timeline
        </CardTitle>
        {data && data.eventTypes.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {data.eventTypes.map((t) => (
              <Badge key={t} variant="outline" className={cn("text-[10px]", TYPE_CONFIG[t].chip)}>
                {TYPE_CONFIG[t].label}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-muted-foreground">{error}</p>
        ) : !data || data.events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No recorded signals yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              We have no parcel-linked sale, mortgage, lien, tax, or foreclosure
              events for this property. Signals appear as county records are scraped.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical rail behind the nodes */}
            <div className="absolute bottom-2 left-4 top-2 w-px -translate-x-1/2 bg-border" />
            <div className="relative">
              {data.events.map((event) => (
                <TimelineNode
                  key={event.key}
                  event={event}
                  isFuture={!!event.future || new Date(event.date).getTime() > now}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
