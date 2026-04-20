"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { resolveCoordinates, jitterCoordinates } from "./city-coordinates";

// ---------------------------------------------------------------------------
// Map of leads with score-colored pins.
// Clicking a pin fires onSelectLead; selected pins scale up and animate.
// ---------------------------------------------------------------------------

export interface MapLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  score?: number;
  latitude?: number | null;
  longitude?: number | null;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
}

interface LeadsMapProps {
  leads: MapLead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  className?: string;
}

function scoreColor(score?: number): string {
  if (!score) return "#94a3b8"; // slate-400
  if (score >= 85) return "#10b981"; // emerald-500
  if (score >= 70) return "#22c55e"; // green-500
  if (score >= 50) return "#f59e0b"; // amber-500
  if (score >= 30) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

export function LeadsMap({
  leads,
  selectedLeadId,
  onSelectLead,
  className,
}: LeadsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Attach coordinates to leads: prefer real lat/lng, fall back to city lookup with jitter.
  const mappedLeads = useMemo(
    () =>
      leads
        .map((lead) => {
          if (lead.latitude != null && lead.longitude != null) {
            return { ...lead, lat: lead.latitude, lng: lead.longitude };
          }
          const base = resolveCoordinates(lead.city, lead.state);
          if (!base) return null;
          const jittered = jitterCoordinates(base, lead.id);
          return { ...lead, lat: jittered.lat, lng: jittered.lng };
        })
        .filter((l): l is MapLead & { lat: number; lng: number } => l !== null),
    [leads],
  );

  // Compute bounds of all pins so the map frames everything.
  const initialView = useMemo(() => {
    if (mappedLeads.length === 0) {
      // Default to US center
      return { longitude: -82.45, latitude: 28.0, zoom: 5.5 };
    }
    const lats = mappedLeads.map((l) => l.lat);
    const lngs = mappedLeads.map((l) => l.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 5.5,
    };
  }, [mappedLeads]);

  // Fly to selected lead when selection changes.
  useEffect(() => {
    if (!selectedLeadId || !mapRef.current) return;
    const target = mappedLeads.find((l) => l.id === selectedLeadId);
    if (!target) return;
    mapRef.current.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      duration: 1000,
    });
  }, [selectedLeadId, mappedLeads]);

  if (!mapboxToken) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground",
          className,
        )}
      >
        Map unavailable: set NEXT_PUBLIC_MAPBOX_TOKEN in environment
      </div>
    );
  }

  const mapStyle =
    resolvedTheme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

  return (
    <div className={cn("relative h-full w-full", className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={initialView}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        reuseMaps
      >
        <NavigationControl position="top-right" showCompass={false} />
        {mappedLeads.map((lead) => {
          const isSelected = lead.id === selectedLeadId;
          const color = scoreColor(lead.score);
          return (
            <Marker
              key={lead.id}
              longitude={lead.lng}
              latitude={lead.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectLead(lead.id);
              }}
            >
              <div
                className={cn(
                  "cursor-pointer transition-transform duration-200",
                  isSelected ? "scale-125" : "hover:scale-110",
                )}
                aria-label={`${lead.address}, score ${lead.score ?? "unscored"}`}
              >
                <svg
                  width={isSelected ? 34 : 26}
                  height={isSelected ? 44 : 34}
                  viewBox="0 0 24 32"
                  className="drop-shadow-md"
                >
                  <path
                    d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z"
                    fill={color}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <circle cx="12" cy="12" r="4" fill="#fff" />
                </svg>
                {isSelected && (
                  <div
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium shadow-md whitespace-nowrap"
                    style={{ marginTop: -4 }}
                  >
                    {lead.address}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 bottom-3 flex flex-col gap-1 rounded-lg border border-border bg-background/95 px-2.5 py-2 text-[11px] shadow-sm backdrop-blur">
        <div className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">
          Score
        </div>
        {[
          { label: "85+", color: "#10b981" },
          { label: "70-84", color: "#22c55e" },
          { label: "50-69", color: "#f59e0b" },
          { label: "30-49", color: "#f97316" },
          { label: "<30", color: "#ef4444" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="tabular-nums">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
