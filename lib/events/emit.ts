// ---------------------------------------------------------------------------
// Server-side LeadEvent emission (M1.1 — label-bleed P0).
//
// Outcome labels (offer_made / contract_signed / closed) are the most valuable
// rows in the behavioral training corpus and MUST be written server-side,
// inside the same transaction as the business write where practical — never
// from client best-effort telemetry. This module is the single entry point.
//
// Usage (inside a transaction — preferred for outcome labels):
//
//   await prisma.$transaction(async (tx) => {
//     const offer = await tx.offer.create({ ... });
//     await emitLeadEvent(tx, {
//       userId,
//       propertyId,
//       eventType: "offer_made",
//       leadSnapshot: buildPropertySnapshot(property),
//       metadata: { amount: offer.amount },
//     });
//     return offer;
//   });
//
// Usage (standalone — e.g. the /api/leads/events route):
//
//   await emitLeadEvent(null, { userId: null, sessionId, eventType, ... });
//
// NOTE: this function intentionally THROWS on failure (unlike the legacy
// lib/behavior/lead-events.ts recordLeadEvent which swallowed errors). Inside
// a transaction that gives atomicity: business write + label commit together
// or not at all. Standalone callers must catch and log loudly — silent drops
// are the exact failure mode M1.1 exists to kill.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { LeadEventType } from "@/lib/behavior/lead-events";
import {
  calculateDistressScoreFromProperty,
  SCORER_VERSION,
  SIGNAL_FAMILIES,
  type PropertyScoreInput,
} from "@/lib/scoring/distress-scorer";

/** Either the shared singleton or a $transaction client. */
type DbClient = PrismaClient | Prisma.TransactionClient;

export interface EmitLeadEventInput {
  /** Internal Prisma User.id, or null for anonymous (sessionId-attributed) events. */
  userId: string | null;
  /** Client-generated anonymous session id; linked to a User at signup. */
  sessionId?: string | null;
  propertyId?: string | null;
  parcelId?: string | null;
  eventType: LeadEventType;
  /** Scoring-relevant attributes at event time. See buildPropertySnapshot. */
  leadSnapshot?: Record<string, unknown>;
  /** Event-specific extras (offer amount, contract id, disposition, ...). */
  metadata?: Record<string, unknown>;
}

/**
 * Write a LeadEvent row directly via Prisma.
 *
 * @param tx  Pass the Prisma.TransactionClient when emitting inside a
 *            $transaction (outcome labels). Pass null/undefined to use the
 *            shared singleton.
 */
export async function emitLeadEvent(
  tx: DbClient | null | undefined,
  input: EmitLeadEventInput,
): Promise<void> {
  const db = tx ?? prisma;
  await db.leadEvent.create({
    data: {
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      propertyId: input.propertyId ?? null,
      parcelId: input.parcelId ?? null,
      eventType: input.eventType,
      leadSnapshot: (input.leadSnapshot ?? {}) as Prisma.InputJsonValue,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Snapshot builders (M1.1 step 7 — scorer snapshot logging)
// ---------------------------------------------------------------------------

/**
 * Structural subset of a Prisma Property row that the snapshot builders read.
 * All fields optional/nullable so any Property selection works.
 */
export interface SnapshotPropertyRow {
  score?: number | null;
  estimatedValue?: number | null;
  assessedValue?: number | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  squareFeet?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  outreachStatus?: string | null;
  ownerName?: string | null;
  foreclosure?: boolean;
  preForeclosure?: boolean;
  taxDelinquent?: boolean;
  vacant?: boolean;
  bankruptcy?: boolean;
  absenteeOwner?: boolean;
  taxDelinquentAmount?: number | null;
  taxDelinquentYearsCount?: number | null;
  taxDelinquentEarliestYear?: number | null;
}

/**
 * Compute the distress score with its per-family point breakdown + scorer
 * version. Persisted into leadSnapshot so training data stays reproducible
 * across scorer revisions (cheap now, impossible to backfill later).
 *
 * familyBreakdown note: per-family value is the MAX declared weight among
 * present signals in that family — mirroring the scorer's family-MAX
 * composition. Variable-point signals (FUTURE_AUCTION proximity boost,
 * TAX_DELINQUENT amount boosts) may contribute slightly different points to
 * the exact `score`; `score` itself is always the authoritative value.
 */
export function buildScoreBreakdown(input: PropertyScoreInput): Record<string, unknown> {
  const result = calculateDistressScoreFromProperty(input);

  const familyBreakdown: Record<string, number> = {};
  for (const [family, members] of Object.entries(SIGNAL_FAMILIES) as [
    string,
    readonly string[],
  ][]) {
    let max = 0;
    for (const s of result.signals) {
      if (members.includes(s.signal) && s.weight > max) max = s.weight;
    }
    if (max > 0) familyBreakdown[family] = max;
  }

  return {
    scorerVersion: SCORER_VERSION,
    score: result.score,
    grade: result.grade,
    motivation: result.motivation,
    // result.signals is already filtered to present-only by the scorer.
    signals: result.signals.map((s) => ({ signal: s.signal, weight: s.weight })),
    familyBreakdown,
  };
}

/**
 * Build the full leadSnapshot for a Property row: general attributes (the
 * shape lib/behavior/client.ts produces) + the scorer breakdown under
 * `scoring` with the scorer version.
 */
export function buildPropertySnapshot(property: SnapshotPropertyRow): Record<string, unknown> {
  const distressSignals: string[] = [];
  if (property.foreclosure) distressSignals.push("foreclosure");
  if (property.preForeclosure) distressSignals.push("pre_foreclosure");
  if (property.taxDelinquent) distressSignals.push("tax_delinquent");
  if (property.vacant) distressSignals.push("vacant");
  if (property.bankruptcy) distressSignals.push("bankruptcy");
  if (property.absenteeOwner) distressSignals.push("absentee_owner");

  const scoreInput: PropertyScoreInput = {
    foreclosure: !!property.foreclosure,
    preForeclosure: !!property.preForeclosure,
    taxDelinquent: !!property.taxDelinquent,
    vacant: !!property.vacant,
    bankruptcy: !!property.bankruptcy,
    absenteeOwner: !!property.absenteeOwner,
    estimatedValue: property.estimatedValue ?? null,
    assessedValue: property.assessedValue ?? null,
    taxDelinquentAmount: property.taxDelinquentAmount ?? null,
    taxDelinquentYearsCount: property.taxDelinquentYearsCount ?? null,
    taxDelinquentEarliestYear: property.taxDelinquentEarliestYear ?? null,
  };

  return {
    score: property.score ?? undefined,
    marketValue: property.estimatedValue ?? undefined,
    assessedValue: property.assessedValue ?? undefined,
    distressSignals,
    propertyType: property.propertyType ?? undefined,
    yearBuilt: property.yearBuilt ?? undefined,
    squareFeet: property.squareFeet ?? undefined,
    bedrooms: property.bedrooms ?? undefined,
    bathrooms: property.bathrooms ?? undefined,
    city: property.city ?? undefined,
    state: property.state ?? undefined,
    zip: property.zip ?? undefined,
    county: property.county ?? undefined,
    outreachStatus: property.outreachStatus ?? undefined,
    hasOwnerInfo: !!property.ownerName,
    scoring: buildScoreBreakdown(scoreInput),
  };
}
