"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import {
  LeadFilterBar,
  type DistressFilter,
} from "@/components/leads/lead-filter-bar";
import { LeadListPanel } from "@/components/leads/lead-list-panel";
import { LeadsMap } from "@/components/leads/leads-map";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { type Property } from "./seed-data";
import { trackLeadEvent, trackLeadsViewed } from "@/lib/behavior/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Clock, Gavel, Home, Search } from "lucide-react";

// ---------------------------------------------------------------------------
// Leads page — map-first redesign.
// Two-pane layout: filterable list on the left, pin-rendered Mapbox on the right.
// Clicking a lead (list or pin) opens a slide-out drawer with pipeline actions.
// ---------------------------------------------------------------------------

export default function LeadsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [zip, setZip] = useState("");
  const [distress, setDistress] = useState<Set<DistressFilter>>(new Set());
  const [scoreMin, setScoreMin] = useState(0);
  const [taxOwedMin, setTaxOwedMin] = useState(0);

  // Selection state — `selectedId` keeps the map pin highlighted even after
  // the detail sheet is closed. `sheetOpen` toggles the drawer only.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Option A — total exposure stat (sum of taxDelinquentAmount across filtered).
  // Surfaces the "real money this view represents" headline for demos.

  // ------------------------------------------------------------------------
  // Fetch properties — strictly real data. When the API returns zero rows
  // or errors, the UI surfaces an EmptyState instead of fabricated seed data.
  // ------------------------------------------------------------------------
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/properties");
      if (!res.ok) {
        setProperties([]);
        return;
      }
      const data = await res.json();
      const list: Property[] = data.properties ?? [];
      setProperties(list);
      // Behavioral: leads that appeared in the user's session are "viewed."
      // (Deduped per session inside the helper.)
      trackLeadsViewed(list);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ------------------------------------------------------------------------
  // M2.6 — freshness header. Piggybacks on /api/data-health (10-min server
  // cache, no duplicated queries) and takes MAX(lastRunAt) across sources.
  // Best-effort: when the endpoint is unavailable the caption simply hides.
  // ------------------------------------------------------------------------
  const [dataCurrentAsOf, setDataCurrentAsOf] = useState<Date | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/data-health");
        if (!res.ok) return;
        const data = await res.json();
        const newest = ((data.sources ?? []) as { lastRunAt: string | null }[])
          .map((s) => (s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0))
          .reduce((a, b) => Math.max(a, b), 0);
        if (!cancelled && newest > 0) setDataCurrentAsOf(new Date(newest));
      } catch {
        // best-effort — header renders without the freshness caption
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------------------
  // Filter pipeline — ZIP + distress chips + score threshold, memoized.
  // ------------------------------------------------------------------------
  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (zip && zip.length === 5 && p.zip !== zip) return false;
      if (scoreMin > 0 && (p.score ?? 0) < scoreMin) return false;
      if (taxOwedMin > 0 && (p.taxDelinquentAmount ?? 0) < taxOwedMin) return false;
      if (distress.size > 0) {
        // Auction Scheduled (M3): a property qualifies when it has a future-
        // scheduled auction. Two signals can confirm this:
        //   1. dataSource === 'parcel-auction-bridge' (rows surfaced via the
        //      /api/properties UNION from AuctionSummary), OR
        //   2. nextAuctionDate is present AND not in the past
        // Either is sufficient — the bridge-source check covers virtual rows,
        // the date check covers real Property rows that have been promoted
        // but still carry the auction signal.
        const now = Date.now();
        const auctionScheduledMatch =
          p.dataSource === "parcel-auction-bridge" ||
          (p.nextAuctionDate !== undefined &&
            p.nextAuctionDate !== null &&
            new Date(p.nextAuctionDate).getTime() >= now);

        const matchesAny =
          (distress.has("foreclosure") && p.foreclosure) ||
          (distress.has("preForeclosure") && p.preForeclosure) ||
          (distress.has("taxDelinquent") && p.taxDelinquent) ||
          (distress.has("vacant") && p.vacant) ||
          (distress.has("auctionScheduled") && auctionScheduledMatch);
        if (!matchesAny) return false;
      }
      return true;
    });
  }, [properties, zip, scoreMin, taxOwedMin, distress]);

  // Total tax-owed exposure across the filtered view — the demo-friendly
  // "this user is looking at $X in motivated owners" headline.
  const totalTaxExposure = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.taxDelinquentAmount ?? 0), 0),
    [filtered],
  );
  const virtualCount = useMemo(
    () => filtered.filter((p) => p.virtual).length,
    [filtered],
  );
  const auctionScheduledCount = useMemo(() => {
    const now = Date.now();
    return filtered.filter(
      (p) =>
        p.dataSource === "parcel-auction-bridge" ||
        (p.nextAuctionDate !== undefined &&
          p.nextAuctionDate !== null &&
          new Date(p.nextAuctionDate).getTime() >= now),
    ).length;
  }, [filtered]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  // ------------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------------

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
    // Behavioral: opening the detail drawer is a stronger signal than just viewing.
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("opened", lead);
  };

  const handleClearFilters = () => {
    setZip("");
    setDistress(new Set());
    setScoreMin(0);
    setTaxOwedMin(0);
  };

  // ------------------------------------------------------------------------
  // Promote-on-engagement (Option A Phase A5)
  //
  // Wraps a leadId-taking action handler. If the lead is virtual, POST to
  // /api/properties/promote first, swap the virtual id for the real Property
  // id in local state and selection, then forward the call with the real id.
  //
  // Idempotent — a second click on an already-promoted lead is a no-op
  // server-side. Failures fall back to running the action with the virtual
  // id so the user isn't blocked (the action may degrade gracefully or
  // surface its own error).
  // ------------------------------------------------------------------------
  const promoteIfVirtual = useCallback(
    async (id: string): Promise<string> => {
      const lead = properties.find((p) => p.id === id);
      if (!lead || !lead.virtual) return id;
      if (!lead.countyFips || !lead.apn) return id; // Can't promote without the bridge keys

      try {
        const res = await fetch("/api/properties/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countyFips: lead.countyFips, apn: lead.apn }),
        });
        if (!res.ok) return id;
        const data = await res.json();
        const real = data.property as Property | undefined;
        if (!real?.id) return id;

        // Swap the virtual row for the real one in local state.
        setProperties((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...real, virtual: false, partial: false }
              : p,
          ),
        );
        // Update selection if we just promoted the selected lead.
        if (selectedId === id) setSelectedId(real.id);
        // Behavioral: promotion is a meaningful conversion signal — the user
        // is converting a surfaced freshness-layer lead into a real workspace
        // lead. Track it so the personalization engine learns what kinds of
        // surfaced leads convert.
        void trackLeadEvent("saved", real, {
          source: "virtual_promote",
          countyFips: lead.countyFips ?? undefined,
        });
        return real.id;
      } catch {
        return id;
      }
    },
    [properties, selectedId],
  );

  const withPromote = useCallback(
    (
      handler: (id: string) => unknown | Promise<unknown>,
    ): ((id: string) => Promise<void>) => {
      return async (id: string) => {
        const realId = await promoteIfVirtual(id);
        await handler(realId);
      };
    },
    [promoteIfVirtual],
  );

  const handleZipSearch = () => {
    if (!zip || zip.length !== 5) return;
    // Pull every parcel in this ZIP from the FL Parcel table (10.8M rows, all
    // 67 counties). Non-FL ZIPs are denied server-side with a humane message.
    void (async () => {
      try {
        const res = await fetch("/api/leads/pull-by-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({
            title: "Can't pull that ZIP yet",
            description:
              typeof data?.error === "string"
                ? data.error
                : "Try a Florida ZIP for now — national coverage is coming.",
            variant: "destructive",
          });
          return;
        }
        const list: Property[] = data.properties ?? [];
        setProperties(list);
        trackLeadsViewed(list);
        toast({
          title: `Pulled ${data.count ?? list.length} leads in ${zip}`,
          description:
            list.length === 0
              ? "No parcels indexed for that ZIP yet."
              : `Showing the top ${list.length} scored parcels in ${zip}.`,
        });
      } catch {
        toast({
          title: "Pull failed",
          description: "Network hiccup. Try again shortly.",
          variant: "destructive",
        });
      }
    })();
  };

  const handleSkipTrace = async (id: string) => {
    const target = properties.find((p) => p.id === id);
    if (target) void trackLeadEvent("enriched", target, { kind: "skip_trace" });
    try {
      const res = await fetch(`/api/properties/${id}/enrich`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Best-effort: refresh just this lead row by re-fetching the list. The
        // enrich endpoint returns the updated Property row so we could splice
        // it in directly, but a full refresh keeps virtual/dedup logic honest.
        await fetchProperties();
        toast({
          title: "Skip trace complete",
          description: `${data.phoneCount ?? 0} phones, ${data.emailCount ?? 0} emails found.`,
        });
        // Activity log (Lane 3: userId is source of truth, no Team gate).
        void fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "skip_trace_run", propertyId: id }),
        }).catch(() => {});
        return;
      }
      if (res.status === 503) {
        toast({
          title: "Skip trace not configured",
          description: "Set BATCHDATA_API_KEY in env to enable owner contact lookup.",
          variant: "destructive",
        });
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast({
        title: "Skip trace failed",
        description: body?.error ?? `Status ${res.status} — try again shortly.`,
        variant: "destructive",
      });
    } catch (err) {
      toast({
        title: "Skip trace failed",
        description: "Network hiccup. Try again shortly.",
        variant: "destructive",
      });
    }
  };

  const handleSendToUnderwriting = (id: string) => {
    // Behavioral: strongest positive signal — user is investing time analyzing.
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("pursued", lead, { destination: "underwriting" });
    // Activity log (Lane 3): fire BEFORE router.push so the request is in
    // flight before navigation tears down the page (fetch survives the nav).
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sent_to_underwriting", propertyId: id }),
    }).catch(() => {});
    router.push(`/app/underwriting?propertyId=${encodeURIComponent(id)}`);
  };

  const handleAddToCampaign = (id: string) => {
    // Behavioral: saved/queued for outreach — positive signal.
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("saved", lead, { destination: "dialer" });
    // Phase 8: /app/dialer consumes ?tab but NOT ?addLeadId — verified by
    // grepping components/dialer/*. Dropping the dead param and showing a
    // confirmation toast so users know the lead landed somewhere intentional.
    router.push(`/app/dialer?tab=oppenheimer`);
    toast({
      title: "Lead sent to Dialer",
      description: lead
        ? `${lead.address} is ready to queue in Oppenheimer.`
        : "Open the Oppenheimer tab to queue this lead.",
    });
  };

  const handleLogContact = async (id: string) => {
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("called", lead);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreachStatus: "contacted",
          lastContactDate: new Date().toISOString(),
          lastContactMethod: "manual",
        }),
      });
      if (res.ok) {
        setProperties((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  outreachStatus: "contacted",
                  lastContactDate: new Date().toISOString(),
                  lastContactMethod: "manual",
                }
              : p,
          ),
        );
        // Activity log (Lane 3): only on successful PATCH so we don't double-
        // count the demo-mode fallback below.
        void fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "contact_logged", propertyId: id }),
        }).catch(() => {});
        toast({ title: "Contact logged" });
      } else {
        // Fall back to local state update (demo mode)
        setProperties((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, outreachStatus: "contacted", lastContactDate: new Date().toISOString() }
              : p,
          ),
        );
        toast({ title: "Contact logged (local)", description: "Demo mode." });
      }
    } catch {
      toast({ title: "Could not log contact", variant: "destructive" });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background rounded-lg border border-border">
      {/* Header — matches Tasks gold-standard shape (title + subtitle + primary action) */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Surface distressed properties, score motivation, and promote the ones worth your time.
            </p>
            {dataCurrentAsOf && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                <Clock className="h-3 w-3" />
                Data current as of{" "}
                {dataCurrentAsOf.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <Button onClick={handleZipSearch} disabled={zip.length !== 5}>
            <Search className="h-4 w-4 mr-2" />
            Pull Leads by ZIP
          </Button>
        </div>
      </div>

      <LeadFilterBar
        zip={zip}
        onZipChange={setZip}
        distress={distress}
        onDistressChange={setDistress}
        scoreMin={scoreMin}
        onScoreMinChange={setScoreMin}
        taxOwedMin={taxOwedMin}
        onTaxOwedMinChange={setTaxOwedMin}
        resultCount={filtered.length}
        onSearch={handleZipSearch}
        onClear={handleClearFilters}
      />

      {/* Option A — exposure / virtual / auction headline */}
      {(totalTaxExposure > 0 || virtualCount > 0 || auctionScheduledCount > 0) && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 text-xs">
          {totalTaxExposure > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <span className="font-semibold tabular-nums">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                  notation: "compact",
                }).format(totalTaxExposure)}
              </span>
              <span>in tax exposure</span>
            </div>
          )}
          {auctionScheduledCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <Gavel className="h-3 w-3" />
              <span className="font-semibold tabular-nums">{auctionScheduledCount}</span>
              <span>{auctionScheduledCount === 1 ? "auction scheduled" : "auctions scheduled"}</span>
            </div>
          )}
          {virtualCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <span className="font-semibold tabular-nums">{virtualCount}</span>
              <span>fresh leads surfaced</span>
            </div>
          )}
        </div>
      )}

      {/* Two-pane main: list (40%) | map (60%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-full sm:w-2/5 lg:w-[38%] border-r border-border overflow-hidden flex flex-col bg-card">
          {!loading && properties.length === 0 ? (
            <EmptyState
              icon={<Home className="h-10 w-10" />}
              title="No leads yet"
              description="Pull tax-delinquent, pre-foreclosure, and auction leads by ZIP to start surfacing real distress signals for your flip pipeline."
              actionLabel="Pull leads by ZIP"
              actionHref="/app/leads"
            />
          ) : (
            <LeadListPanel
              leads={filtered}
              selectedLeadId={selectedId}
              onSelectLead={handleSelect}
              loading={loading}
            />
          )}
        </div>
        <div className="hidden sm:block flex-1 relative">
          <LeadsMap
            leads={filtered}
            selectedLeadId={selectedId}
            onSelectLead={handleSelect}
          />
        </div>
      </div>

      <LeadDetailSheet
        lead={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSkipTrace={withPromote(handleSkipTrace)}
        onSendToUnderwriting={withPromote(handleSendToUnderwriting)}
        onAddToCampaign={withPromote(handleAddToCampaign)}
        onLogContact={withPromote(handleLogContact)}
      />
    </div>
  );
}
