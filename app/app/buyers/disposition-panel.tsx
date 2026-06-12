"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Home,
  DollarSign,
  Gauge,
  CheckCircle2,
  Circle,
  UserCheck,
  Pencil,
  Save,
  Trash2,
  Tag,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  computeNetSheet,
  listVsArv,
  DEFAULT_PREP_CHECKLIST,
  type PrepChecklistItem,
  type VarianceDirection,
} from "@/lib/disposition/net-sheet";

// ============================================================================
// DTO INTERFACES — re-declared locally to match the SHARED CONTRACT exactly.
// The API route file does not export these; the shapes here are authoritative
// for consumption only and MUST stay in lock-step with the contract.
// ============================================================================

interface AvmDTO {
  estimatedValue: number;
  lowEstimate: number | null;
  highEstimate: number | null;
}

interface ListingPropertyDTO {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  countyFips: string | null;
  apn: string | null;
}

type ListingStatus = "prepping" | "listed" | "pending" | "sold" | "cancelled";

interface DispositionListingDTO {
  id: string;
  propertyId: string;
  status: ListingStatus;
  property: ListingPropertyDTO;
  listAgentName: string | null;
  listAgentBrokerage: string | null;
  listAgentPhone: string | null;
  listAgentEmail: string | null;
  listPrice: number | null;
  listedAt: string | null;
  arvAtList: number | null;
  avm: AvmDTO | null;
  commissionPct: number;
  closingCostPct: number;
  payoffAmount: number;
  soldPrice: number | null;
  soldAt: string | null;
  prepChecklist: PrepChecklistItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contractId: string | null;
  dealSpecId: string | null;
  purchasePrice: number | null;
}

interface CandidateDTO {
  dealSpecId: string;
  propertyId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  completedAt: string | null;
  renovationArv: number | null;
  avm: AvmDTO | null;
  contractId: string | null;
  purchasePrice: number | null;
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

const fmtCurrency = (n: number | null | undefined): string =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const fmtPct = (n: number): string =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

const STATUS_PIPELINE: { key: ListingStatus; label: string }[] = [
  { key: "prepping", label: "Prepping" },
  { key: "listed", label: "Listed" },
  { key: "pending", label: "Pending" },
  { key: "sold", label: "Sold" },
];

const varianceStyles: Record<
  VarianceDirection,
  { badge: string; icon: React.ReactNode }
> = {
  above: {
    badge:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: <TrendingUp className="h-3 w-3" />,
  },
  below: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: <TrendingDown className="h-3 w-3" />,
  },
  inline: {
    badge: "bg-gray-500/10 text-muted-foreground border-border",
    icon: <Minus className="h-3 w-3" />,
  },
};

// ============================================================================
// MAIN PANEL
// ============================================================================

export default function DispositionPanel({
  className,
}: {
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<DispositionListingDTO[]>([]);
  const [candidates, setCandidates] = useState<CandidateDTO[]>([]);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const [listRes, candRes] = await Promise.all([
        fetch("/api/disposition", { cache: "no-store" }),
        fetch("/api/disposition/candidates", { cache: "no-store" }),
      ]);
      if (!listRes.ok) throw new Error("Failed to load listings");
      if (!candRes.ok) throw new Error("Failed to load candidates");
      const listJson = (await listRes.json()) as {
        listings: DispositionListingDTO[];
      };
      const candJson = (await candRes.json()) as { candidates: CandidateDTO[] };
      setListings(listJson.listings ?? []);
      setCandidates(candJson.candidates ?? []);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load disposition data",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await refetch();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refetch]);

  // PATCH a single listing; optimistic-light: refetch on success.
  const patchListing = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch(`/api/disposition/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Update failed");
        const json = (await res.json()) as { listing: DispositionListingDTO };
        setListings((prev) =>
          prev.map((l) => (l.id === id ? json.listing : l)),
        );
        return true;
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Update failed");
        return false;
      }
    },
    [],
  );

  const createListing = useCallback(
    async (cand: CandidateDTO) => {
      setCreatingId(cand.dealSpecId);
      try {
        const res = await fetch("/api/disposition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealSpecId: cand.dealSpecId }),
        });
        if (!res.ok) throw new Error("Could not create listing");
        const json = (await res.json()) as {
          listing: DispositionListingDTO;
          created: boolean;
        };
        toast.success(
          json.created
            ? `Listing created for ${cand.address}`
            : `Listing already exists for ${cand.address}`,
        );
        await refetch();
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Could not create listing",
        );
      } finally {
        setCreatingId(null);
      }
    },
    [refetch],
  );

  const deleteListing = useCallback(
    async (id: string, address: string) => {
      if (
        !confirm(
          `Delete the disposition listing for ${address}? This cannot be undone.`,
        )
      )
        return;
      try {
        const res = await fetch(`/api/disposition/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setListings((prev) => prev.filter((l) => l.id !== id));
        toast.success("Listing deleted");
        // Candidate may re-appear if dealSpec still completed.
        refetch();
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [refetch],
  );

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-20 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading disposition pipeline…
      </div>
    );
  }

  if (candidates.length === 0 && listings.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Tag className="h-10 w-10" />}
          title="No dispositions yet"
          description="When a renovation deal is marked completed, it shows up here ready to list. Track agent handoff, prep, pricing, and the sale-side net sheet all in one place."
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {/* SECTION A — Ready to list */}
      {candidates.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold tracking-tight">
              Ready to list
            </h3>
            <Badge variant="secondary" className="ml-1">
              {candidates.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((cand) => (
              <CandidateCard
                key={cand.dealSpecId}
                candidate={cand}
                creating={creatingId === cand.dealSpecId}
                onCreate={() => createListing(cand)}
              />
            ))}
          </div>
        </section>
      )}

      {candidates.length > 0 && listings.length > 0 && <Separator />}

      {/* SECTION B — Active listings */}
      {listings.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold tracking-tight">
              Active listings
            </h3>
            <Badge variant="secondary" className="ml-1">
              {listings.length}
            </Badge>
          </div>
          <div className="space-y-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPatch={patchListing}
                onDelete={deleteListing}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// SECTION A — Candidate card
// ============================================================================

function CandidateCard({
  candidate,
  creating,
  onCreate,
}: {
  candidate: CandidateDTO;
  creating: boolean;
  onCreate: () => void;
}) {
  const locale = [candidate.city, candidate.state, candidate.zip]
    .filter(Boolean)
    .join(", ");
  return (
    <Card className="border-amber-200/40 dark:border-amber-900/40 bg-white dark:bg-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Home className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {candidate.address}
            </p>
            {locale && (
              <p className="text-xs text-muted-foreground truncate">{locale}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="Completed" value={fmtDate(candidate.completedAt)} />
          <Metric
            label="Reno ARV"
            value={fmtCurrency(candidate.renovationArv)}
          />
          <Metric
            label="AVM est."
            value={fmtCurrency(candidate.avm?.estimatedValue ?? null)}
          />
          <Metric
            label="Purchase"
            value={fmtCurrency(candidate.purchasePrice)}
          />
        </div>

        <Button
          size="sm"
          className="w-full"
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Create Listing
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ============================================================================
// SECTION B — Listing card
// ============================================================================

function ListingCard({
  listing,
  onPatch,
  onDelete,
}: {
  listing: DispositionListingDTO;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: string, address: string) => void;
}) {
  const p = listing.property;
  const locale = [p.city, p.state, p.zip].filter(Boolean).join(", ");
  const isCancelled = listing.status === "cancelled";
  const isSold = listing.status === "sold";

  // ---- Pricing local state (PATCH on commit) ----
  const [listPriceInput, setListPriceInput] = useState<string>(
    listing.listPrice != null ? String(listing.listPrice) : "",
  );
  const [commissionInput, setCommissionInput] = useState<string>(
    String(listing.commissionPct),
  );
  const [closingInput, setClosingInput] = useState<string>(
    String(listing.closingCostPct),
  );
  const [payoffInput, setPayoffInput] = useState<string>(
    String(listing.payoffAmount),
  );

  // Keep inputs in sync when the listing object is replaced after a PATCH.
  useEffect(() => {
    setListPriceInput(listing.listPrice != null ? String(listing.listPrice) : "");
    setCommissionInput(String(listing.commissionPct));
    setClosingInput(String(listing.closingCostPct));
    setPayoffInput(String(listing.payoffAmount));
  }, [
    listing.listPrice,
    listing.commissionPct,
    listing.closingCostPct,
    listing.payoffAmount,
  ]);

  // ---- Agent editing ----
  const [editingAgent, setEditingAgent] = useState(false);
  const [agentName, setAgentName] = useState(listing.listAgentName ?? "");
  const [agentBrokerage, setAgentBrokerage] = useState(
    listing.listAgentBrokerage ?? "",
  );
  const [agentPhone, setAgentPhone] = useState(listing.listAgentPhone ?? "");
  const [agentEmail, setAgentEmail] = useState(listing.listAgentEmail ?? "");

  const effectiveListPrice = listing.listPrice ?? 0;
  const arvForVariance =
    listing.arvAtList ?? listing.avm?.estimatedValue ?? 0;
  const variance = listVsArv(effectiveListPrice, arvForVariance);

  // Net sheet — use soldPrice when sold, else listPrice.
  const netBasis = isSold
    ? listing.soldPrice ?? 0
    : listing.listPrice ?? 0;
  const net = computeNetSheet({
    salePrice: netBasis,
    commissionPct: listing.commissionPct,
    closingCostPct: listing.closingCostPct,
    payoffAmount: listing.payoffAmount,
  });

  // ---- Prep checklist ----
  const checklist: PrepChecklistItem[] =
    listing.prepChecklist && listing.prepChecklist.length > 0
      ? listing.prepChecklist
      : DEFAULT_PREP_CHECKLIST.map((c) => ({ ...c, done: false }));
  const doneCount = checklist.filter((c) => c.done).length;

  const toggleChecklistItem = (key: string) => {
    const next = checklist.map((c) =>
      c.key === key ? { ...c, done: !c.done } : c,
    );
    onPatch(listing.id, { prepChecklist: next });
  };

  const commitNumber = (
    raw: string,
    field: string,
    current: number | null,
  ) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && Number.isNaN(parsed)) {
      toast.error("Enter a valid number");
      return;
    }
    if (parsed === current) return; // no-op
    onPatch(listing.id, { [field]: parsed });
  };

  const setStatus = (status: ListingStatus) => {
    if (status === listing.status) return;
    onPatch(listing.id, { status });
  };

  const markSold = () => {
    const raw = prompt(
      "Sold price?",
      listing.listPrice != null ? String(listing.listPrice) : "",
    );
    if (raw == null) return;
    const soldPrice = Number(raw.trim());
    if (!raw.trim() || Number.isNaN(soldPrice) || soldPrice <= 0) {
      toast.error("Enter a valid sold price");
      return;
    }
    onPatch(listing.id, { status: "sold", soldPrice }).then((ok) => {
      if (ok) toast.success("Marked sold");
    });
  };

  const saveAgent = async () => {
    const ok = await onPatch(listing.id, {
      listAgentName: agentName.trim() || null,
      listAgentBrokerage: agentBrokerage.trim() || null,
      listAgentPhone: agentPhone.trim() || null,
      listAgentEmail: agentEmail.trim() || null,
    });
    if (ok) {
      setEditingAgent(false);
      toast.success("Agent saved");
    }
  };

  return (
    <Card
      className={cn(
        "bg-white dark:bg-card",
        isCancelled && "opacity-60",
        isSold &&
          "border-emerald-200/50 dark:border-emerald-900/50",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            <Home className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight truncate">
                {p.address}
              </CardTitle>
              {locale && (
                <p className="text-xs text-muted-foreground truncate">
                  {locale}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-muted-foreground">
                {p.propertyType && <span>{p.propertyType}</span>}
                {p.bedrooms != null && <span>{p.bedrooms} bd</span>}
                {p.bathrooms != null && <span>{p.bathrooms} ba</span>}
                {p.squareFeet != null && (
                  <span>{p.squareFeet.toLocaleString()} sqft</span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-rose-500 shrink-0"
            onClick={() => onDelete(listing.id, p.address)}
            aria-label="Delete listing"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status pipeline */}
        <div className="flex items-center gap-1">
          {STATUS_PIPELINE.map((stage, i) => {
            const currentIdx = STATUS_PIPELINE.findIndex(
              (s) => s.key === listing.status,
            );
            const isActive = stage.key === listing.status;
            const isPast = !isCancelled && i < currentIdx;
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => setStatus(stage.key)}
                  className={cn(
                    "flex-1 text-[11px] font-medium rounded-md px-2 py-1.5 transition-colors border",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary",
                    isPast &&
                      "bg-primary/10 text-primary border-primary/30",
                    !isActive &&
                      !isPast &&
                      "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
                  )}
                >
                  {stage.label}
                </button>
                {i < STATUS_PIPELINE.length - 1 && (
                  <span className="px-0.5 text-muted-foreground">›</span>
                )}
              </div>
            );
          })}
        </div>
        {isCancelled && (
          <Badge variant="secondary" className="text-rose-500">
            Cancelled
          </Badge>
        )}

        {/* Prep checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prep checklist
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneCount}/{checklist.length} ready
            </span>
          </div>
          <Progress
            value={(doneCount / Math.max(1, checklist.length)) * 100}
            className="h-1.5"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
            {checklist.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleChecklistItem(item.key)}
                className="flex items-center gap-2 text-left text-xs group"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground" />
                )}
                <span
                  className={cn(
                    item.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Agent handoff */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" />
              Listing agent
            </span>
            {!editingAgent ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingAgent(true)}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={saveAgent}
              >
                <Save className="h-3 w-3" /> Save
              </Button>
            )}
          </div>

          {editingAgent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Name</Label>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent name"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Brokerage
                </Label>
                <Input
                  value={agentBrokerage}
                  onChange={(e) => setAgentBrokerage(e.target.value)}
                  placeholder="Brokerage"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Phone</Label>
                <Input
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Email</Label>
                <Input
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="Email"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : listing.listAgentName ||
            listing.listAgentBrokerage ||
            listing.listAgentPhone ||
            listing.listAgentEmail ? (
            <div className="text-xs space-y-0.5">
              <p className="font-medium">
                {listing.listAgentName || "Unnamed agent"}
                {listing.listAgentBrokerage && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {listing.listAgentBrokerage}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground">
                {[listing.listAgentPhone, listing.listAgentEmail]
                  .filter(Boolean)
                  .join("  ·  ") || "No contact info"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No agent assigned yet.
            </p>
          )}
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            Pricing
          </span>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                List price
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  value={listPriceInput}
                  onChange={(e) => setListPriceInput(e.target.value)}
                  onBlur={() =>
                    commitNumber(listPriceInput, "listPrice", listing.listPrice)
                  }
                  placeholder="0"
                  className="h-8 w-36 pl-7 text-xs tabular-nums"
                />
              </div>
            </div>
            {variance && (
              <Badge
                variant="outline"
                className={cn(
                  "h-7 gap-1 mb-0.5",
                  varianceStyles[variance.direction].badge,
                )}
              >
                {varianceStyles[variance.direction].icon}
                {fmtPct(variance.pct)} vs ARV
                <span className="opacity-70">
                  ({variance.diff >= 0 ? "+" : ""}
                  {fmtCurrency(variance.diff)})
                </span>
              </Badge>
            )}
          </div>
        </div>

        {/* Net sheet waterfall */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            Sale net sheet {isSold && <span className="normal-case">(sold)</span>}
          </div>
          <div className="space-y-1 text-xs">
            <WaterfallLine
              label={isSold ? "Sold price" : "Sale price"}
              value={net.salePrice}
            />
            <WaterfallLine
              label={`Commission (${listing.commissionPct}%)`}
              value={-net.commission}
              muted
            />
            <WaterfallLine
              label={`Closing costs (${listing.closingCostPct}%)`}
              value={-net.closingCosts}
              muted
            />
            <WaterfallLine label="Payoff" value={-net.payoff} muted />
            <Separator className="my-1" />
            <WaterfallLine
              label="Net proceeds"
              value={net.netProceeds}
              emphasis
            />
          </div>

          {/* Editable assumptions */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <AssumptionInput
              label="Comm %"
              value={commissionInput}
              onChange={setCommissionInput}
              onCommit={() =>
                commitNumber(
                  commissionInput,
                  "commissionPct",
                  listing.commissionPct,
                )
              }
            />
            <AssumptionInput
              label="Closing %"
              value={closingInput}
              onChange={setClosingInput}
              onCommit={() =>
                commitNumber(
                  closingInput,
                  "closingCostPct",
                  listing.closingCostPct,
                )
              }
            />
            <AssumptionInput
              label="Payoff $"
              value={payoffInput}
              onChange={setPayoffInput}
              onCommit={() =>
                commitNumber(payoffInput, "payoffAmount", listing.payoffAmount)
              }
            />
          </div>
        </div>

        {/* Footer actions */}
        {!isSold && !isCancelled && (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={markSold}>
              <DollarSign className="h-3.5 w-3.5" /> Mark Sold
            </Button>
          </div>
        )}
        {isSold && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sold {fmtDate(listing.soldAt)}</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
              {fmtCurrency(listing.soldPrice)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SMALL PRESENTATION HELPERS
// ============================================================================

function WaterfallLine({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          muted && "text-muted-foreground",
          emphasis && "font-semibold",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          muted && "text-muted-foreground",
          emphasis && "font-semibold",
          emphasis && value >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : emphasis && "text-rose-500",
        )}
      >
        {value < 0 ? "−" : ""}
        {fmtCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

function AssumptionInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="h-7 text-xs tabular-nums"
      />
    </div>
  );
}
