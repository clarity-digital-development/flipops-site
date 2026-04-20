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

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
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
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Score
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", scoreColor)}>
                    {lead.score}
                  </div>
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
                </div>
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
                Add to Campaign
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
