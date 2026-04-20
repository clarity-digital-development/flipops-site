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

  // Selection state — `selectedId` keeps the map pin highlighted even after
  // the detail sheet is closed. `sheetOpen` toggles the drawer only.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
      setProperties(list.length > 0 ? list : seedProperties);
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
      if (distress.size > 0) {
        const matchesAny =
          (distress.has("foreclosure") && p.foreclosure) ||
          (distress.has("preForeclosure") && p.preForeclosure) ||
          (distress.has("taxDelinquent") && p.taxDelinquent) ||
          (distress.has("vacant") && p.vacant);
        if (!matchesAny) return false;
      }
      return true;
    });
  }, [properties, zip, scoreMin, distress]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  // ------------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------------

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const handleClearFilters = () => {
    setZip("");
    setDistress(new Set());
    setScoreMin(0);
  };

  const handleZipSearch = () => {
    if (!zip || zip.length !== 5) return;
    // Phase 4: this will fire a BatchData property search and merge results.
    // For now, filtering against existing records is enough for the demo.
    toast({
      title: "ZIP filter applied",
      description: `Showing ${filtered.length} leads in ${zip}. Live BatchData pulls ship in Phase 4.`,
    });
  };

  const handleSkipTrace = async (id: string) => {
    // Phase 4 wires this to POST /api/batchdata/skip-trace.
    const target = properties.find((p) => p.id === id);
    toast({
      title: "Skip trace queued",
      description: target
        ? `Owner contact lookup for ${target.address} will run once BatchData is live.`
        : "Skip trace request queued.",
    });
  };

  const handleSendToUnderwriting = (id: string) => {
    router.push(`/app/underwriting?propertyId=${encodeURIComponent(id)}`);
  };

  const handleAddToCampaign = (id: string) => {
    router.push(`/app/campaigns?addLeadId=${encodeURIComponent(id)}`);
  };

  const handleLogContact = async (id: string) => {
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
        resultCount={filtered.length}
        onSearch={handleZipSearch}
        onClear={handleClearFilters}
      />

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
        onSkipTrace={handleSkipTrace}
        onSendToUnderwriting={handleSendToUnderwriting}
        onAddToCampaign={handleAddToCampaign}
        onLogContact={handleLogContact}
      />
    </div>
  );
}
