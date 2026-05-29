"use client";

// ---------------------------------------------------------------------------
// Client-side behavioral telemetry — the other half of the LeadEvent corpus.
//
// The backend has recordLeadEvent + POST /api/leads/events. This file is the
// browser-side shim every UI surface calls to fire signals. Fire-and-forget:
// NEVER blocks UI on telemetry. Silent on errors. Dedupes "viewed" per session
// so scrolling a list of 200 leads doesn't spam 200 events for each scroll.
// ---------------------------------------------------------------------------

export type LeadEventType =
  | "viewed"
  | "opened"
  | "pursued"
  | "skipped"
  | "called"
  | "texted"
  | "emailed"
  | "offer_made"
  | "contract_signed"
  | "closed"
  | "marked_dead"
  | "saved"
  | "enriched";

/** The minimum shape every UI surface can produce for a lead.
 *  All non-id fields tolerate `null` because that's how Prisma returns
 *  optional columns — keeps callers from having to coalesce. */
export interface TrackableLead {
  id: string;
  score?: number | null;
  estimatedValue?: number | null;
  assessedValue?: number | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  squareFeet?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
  outreachStatus?: string | null;
  ownerName?: string | null;
  county?: string | null;
}

function buildSnapshot(lead: TrackableLead): Record<string, unknown> {
  const distressSignals: string[] = [];
  if (lead.foreclosure) distressSignals.push("foreclosure");
  if (lead.preForeclosure) distressSignals.push("pre_foreclosure");
  if (lead.taxDelinquent) distressSignals.push("tax_delinquent");
  if (lead.vacant) distressSignals.push("vacant");

  // Rough equity proxy: market value minus last sale. We don't know last sale
  // here in all surfaces — leave undefined when absent rather than guess.
  return {
    score: lead.score,
    marketValue: lead.estimatedValue ?? undefined,
    assessedValue: lead.assessedValue ?? undefined,
    distressSignals,
    propertyType: lead.propertyType,
    yearBuilt: lead.yearBuilt ?? undefined,
    squareFeet: lead.squareFeet ?? undefined,
    bedrooms: lead.bedrooms ?? undefined,
    bathrooms: lead.bathrooms ?? undefined,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    county: lead.county,
    outreachStatus: lead.outreachStatus,
    hasOwnerInfo: !!lead.ownerName,
  };
}

export async function trackLeadEvent(
  eventType: LeadEventType,
  lead: TrackableLead,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/leads/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        propertyId: lead.id,
        leadSnapshot: buildSnapshot(lead),
        metadata,
      }),
      // Telemetry is fire-and-forget — explicitly low priority.
      keepalive: true,
    });
  } catch {
    // Never block UI on telemetry failure.
  }
}

// Session-level "viewed" dedup — a single lead in a single tab session
// produces one viewed event no matter how many times the user scrolls past it.
const viewedThisSession = new Set<string>();

export function trackLeadViewed(lead: TrackableLead): void {
  if (viewedThisSession.has(lead.id)) return;
  viewedThisSession.add(lead.id);
  void trackLeadEvent("viewed", lead);
}

/** Bulk-track a batch of leads as viewed (e.g. after a list fetch). */
export function trackLeadsViewed(leads: TrackableLead[]): void {
  // Throttle: don't fire more than 30 per batch to avoid hammering the API
  // on big list loads. The signal we care about is whether a lead appeared
  // at all in the user's session, not the exact ordering.
  for (const lead of leads.slice(0, 30)) trackLeadViewed(lead);
}
