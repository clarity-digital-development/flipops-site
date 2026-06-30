"use client";

import { MapPin, Phone, Mail, Flame, Users, Receipt, Sparkles, Gavel, Scale } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatTaxAmountCompact(n?: number | null): string | null {
  if (n == null || n <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(n);
}

/**
 * Format the countdown to the next scheduled auction.
 * Pure function — returns a human-readable string or null.
 *
 * - "Today" — same calendar day
 * - "Tomorrow" — 1 day out
 * - "Auction in Nd" — 2-30 days out
 * - "Auction in N months" — 30+ days out (Math.round(days/30))
 * - "Past auction" — date is in the past
 * - null — no date provided
 */
function formatAuctionCountdown(nextAuctionDate?: string | Date | null): string | null {
  if (!nextAuctionDate) return null;
  const target = nextAuctionDate instanceof Date ? nextAuctionDate : new Date(nextAuctionDate);
  if (Number.isNaN(target.getTime())) return null;

  // Normalize both dates to midnight local for stable day-diff math.
  const now = new Date();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / msPerDay);

  if (days < 0) return "Past auction";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 30) return `Auction in ${days}d`;
  return `Auction in ${Math.round(days / 30)} months`;
}

// ---------------------------------------------------------------------------
// LeadListPanel — the left pane of the new Leads page.
// Scrollable list of leads, clickable to select, syncs with the map.
// ---------------------------------------------------------------------------

export interface ListLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  score?: number;
  ownerName?: string;
  phoneNumbers?: string;
  emails?: string;
  outreachStatus?: string;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
  // Option A — tax-delinquent display
  taxDelinquentAmount?: number | null;
  taxDelinquentYearsCount?: number | null;
  virtual?: boolean;
  // M3.B — auction-bridge display
  nextAuctionDate?: string | Date | null;
  pastAuctionCount?: number | null;
  dataSource?: string | null;
  // M3.D — probate-bridge display
  decedentName?: string | null;
  dateOfDeath?: string | Date | null;
}

interface LeadListPanelProps {
  leads: ListLead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  loading?: boolean;
}

function scoreStyles(score?: number): {
  bar: string;
  text: string;
  bg: string;
} {
  if (!score) {
    return {
      bar: "bg-gray-300 dark:bg-gray-600",
      text: "text-gray-500 dark:text-gray-400",
      bg: "bg-gray-100 dark:bg-gray-800",
    };
  }
  if (score >= 85)
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
    };
  if (score >= 70)
    return {
      bar: "bg-green-500",
      text: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/50",
    };
  if (score >= 50)
    return {
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    };
  if (score >= 30)
    return {
      bar: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/50",
    };
  return {
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
  };
}

function distressChips(lead: ListLead) {
  const chips: { label: string; className: string }[] = [];
  if (lead.foreclosure)
    chips.push({
      label: "FC",
      className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    });
  if (lead.preForeclosure)
    chips.push({
      label: "Pre-FC",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    });
  if (lead.taxDelinquent)
    chips.push({
      label: "Tax",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    });
  if (lead.vacant)
    chips.push({
      label: "Vacant",
      className: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    });
  return chips;
}

export function LeadListPanel({
  leads,
  selectedLeadId,
  onSelectLead,
  loading = false,
}: LeadListPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 rounded-full bg-muted p-4">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-semibold">No leads match</h3>
        <p className="max-w-xs text-xs text-muted-foreground">
          Try clearing filters or pulling leads from a new ZIP code.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1.5 p-2">
        {leads.map((lead) => {
          const isSelected = lead.id === selectedLeadId;
          const styles = scoreStyles(lead.score);
          const chips = distressChips(lead);
          const phone = lead.phoneNumbers
            ? (() => {
                try {
                  const parsed = JSON.parse(lead.phoneNumbers);
                  return Array.isArray(parsed) ? parsed[0] : lead.phoneNumbers;
                } catch {
                  return lead.phoneNumbers;
                }
              })()
            : null;

          return (
            <button
              key={lead.id}
              data-lead-id={lead.id}
              onClick={() => onSelectLead(lead.id)}
              className={cn(
                "group flex flex-col gap-2 rounded-lg border p-3 text-left transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-muted/40"
                  : "border-border bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {lead.address}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <MapPin className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                    {lead.city}, {lead.state} {lead.zip}
                  </p>
                </div>
                {lead.score != null && (
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
                      styles.bg,
                      styles.text,
                    )}
                  >
                    {lead.score}
                  </div>
                )}
              </div>

              {/* Score bar */}
              {lead.score != null && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", styles.bar)}
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
              )}

              {/* Chips + contact */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {chips.map((chip) => (
                    <span
                      key={chip.label}
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        chip.className,
                      )}
                    >
                      {chip.label}
                    </span>
                  ))}
                  {lead.virtual && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      title="Surfaced from FlipOps freshness data. Click any action to add it to your leads."
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      New
                    </span>
                  )}
                  {(lead.dataSource === "parcel-auction-bridge" || lead.nextAuctionDate) && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                      title="Scheduled or recent foreclosure auction on this parcel."
                    >
                      <Gavel className="h-2.5 w-2.5" />
                      Auction
                    </span>
                  )}
                  {lead.dataSource === "parcel-probate-bridge" && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      title="Probate estate filing for this property."
                    >
                      <Scale className="h-2.5 w-2.5" />
                      Probate
                    </span>
                  )}
                  {chips.length === 0 && !lead.virtual && !lead.nextAuctionDate && lead.dataSource !== "parcel-auction-bridge" && lead.dataSource !== "parcel-probate-bridge" && (
                    <span className="text-[10px] text-muted-foreground">
                      No distress flags
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {phone && <Phone className="h-3 w-3" />}
                  {lead.emails && <Mail className="h-3 w-3" />}
                </div>
              </div>

              {/* Option A — owes-amount secondary line for tax-delinquent leads */}
              {lead.taxDelinquent && formatTaxAmountCompact(lead.taxDelinquentAmount) && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                  <Receipt className="h-3 w-3" />
                  <span>Owes {formatTaxAmountCompact(lead.taxDelinquentAmount)}</span>
                  {lead.taxDelinquentYearsCount != null && lead.taxDelinquentYearsCount > 1 && (
                    <span className="text-muted-foreground">
                      · {lead.taxDelinquentYearsCount}yr
                    </span>
                  )}
                </div>
              )}

              {/* M3.B — auction countdown secondary line */}
              {(() => {
                const countdown = formatAuctionCountdown(lead.nextAuctionDate);
                const showPast =
                  !countdown &&
                  lead.pastAuctionCount != null &&
                  lead.pastAuctionCount > 0;
                if (!countdown && !showPast) return null;
                return (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 tabular-nums">
                    <Gavel className="h-3 w-3" />
                    <span>{countdown ?? "Past auction"}</span>
                  </div>
                );
              })()}

              {/* M3.D — probate secondary line */}
              {lead.dataSource === "parcel-probate-bridge" && lead.decedentName && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 tabular-nums">
                  <Scale className="h-3 w-3" />
                  <span>Estate of {lead.decedentName}</span>
                  {lead.dateOfDeath && (
                    <span className="text-muted-foreground">
                      · d. {new Date(lead.dateOfDeath).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
