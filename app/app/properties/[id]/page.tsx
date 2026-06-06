"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  User,
  MapPin,
  Phone,
  Mail,
  Gavel,
  Flame,
  Receipt,
  Building,
  Calculator,
  FileSignature,
  Hammer,
  KeyRound,
  StickyNote,
  Calendar,
  DollarSign,
  CheckCircle2,
  Send,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// /app/properties/[id]
//
// Canonical single-property cross-section view — one page that shows
// everything tied to a Property across the acquisition → evaluation → offers
// → contract → renovation → disposition lifecycle. Linked to from the
// Contracts page "View Property" action (and any future deep-link).
// ---------------------------------------------------------------------------

interface PropertyRow {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string | null;
  ownerName?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  estimatedValue?: number | null;
  assessedValue?: number | null;
  score?: number | null;
  outreachStatus?: string | null;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
  bankruptcy?: boolean;
  absenteeOwner?: boolean;
  phoneNumbers?: string | null;
  emails?: string | null;
}

interface ContactNote {
  date: string | null;
  note: string;
  method: string | null;
  sentiment: string | null;
}

interface OfferRow {
  id: string;
  amount: number;
  status: string;
  terms?: string | null;
  sentAt?: string | null;
  responseAt?: string | null;
  responseNotes?: string | null;
  closingDate?: string | null;
  createdAt: string;
}

interface ContractRow {
  id: string;
  purchasePrice: number;
  status: string;
  closingDate?: string | null;
  signedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
}

interface DealAnalysisRow {
  id: string;
  arv: number;
  arvMethod: string;
  repairTotal: number;
  maxOffer: number;
  rule: string;
  name?: string | null;
  createdAt: string;
}

interface RenovationRow {
  id: string;
  address: string;
  status: string;
  maxExposureUsd: number;
  targetRoiPct: number;
  arv?: number | null;
  startAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

interface RentalRow {
  id: string;
  address: string;
  status: string;
  monthlyRent: number;
  leaseStart?: string | null;
  leaseEnd?: string | null;
  totalIncome: number;
  totalExpenses: number;
  createdAt: string;
}

interface TimelinePayload {
  property: PropertyRow;
  contactNotes: ContactNote[];
  offers: OfferRow[];
  contracts: ContractRow[];
  dealAnalyses: DealAnalysisRow[];
  renovations: RenovationRow[];
  rentals: RentalRow[];
}

// --- Lifecycle stages ------------------------------------------------------

type StageKey =
  | "leads"
  | "contacted"
  | "underwriting"
  | "offers"
  | "acquired"
  | "rehab"
  | "sold";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "contacted", label: "Contacted" },
  { key: "underwriting", label: "Underwriting" },
  { key: "offers", label: "Offers" },
  { key: "acquired", label: "Acquired" },
  { key: "rehab", label: "In Rehab" },
  { key: "sold", label: "Sold" },
];

function computeActiveStages(payload: TimelinePayload): Set<StageKey> {
  const active = new Set<StageKey>();
  // Every property is at minimum a lead
  active.add("leads");

  const { property, contactNotes, dealAnalyses, offers, contracts, renovations, rentals } = payload;

  const contacted =
    contactNotes.length > 0 ||
    (property.outreachStatus != null &&
      property.outreachStatus !== "not_contacted" &&
      property.outreachStatus !== "");
  if (contacted) active.add("contacted");

  if (dealAnalyses.length > 0) active.add("underwriting");
  if (offers.length > 0) active.add("offers");

  const hasActiveContract = contracts.some(
    (c) => c.status === "signed" || c.status === "escrow" || c.status === "closed",
  );
  const hasClosedContract = contracts.some((c) => c.status === "closed");
  if (hasActiveContract) active.add("acquired");

  const hasActiveReno = renovations.some(
    (r) => r.status === "active" || r.status === "planning" || r.status === "on_hold",
  );
  if (hasActiveReno) active.add("rehab");

  const hasCompletedReno = renovations.some((r) => r.status === "completed");
  const hasLeasedRental = rentals.some((r) => r.status === "leased");
  if (hasCompletedReno || hasLeasedRental || hasClosedContract) {
    // "Sold" here = property has exited the active-deal flow (either dispositioned
    // via flip, leased out as a rental, or contract closed for wholesale).
    if (hasCompletedReno || hasLeasedRental) active.add("sold");
  }

  return active;
}

// --- Helpers ---------------------------------------------------------------

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeParseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    return [];
  } catch {
    return [];
  }
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "bg-gray-100 text-gray-600 dark:bg-muted dark:text-gray-300";
  if (score >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (score >= 30) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    signed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    escrow: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    draft: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    countered: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    expired: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300",
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    planning: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300",
    on_hold: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    leased: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    vacant: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    maintenance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    listed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300";
  const label = status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return <Badge className={cn(cls, "border-0 font-medium")}>{label}</Badge>;
}

// --- Sub-components --------------------------------------------------------

function DistressChip({
  label,
  icon: Icon,
  active,
  color,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  color: string;
}) {
  if (!active) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1 border",
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function LifecycleStrip({ active }: { active: Set<StageKey> }) {
  return (
    <Card className="bg-card border">
      <CardContent className="p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STAGES.map((stage, idx) => {
            const isActive = active.has(stage.key);
            return (
              <div
                key={stage.key}
                className="flex items-center gap-1 flex-shrink-0"
              >
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-gray-50 text-gray-400 dark:bg-muted/40 dark:text-gray-500",
                  )}
                >
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                  )}
                  {stage.label}
                </div>
                {idx < STAGES.length - 1 && (
                  <span className="text-gray-300 dark:text-gray-600 text-xs">›</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function HeroSection({
  property,
}: {
  property: PropertyRow;
}) {
  const phones = safeParseList(property.phoneNumbers);
  const emails = safeParseList(property.emails);
  return (
    <Card className="bg-card border">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Home className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                  {property.address}
                </h1>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.city}, {property.state} {property.zip}
                  {property.county ? <span className="ml-1">· {property.county} County</span> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              {property.ownerName ? (
                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{property.ownerName}</span>
                </div>
              ) : null}
              {phones.length > 0 ? (
                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{phones[0]}</span>
                  {phones.length > 1 ? (
                    <span className="text-xs text-muted-foreground">+{phones.length - 1}</span>
                  ) : null}
                </div>
              ) : null}
              {emails.length > 0 ? (
                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate max-w-[200px]">{emails[0]}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <DistressChip
                label="Foreclosure"
                icon={Gavel}
                active={!!property.foreclosure}
                color="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-400"
              />
              <DistressChip
                label="Pre-Foreclosure"
                icon={Flame}
                active={!!property.preForeclosure}
                color="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400"
              />
              <DistressChip
                label="Tax Delinquent"
                icon={Receipt}
                active={!!property.taxDelinquent}
                color="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
              />
              <DistressChip
                label="Vacant"
                icon={Building}
                active={!!property.vacant}
                color="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
              />
              <DistressChip
                label="Absentee Owner"
                icon={User}
                active={!!property.absenteeOwner}
                color="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
              />
              <DistressChip
                label="Bankruptcy"
                icon={TrendingUp}
                active={!!property.bankruptcy}
                color="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-400"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="rounded-md bg-muted/40 dark:bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Beds / Baths</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {property.bedrooms ?? "—"} / {property.bathrooms ?? "—"}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 dark:bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sq Ft</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {property.squareFeet != null ? property.squareFeet.toLocaleString() : "—"}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 dark:bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Year Built</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {property.yearBuilt ?? "—"}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 dark:bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Value</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(property.estimatedValue ?? property.assessedValue)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-xl px-5 py-3 min-w-[88px]",
                scoreColor(property.score ?? null),
              )}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-80">Score</span>
              <span className="text-3xl font-bold tabular-nums leading-none mt-1">
                {property.score ?? "—"}
              </span>
            </div>
            <Link href="/app/underwriting">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Underwrite
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const colors: Record<string, string> = {
    positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    neutral: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300",
    negative: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <Badge className={cn("border-0 text-[10px]", colors[sentiment] ?? colors.neutral)}>
      {sentiment}
    </Badge>
  );
}

function ContactHistoryCard({
  propertyId,
  notes,
}: {
  propertyId: string;
  notes: ContactNote[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          Contact history
        </CardTitle>
        {notes.length > 0 ? (
          <Link href={`/app/dialer?leadId=${propertyId}`}>
            <Button size="sm" variant="ghost" className="gap-1.5 h-8">
              <Phone className="h-3.5 w-3.5" />
              Open in dialer
            </Button>
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {notes.length === 0 ? (
          <EmptyState
            compact
            icon={<MessageSquare className="h-6 w-6" />}
            title="No contact attempts yet"
            description="Reach out from the dialer to start logging conversation history."
            actionLabel="Open dialer"
            actionHref={`/app/dialer?leadId=${propertyId}`}
          />
        ) : (
          <div className="space-y-3">
            {notes.map((note, idx) => (
              <div
                key={idx}
                className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <StickyNote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(note.date)}</span>
                    {note.method ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {note.method}
                      </Badge>
                    ) : null}
                    <SentimentBadge sentiment={note.sentiment} />
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {note.note || <span className="text-muted-foreground italic">No notes</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DealAnalysesCard({
  propertyId,
  analyses,
}: {
  propertyId: string;
  analyses: DealAnalysisRow[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-emerald-500" />
          Deal analyses
        </CardTitle>
        {analyses.length > 0 ? (
          <Link href={`/app/underwriting?propertyId=${propertyId}`}>
            <Button size="sm" variant="ghost" className="gap-1.5 h-8">
              New analysis
            </Button>
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {analyses.length === 0 ? (
          <EmptyState
            compact
            icon={<Calculator className="h-6 w-6" />}
            title="No analyses yet"
            description="Run a comp + repair underwriting to set ARV and MAO."
            actionLabel="Start underwriting"
            actionHref={`/app/underwriting?propertyId=${propertyId}`}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name / Method</TableHead>
                <TableHead className="text-right">ARV</TableHead>
                <TableHead className="text-right">Repairs</TableHead>
                <TableHead className="text-right">MAO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{formatDate(a.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {a.name ?? "Untitled"}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {a.arvMethod}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {a.rule}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(a.arv)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(a.repairTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(a.maxOffer)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OffersCard({
  propertyId,
  offers,
}: {
  propertyId: string;
  offers: OfferRow[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Send className="h-4 w-4 text-amber-500" />
          Offers
        </CardTitle>
        {offers.length > 0 ? (
          <Link href={`/app/underwriting?propertyId=${propertyId}`}>
            <Button size="sm" variant="ghost" className="gap-1.5 h-8">
              New offer
            </Button>
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {offers.length === 0 ? (
          <EmptyState
            compact
            icon={<Send className="h-6 w-6" />}
            title="No offers yet"
            description="Underwrite this property, then create an offer from the deal worksheet."
            actionLabel="Create offer"
            actionHref={`/app/underwriting?propertyId=${propertyId}`}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(o.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(o.sentAt)}</TableCell>
                  <TableCell className="text-sm">
                    {o.responseAt ? (
                      <div className="flex flex-col">
                        <span>{formatDate(o.responseAt)}</span>
                        {o.responseNotes ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {o.responseNotes}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(o.closingDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ContractsCard({ contracts }: { contracts: ContractRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-purple-500" />
          Contracts
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {contracts.length === 0 ? (
          <EmptyState
            compact
            icon={<FileSignature className="h-6 w-6" />}
            title="No contracts yet"
            description="Contracts appear here when an offer is accepted and signed."
          />
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <FileSignature className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(c.purchasePrice)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(c.createdAt)}
                      {c.signedAt ? ` · Signed ${formatDate(c.signedAt)}` : ""}
                      {c.closedAt ? ` · Closed ${formatDate(c.closedAt)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.closingDate ? (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Closing
                      </p>
                      <p className="text-xs font-medium">{formatDate(c.closingDate)}</p>
                    </div>
                  ) : null}
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RenovationsAndRentalsCard({
  renovations,
  rentals,
}: {
  renovations: RenovationRow[];
  rentals: RentalRow[];
}) {
  if (renovations.length === 0 && rentals.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renovations.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Hammer className="h-4 w-4 text-orange-500" />
              Renovations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {renovations.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card/50 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Hammer className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{r.address}</span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Budget
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatCurrency(r.maxExposureUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Target ROI
                    </p>
                    <p className="font-semibold tabular-nums">{r.targetRoiPct}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      ARV
                    </p>
                    <p className="font-semibold tabular-nums">{formatCurrency(r.arv)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {rentals.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-500" />
              Rentals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {rentals.map((r) => {
              const cashFlow = r.totalIncome - r.totalExpenses;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-border bg-card/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{r.address}</span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Rent
                      </p>
                      <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {formatCurrency(r.monthlyRent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Cash flow
                      </p>
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          cashFlow >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {formatCurrency(cashFlow)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Lease ends
                      </p>
                      <p className="font-semibold">{formatDate(r.leaseEnd)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// --- Skeleton --------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-32" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// --- Page ------------------------------------------------------------------

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] = useState<TimelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/properties/${id}/timeline`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({} as { error?: string }));
          if (!cancelled) {
            setError(body?.error || `Failed to load property (${res.status})`);
            setData(null);
          }
          return;
        }
        const payload = (await res.json()) as TimelinePayload;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        console.error("Failed to load property timeline", err);
        if (!cancelled) {
          setError("Unable to load this property. Please try again.");
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
  }, [id]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-4 pb-8">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/app/leads"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leads
          </Link>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          (() => {
            const isVirtual = error.includes("Virtual");
            const isUnauthorized = /unauthorized/i.test(error);
            const title = isVirtual
              ? "Virtual lead"
              : isUnauthorized
                ? "Sign in to view this property"
                : "Property not found";
            const description = isVirtual
              ? "Promote this lead from /app/leads before viewing its detail page."
              : isUnauthorized
                ? "Your session may have expired. Sign in again to view this property."
                : "We couldn't find this property in your workspace. It may have been removed or never added.";
            const actionLabel = isUnauthorized ? "Sign In" : "Back to Leads";
            const actionHref = isUnauthorized ? "/sign-in" : "/app/leads";
            return (
              <Card>
                <CardContent className="py-12">
                  <EmptyState
                    icon={<Home className="h-8 w-8" />}
                    title={title}
                    description={description}
                    actionLabel={actionLabel}
                    actionHref={actionHref}
                  />
                </CardContent>
              </Card>
            );
          })()
        ) : data ? (
          <>
            <HeroSection property={data.property} />
            <LifecycleStrip active={computeActiveStages(data)} />
            <ContactHistoryCard propertyId={data.property.id} notes={data.contactNotes} />
            <DealAnalysesCard propertyId={data.property.id} analyses={data.dealAnalyses} />
            <OffersCard propertyId={data.property.id} offers={data.offers} />
            <ContractsCard contracts={data.contracts} />
            <RenovationsAndRentalsCard
              renovations={data.renovations}
              rentals={data.rentals}
            />
            {data.contracts.length === 0 &&
              data.renovations.length === 0 &&
              data.rentals.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    No acquisition activity yet — this property is still in the lead funnel.
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
