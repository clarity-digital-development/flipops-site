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

// ---------------------------------------------------------------------------
// Anonymous session identity (M1.1 — label-bleed P0).
//
// Pre-auth users generate a persistent sessionId (localStorage) that rides on
// every event so the backend can store userId=null events instead of dropping
// them. When the session is later authenticated, a one-time link call
// attributes the stored anonymous events to the user
// (POST /api/leads/events/link → UPDATE LeadEvent SET userId WHERE sessionId).
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = "fo.behavior.sessionId";
const LINKED_STORAGE_KEY = "fo.behavior.linkedSessionId";

// Per-tab fallback when localStorage is unavailable (private mode / blocked).
let inMemorySessionId: string | null = null;

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Ancient-browser fallback — still unique enough for session attribution.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Get (or lazily create + persist) the anonymous behavioral session id. */
export function getBehaviorSessionId(): string | null {
  if (typeof window === "undefined") return null;
  if (inMemorySessionId) return inMemorySessionId;
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      inMemorySessionId = existing;
      return existing;
    }
    const fresh = generateSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    inMemorySessionId = fresh;
    return fresh;
  } catch {
    // localStorage unavailable — degrade to a per-tab session id.
    inMemorySessionId = generateSessionId();
    return inMemorySessionId;
  }
}

// Single-flight guard so a burst of events fires at most one link call.
let linkInFlight: Promise<void> | null = null;

/**
 * One-time call that attributes this session's anonymous events to the
 * now-authenticated user. Safe to call repeatedly: deduped via localStorage
 * flag + in-flight guard, and the server-side UPDATE is idempotent
 * (only touches rows WHERE userId IS NULL).
 *
 * Fired automatically by trackLeadEvent when the events API reports the
 * session is authenticated; auth/signup flows may also call it directly.
 */
export function linkAnonymousSession(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const sessionId = getBehaviorSessionId();
  if (!sessionId) return Promise.resolve();
  try {
    if (window.localStorage.getItem(LINKED_STORAGE_KEY) === sessionId) {
      return Promise.resolve();
    }
  } catch {
    // localStorage unreadable — fall through; server-side link is idempotent.
  }
  if (linkInFlight) return linkInFlight;
  linkInFlight = (async () => {
    try {
      const res = await fetch("/api/leads/events/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: [sessionId] }),
        keepalive: true,
      });
      if (res.ok) {
        try {
          window.localStorage.setItem(LINKED_STORAGE_KEY, sessionId);
        } catch {
          // Persisting the flag failed — next attempt re-links (idempotent).
        }
      }
    } catch {
      // Fire-and-forget; retried on the next authenticated event.
    } finally {
      linkInFlight = null;
    }
  })();
  return linkInFlight;
}

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
    const res = await fetch("/api/leads/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId: getBehaviorSessionId() ?? undefined,
        propertyId: lead.id,
        leadSnapshot: buildSnapshot(lead),
        metadata,
      }),
      // Telemetry is fire-and-forget — explicitly low priority.
      keepalive: true,
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { authenticated?: boolean } | null;
      // First time an authed session sees our stored sessionId → one-time
      // link of all anonymous events to the user. Deduped internally.
      if (json?.authenticated) void linkAnonymousSession();
    }
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
