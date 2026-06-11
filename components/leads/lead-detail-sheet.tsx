"use client";

import {
  MapPin,
  Phone,
  Mail,
  User,
  Calculator,
  UserCheck,
  Send,
  StickyNote,
  X,
  Building,
  DollarSign,
  ExternalLink,
  Receipt,
  Calendar,
  Layers,
  Sparkles,
  Gavel,
  Scale,
  Database,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PipelineBreadcrumb,
  derivePipelineStage,
} from "@/components/shared/pipeline-breadcrumb";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// LeadDetailSheet — slide-out property detail with PipelineBreadcrumb
// + pipeline handoff actions (Skip Trace, Send to Underwriting, etc.).
// ---------------------------------------------------------------------------

export interface DetailLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName?: string;
  score?: number;
  phoneNumbers?: string;
  emails?: string;
  outreachStatus?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  estimatedValue?: number;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
  // Option A — tax-delinquent detail + virtual/promote
  taxDelinquentAmount?: number | null;
  taxDelinquentYearsCount?: number | null;
  taxDelinquentEarliestYear?: number | null;
  taxDelinquentLatestYear?: number | null;
  virtual?: boolean;
  partial?: boolean;
  apn?: string | null;
  countyFips?: string | null;
  grade?: string | null;
  motivation?: string | null;
  scoreBreakdown?: string | null;
  // M3.C — auction lead detail
  nextAuctionDate?: string | Date | null;
  openingBid?: number | null;
  judgmentAmount?: number | null;
  lastCaseNumber?: string | null;
  scheduledCount?: number | null;
  pastAuctionCount?: number | null;
  dataSource?: string | null;
  // M2.6 — provenance receipts (source key + per-signal capture dates from
  // the /api/properties UNION; null when the branch has no receipt).
  signalSource?: string | null;
  taxSignalCapturedAt?: string | null;
  auctionSignalCapturedAt?: string | null;
  // M2.4 — Layer-1 model propensity + ModelVersion label ("v1"). NULL/absent
  // = never scored (honest absence: the tooltip simply omits the line).
  propensity12mo?: number | null;
  propensityModel?: string | null;
  createdAt?: string;
}

interface ScoreSignal {
  type?: string;
  description?: string;
  weight?: number;
  points?: number;
}

interface ParsedScoreBreakdown {
  signals: ScoreSignal[];
  grade?: string;
  motivation?: string;
}

function parseScoreBreakdown(
  lead: DetailLead,
): ParsedScoreBreakdown {
  // 1) Try parsing the stored JSON (real Property rows).
  if (lead.scoreBreakdown) {
    try {
      const parsed = JSON.parse(lead.scoreBreakdown);
      if (parsed && Array.isArray(parsed.signals)) {
        return {
          signals: parsed.signals as ScoreSignal[],
          grade: parsed.grade ?? lead.grade ?? undefined,
          motivation: parsed.motivation ?? lead.motivation ?? undefined,
        };
      }
    } catch {
      // fall through to flag-based fallback
    }
  }

  // 2) Fallback: synthesize signals from the boolean flags. This is what
  //    virtual leads will use (the materialized aggregate doesn't carry the
  //    full signals JSON — only score/grade/motivation).
  const signals: ScoreSignal[] = [];
  if (lead.foreclosure) signals.push({ type: "FORECLOSURE", description: "Foreclosure", points: 25 });
  if (lead.preForeclosure) signals.push({ type: "PRE_FORECLOSURE", description: "Pre-foreclosure", points: 25 });
  if (lead.taxDelinquent) {
    const yrs = lead.taxDelinquentYearsCount ?? 1;
    const amt = lead.taxDelinquentAmount ?? 0;
    let points = 20;
    if (amt >= 25_000) points += 5;
    if (yrs >= 2) points += 5;
    signals.push({
      type: "TAX_DELINQUENT",
      description: `Tax delinquent · $${amt.toLocaleString()} over ${yrs}yr`,
      points,
    });
  }
  if (lead.vacant) signals.push({ type: "VACANT", description: "Vacant property", points: 15 });
  return {
    signals,
    grade: lead.grade ?? undefined,
    motivation: lead.motivation ?? undefined,
  };
}

interface LeadDetailSheetProps {
  lead: DetailLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkipTrace?: (id: string) => void;
  onSendToUnderwriting?: (id: string) => void;
  onAddToCampaign?: (id: string) => void;
  onLogContact?: (id: string) => void;
}

function parsePhoneOrEmail(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [raw];
  } catch {
    return [raw];
  }
}

function formatCurrency(n?: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

/** 0.234 → "23%"; one decimal below 10% so 0.009 reads "0.9%", not "1%". */
function formatPropensity(p: number): string {
  const pct = p * 100;
  return `${pct < 9.5 ? pct.toFixed(1) : String(Math.round(pct))}%`;
}

// ---------------------------------------------------------------------------
// M2.6 — per-signal provenance receipts.
// Maps machine source keys to human labels; unknown keys render as-is so
// newly-added sources surface automatically instead of silently hiding.
// ---------------------------------------------------------------------------
const SOURCE_LABELS: Record<string, string> = {
  "county-tax-roll": "County tax roll",
  "parcel-lien-bridge": "County tax roll",
  "realauction-fl-foreclosures": "RealAuction calendar",
  "parcel-auction-bridge": "RealAuction calendar",
  "parcel-zip-pull": "FL parcel records",
};

function sourceLabel(key?: string | null): string | null {
  if (!key) return null;
  return SOURCE_LABELS[key] ?? key;
}

function formatCapturedDate(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ProvenanceChip {
  signal: string;
  source: string;
  capturedAt: string | null; // pre-formatted; null = no receipt date known
}

/**
 * Build one receipt chip per distress signal present on the lead. Honest by
 * construction: chips only render when we have a real source key; capture
 * dates only render when the source table actually recorded one.
 */
function buildProvenanceChips(lead: DetailLead): ProvenanceChip[] {
  const chips: ProvenanceChip[] = [];
  const fallbackSource = sourceLabel(lead.signalSource ?? lead.dataSource);

  if (lead.taxDelinquent) {
    // taxSignalCapturedAt implies the county tax roll is the signal's origin
    // even when the row itself came from another branch (auction hybrid).
    const source = lead.taxSignalCapturedAt
      ? sourceLabel("county-tax-roll")
      : fallbackSource;
    if (source) {
      chips.push({
        signal: "Tax Delinquent",
        source,
        capturedAt: formatCapturedDate(lead.taxSignalCapturedAt),
      });
    }
  }

  const hasAuctionSignal =
    lead.foreclosure || lead.preForeclosure || lead.nextAuctionDate != null;
  if (hasAuctionSignal) {
    const source = lead.auctionSignalCapturedAt
      ? sourceLabel("realauction-fl-foreclosures")
      : fallbackSource;
    if (source) {
      chips.push({
        signal: lead.nextAuctionDate != null ? "Auction" : "Foreclosure",
        source,
        capturedAt: formatCapturedDate(lead.auctionSignalCapturedAt),
      });
    }
  }

  if (lead.vacant && fallbackSource) {
    chips.push({ signal: "Vacant", source: fallbackSource, capturedAt: null });
  }

  return chips;
}

function formatAuctionDate(d?: string | Date | null): {
  abs: string;
  rel: string;
} | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const abs = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  let rel: string;
  if (diffDays === 0) rel = "today";
  else if (diffDays === 1) rel = "tomorrow";
  else if (diffDays === -1) rel = "yesterday";
  else if (diffDays > 0) rel = `in ${diffDays} days`;
  else rel = `${Math.abs(diffDays)} days ago`;
  return { abs, rel };
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onSkipTrace,
  onSendToUnderwriting,
  onAddToCampaign,
  onLogContact,
}: LeadDetailSheetProps) {
  if (!lead) return null;

  const phones = parsePhoneOrEmail(lead.phoneNumbers);
  const emails = parsePhoneOrEmail(lead.emails);
  const needsSkipTrace = phones.length === 0 && emails.length === 0;

  const stage = derivePipelineStage({
    outreachStatus: lead.outreachStatus,
    hasAnalysis: false,
    hasOffer: false,
    hasSignedContract: false,
    isClosed: false,
  });

  const distressBadges: { label: string; color: string }[] = [];
  if (lead.foreclosure)
    distressBadges.push({
      label: "Foreclosure",
      color: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    });
  if (lead.preForeclosure)
    distressBadges.push({
      label: "Pre-Foreclosure",
      color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    });
  if (lead.taxDelinquent)
    distressBadges.push({
      label: "Tax Delinquent",
      color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    });
  if (lead.vacant)
    distressBadges.push({
      label: "Vacant",
      color: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    });

  const scoreBreakdown = parseScoreBreakdown(lead);

  // M2.6 — per-signal source + captured-date receipts.
  const provenanceChips = buildProvenanceChips(lead);

  const scoreColor =
    (lead.score ?? 0) >= 85
      ? "text-emerald-600 dark:text-emerald-400"
      : (lead.score ?? 0) >= 70
        ? "text-green-600 dark:text-green-400"
        : (lead.score ?? 0) >= 50
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        /* [&>button.absolute]:hidden suppresses the Sheet's built-in close button
           so we can render a custom one inside the header below. */
        className="w-full sm:max-w-lg p-0 bg-background [&>button.absolute]:hidden"
      >
        <VisuallyHidden>
          <SheetTitle>{lead.address}</SheetTitle>
        </VisuallyHidden>

        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">
                  {lead.address}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {lead.city}, {lead.state} {lead.zip}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4 mb-3">
              {lead.score != null && (
                <div
                  className="group relative cursor-help"
                  title="Hover for distress score breakdown"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    Score
                    {scoreBreakdown.grade && (
                      <span className="rounded bg-muted px-1 text-[9px] font-semibold tabular-nums">
                        {scoreBreakdown.grade}
                      </span>
                    )}
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", scoreColor)}>
                    {lead.score}
                  </div>

                  {/* Hover-card tooltip — pure CSS, no Radix popover needed */}
                  {scoreBreakdown.signals.length > 0 && (
                    <div className="invisible absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                      <div className="mb-2 font-semibold">Distress signals</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        {scoreBreakdown.signals.map((sig, i) => (
                          <div key={i} className="flex items-start justify-between gap-2">
                            <span className="text-foreground/80">
                              {sig.description ?? sig.type ?? "Signal"}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              +{sig.points ?? sig.weight ?? "?"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* M2.4 — Layer-1 learned propensity with model
                          provenance (SCORING-ARCHITECTURE invariants #1/#3).
                          Honest absence: no line when never scored. */}
                      {lead.propensity12mo != null && (
                        <div className="mt-2 border-t border-border pt-2 font-mono text-[11px] text-foreground/80">
                          P(sale 12mo):{" "}
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatPropensity(lead.propensity12mo)}
                          </span>
                          {lead.propensityModel ? ` — model ${lead.propensityModel}` : null}
                        </div>
                      )}
                      {scoreBreakdown.motivation && (
                        <div className="mt-2 border-t border-border pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Motivation: {scoreBreakdown.motivation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {lead.ownerName && (
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Owner
                  </div>
                  <div className="truncate text-sm font-medium flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {lead.ownerName}
                  </div>
                </div>
              )}
            </div>

            <PipelineBreadcrumb currentStage={stage} variant="compact" />
          </div>

          {/* Body */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-5 p-5">
              {/* Distress flags */}
              {distressBadges.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Distress Indicators
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {distressBadges.map((badge) => (
                      <span
                        key={badge.label}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {/* M2.6 — provenance receipts: where each signal came from
                      and when it was last captured. Dates only render when
                      the source table recorded one — no fabricated freshness. */}
                  {provenanceChips.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {provenanceChips.map((chip) => (
                        <div
                          key={chip.signal}
                          className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground"
                        >
                          <Database className="h-3 w-3 shrink-0" />
                          <span className="font-medium text-foreground/80">
                            {chip.signal}
                          </span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{chip.source}</span>
                          {chip.capturedAt && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="whitespace-nowrap">
                                captured {chip.capturedAt}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Property details grid */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Property Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <DetailCell
                    icon={Building}
                    label="Type"
                    value={
                      lead.bedrooms
                        ? `${lead.bedrooms}bd / ${lead.bathrooms ?? "?"}ba`
                        : "—"
                    }
                  />
                  <DetailCell
                    icon={Building}
                    label="Sq Ft"
                    value={
                      lead.squareFeet ? lead.squareFeet.toLocaleString() : "—"
                    }
                  />
                  <DetailCell
                    icon={DollarSign}
                    label="Est. Value"
                    value={formatCurrency(lead.estimatedValue)}
                  />
                  <DetailCell
                    icon={Building}
                    label="Year Built"
                    value={lead.yearBuilt ? String(lead.yearBuilt) : "—"}
                  />

                  {/* Option A — tax-delinquent detail rows */}
                  {lead.taxDelinquent && lead.taxDelinquentAmount != null && lead.taxDelinquentAmount > 0 && (
                    <DetailCell
                      icon={Receipt}
                      label="Tax Owed"
                      value={formatCurrency(lead.taxDelinquentAmount)}
                    />
                  )}
                  {lead.taxDelinquent && lead.taxDelinquentEarliestYear && (
                    <DetailCell
                      icon={Calendar}
                      label="Delinquent Since"
                      value={String(lead.taxDelinquentEarliestYear)}
                    />
                  )}
                  {lead.taxDelinquent && (lead.taxDelinquentYearsCount ?? 0) > 1 && (
                    <DetailCell
                      icon={Layers}
                      label="Years Owed"
                      value={`${lead.taxDelinquentYearsCount} certificates`}
                    />
                  )}

                  {/* M3.C — auction lead detail rows */}
                  {(() => {
                    const auctionDate = formatAuctionDate(lead.nextAuctionDate);
                    return auctionDate ? (
                      <DetailCell
                        icon={Gavel}
                        label="Auction Date"
                        value={`${auctionDate.abs} (${auctionDate.rel})`}
                        valueClassName="text-red-600 dark:text-red-400"
                      />
                    ) : null;
                  })()}
                  {lead.openingBid != null && lead.openingBid > 0 && (
                    <DetailCell
                      icon={DollarSign}
                      label="Opening Bid"
                      value={formatCurrency(lead.openingBid)}
                    />
                  )}
                  {lead.judgmentAmount != null && lead.judgmentAmount > 0 && (
                    <DetailCell
                      icon={Scale}
                      label="Judgment Amount"
                      value={formatCurrency(lead.judgmentAmount)}
                    />
                  )}
                </div>

                {/* M3.C — foreclosure case caption */}
                {lead.lastCaseNumber && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Foreclosure case # {lead.lastCaseNumber}
                  </p>
                )}

                {/* Virtual-lead badge — disclosure that this lead came from
                    freshness-layer data and will be added to the user's
                    leads on first action */}
                {lead.virtual && lead.dataSource !== "parcel-auction-bridge" && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      <strong>Surfaced lead.</strong> This property hasn't been added to your leads yet.
                      The first action (Skip Trace, Log Contact, Send to Dialer, Underwriting) will save it
                      to your workspace.
                    </span>
                  </div>
                )}

                {/* M3.C — auction-specific virtual-lead disclosure */}
                {lead.virtual && lead.dataSource === "parcel-auction-bridge" && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      <strong>Surfaced from FL auction calendar.</strong> First action saves it to your workspace.
                    </span>
                  </div>
                )}
              </section>

              {/* Contact info */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                  <span>Contact Info</span>
                  {needsSkipTrace && (
                    <Badge variant="outline" className="text-[10px]">
                      Needs skip trace
                    </Badge>
                  )}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {phones.map((p) => (
                    <a
                      key={p}
                      href={`tel:${p}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{p}</span>
                      <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                  {emails.map((e) => (
                    <a
                      key={e}
                      href={`mailto:${e}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{e}</span>
                      <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                  {needsSkipTrace && (
                    <p className="text-xs text-muted-foreground italic">
                      No contact info on file. Run skip trace below.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>

          {/* Action footer */}
          <div className="shrink-0 border-t border-border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSkipTrace?.(lead.id)}
                className={cn(
                  "gap-1.5",
                  needsSkipTrace &&
                    "border-primary/50 text-primary hover:bg-primary/10",
                )}
              >
                <UserCheck className="h-4 w-4" />
                Skip Trace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLogContact?.(lead.id)}
                className="gap-1.5"
              >
                <StickyNote className="h-4 w-4" />
                Log Contact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToCampaign?.(lead.id)}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                Send to Dialer
              </Button>
              <Button
                size="sm"
                onClick={() => onSendToUnderwriting?.(lead.id)}
                className="gap-1.5"
              >
                <Calculator className="h-4 w-4" />
                Underwrite
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailCell({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("text-sm font-medium truncate", valueClassName)}>{value}</div>
    </div>
  );
}
