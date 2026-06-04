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
import { seedProperties, type Property } from "./seed-data";
import { trackLeadEvent, trackLeadsViewed } from "@/lib/behavior/client";

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
  // Fetch properties — falls back to seed data so the demo always has content.
  // ------------------------------------------------------------------------
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/properties");
      if (!res.ok) {
        setProperties(seedProperties);
        return;
      }
      const data = await res.json();
      const list: Property[] = data.properties ?? [];
      const finalList = list.length > 0 ? list : seedProperties;
      setProperties(finalList);
      // Behavioral: leads that appeared in the user's session are "viewed."
      // (Deduped per session inside the helper.)
      trackLeadsViewed(finalList);
    } catch {
      setProperties(seedProperties);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

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
    // Resolve ZIP → county scraper. If we can scrape it, pull from county
    // records (cheap). Otherwise the route signals an API fallback.
    void (async () => {
      try {
        const res = await fetch("/api/leads/pull-by-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip, category: "tax_delinquency" }),
        });
        const data = await res.json();
        if (data.strategy === "scraper" && data.ok) {
          toast({
            title: `Pulled ${data.recordsScraped ?? 0} leads`,
            description: `${data.county?.county ?? zip} county records refreshed. Reloading...`,
          });
          fetchProperties();
        } else if (data.strategy === "api_fallback") {
          toast({
            title: "Filtered to ZIP",
            description: `${zip} isn't onboarded for direct county scraping yet — showing ${filtered.length} existing leads. (Scraper coverage expands per market.)`,
          });
        } else {
          toast({
            title: "Pull failed",
            description: data.message ?? "Try again shortly.",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Filtered to ZIP",
          description: `Showing ${filtered.length} existing leads in ${zip}.`,
        });
      }
    })();
  };

  const handleSkipTrace = async (id: string) => {
    // Phase 4 wires this to POST /api/batchdata/skip-trace.
    const target = properties.find((p) => p.id === id);
    if (target) void trackLeadEvent("enriched", target, { kind: "skip_trace" });
    toast({
      title: "Skip trace queued",
      description: target
        ? `Owner contact lookup for ${target.address} will run once BatchData is live.`
        : "Skip trace request queued.",
    });
  };

  const handleSendToUnderwriting = (id: string) => {
    // Behavioral: strongest positive signal — user is investing time analyzing.
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("pursued", lead, { destination: "underwriting" });
    router.push(`/app/underwriting?propertyId=${encodeURIComponent(id)}`);
  };

  const handleAddToCampaign = (id: string) => {
    // Behavioral: saved/queued for outreach — positive signal.
    const lead = properties.find((p) => p.id === id);
    if (lead) void trackLeadEvent("saved", lead, { destination: "dialer" });
    // Route to Oppenheimer (the AI dialer) with the lead pre-queued.
    router.push(`/app/dialer?tab=oppenheimer&addLeadId=${encodeURIComponent(id)}`);
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

      {/* Option A — exposure / virtual headline */}
      {(totalTaxExposure > 0 || virtualCount > 0) && (
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
          <LeadListPanel
            leads={filtered}
            selectedLeadId={selectedId}
            onSelectLead={handleSelect}
            loading={loading}
          />
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
