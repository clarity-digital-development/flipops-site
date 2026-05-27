import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Behavioral signal capture — the training corpus for the per-user lead-scoring
// model ("what makes a great lead for YOU").
//
// The model learns from the DELTA between the leadSnapshot of leads a user
// PURSUED vs SKIPPED vs CLOSED. So every event MUST carry a snapshot of the
// lead's scoring-relevant attributes at the moment of the action — the
// attributes can change later, but the training signal is "what did the lead
// look like WHEN the user acted." Append-only.
// ---------------------------------------------------------------------------

export type LeadEventType =
  | "viewed"          // appeared in a list the user scrolled past
  | "opened"          // opened the detail drawer
  | "pursued"         // explicit positive intent (sent to underwriting, called, saved)
  | "skipped"         // explicit negative (dismissed, marked not-interested)
  | "called"
  | "texted"
  | "emailed"
  | "offer_made"
  | "contract_signed"
  | "closed"
  | "marked_dead"
  | "saved"
  | "enriched";

/** Scoring-relevant attribute snapshot captured at event time. */
export interface LeadSnapshot {
  score?: number;
  marketValue?: number;
  assessedValue?: number;
  equity?: number;
  distressSignals?: string[];
  propertyType?: string;
  yearBuilt?: number;
  squareFeet?: number;
  county?: string;
  state?: string;
  zip?: string;
  daysOnMarket?: number;
  [key: string]: unknown;
}

export interface RecordLeadEventInput {
  userId: string;
  eventType: LeadEventType;
  propertyId?: string;
  parcelId?: string;
  leadSnapshot: LeadSnapshot;
  metadata?: Record<string, unknown>;
}

export async function recordLeadEvent(input: RecordLeadEventInput): Promise<void> {
  try {
    await prisma.leadEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        propertyId: input.propertyId ?? null,
        parcelId: input.parcelId ?? null,
        leadSnapshot: input.leadSnapshot as object,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    console.error(
      "[lead-events] failed to record behavioral signal:",
      input.eventType,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Pull a user's behavioral history for model training / personalized scoring.
 * Returns pursued vs skipped snapshots — the core training contrast.
 */
export async function getUserBehaviorCorpus(userId: string) {
  const events = await prisma.leadEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: "asc" },
  });
  const positive = events.filter((e) =>
    ["pursued", "called", "offer_made", "contract_signed", "closed", "saved"].includes(e.eventType),
  );
  const negative = events.filter((e) =>
    ["skipped", "marked_dead"].includes(e.eventType),
  );
  return { total: events.length, positive, negative, events };
}
