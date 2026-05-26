import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Property enrichment orchestrator — the "depth layer" of the two-speed model.
//
// Breadth (BulkIngester) gives every parcel a cheap, stale baseline. When a
// user actually ENGAGES a property, we fire this: a live multi-source pull
// from the three authoritative county offices that the data resellers
// themselves buy from —
//   1. Property Appraiser  → richest + freshest static record (owner/value/chars)
//   2. Clerk of Court      → lis pendens (earliest foreclosure signal) + liens
//   3. Tax Collector       → current delinquency
// plus skip-trace (paid API) for owner contact.
//
// Each source is a pluggable Enricher. The orchestrator runs the appraiser
// first (it yields the owner name the clerk search needs), then the rest in
// parallel, merges everything into Parcel + PropertyDataPoint with per-field
// provenance, and returns a quality summary.
// ---------------------------------------------------------------------------

export interface EnrichContext {
  countyFips: string;
  state: string;
  apn?: string;
  address?: { street: string; city: string; state: string; zip: string };
  ownerName?: string; // filled in after the appraiser enricher runs
}

export interface EnrichResult {
  sourceTag: string;
  /** Flat field map (e.g. { assessedValue: 301037, ownerName: "..." }). */
  fields: Record<string, unknown>;
  /** Distress signals discovered (e.g. ["lis_pendens", "tax_delinquent"]). */
  distressSignals?: string[];
  /** 0-1 confidence in this source's data for this property. */
  confidence: number;
}

export interface Enricher {
  readonly name: string;
  /** Run against a property. Return null if this source isn't wired for the county. */
  enrich(ctx: EnrichContext): Promise<EnrichResult | null>;
  /** Does this enricher need the owner name (i.e. must run after the appraiser)? */
  readonly needsOwnerName?: boolean;
}

export interface EnrichmentSummary {
  countyFips: string;
  parcelId: string | null;
  sourcesRun: string[];
  sourcesSucceeded: string[];
  fieldsEnriched: number;
  distressSignals: string[];
  qualityScore: number; // 0-100
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

import { appraiserEnricher } from "./enrichers/appraiser";
import { clerkRecordsEnricher } from "./enrichers/clerk-records";
import { taxCollectorEnricher } from "./enrichers/tax-collector";

const ENRICHERS: Enricher[] = [
  appraiserEnricher,
  clerkRecordsEnricher,
  taxCollectorEnricher,
];

export async function enrichProperty(
  ctx: EnrichContext,
): Promise<EnrichmentSummary> {
  const startedAt = Date.now();
  const sourcesRun: string[] = [];
  const sourcesSucceeded: string[] = [];
  const merged: Record<string, { value: unknown; source: string; confidence: number }> = {};
  const distressSignals = new Set<string>();

  // Phase 1: appraiser first — it produces the owner name later enrichers need.
  const ownerDependent: Enricher[] = [];
  const independent: Enricher[] = [];
  for (const e of ENRICHERS) {
    (e.needsOwnerName ? ownerDependent : independent).push(e);
  }

  const runEnricher = async (e: Enricher) => {
    sourcesRun.push(e.name);
    try {
      const result = await e.enrich(ctx);
      if (!result) return;
      sourcesSucceeded.push(e.name);
      for (const [field, value] of Object.entries(result.fields)) {
        if (value === null || value === undefined) continue;
        // Higher-confidence source wins per field.
        const existing = merged[field];
        if (!existing || result.confidence > existing.confidence) {
          merged[field] = { value, source: result.sourceTag, confidence: result.confidence };
        }
      }
      result.distressSignals?.forEach((s) => distressSignals.add(s));
      // Appraiser yields owner name for downstream enrichers.
      if (e.name === "appraiser" && result.fields.ownerName) {
        ctx.ownerName = String(result.fields.ownerName);
      }
    } catch (err) {
      console.warn(`[enrich] ${e.name} failed:`, err instanceof Error ? err.message : err);
    }
  };

  // Run appraiser-class (owner-producing) sources first, sequentially enough to
  // populate ctx.ownerName, then fan out the rest in parallel.
  for (const e of independent.filter((x) => x.name === "appraiser")) await runEnricher(e);
  await Promise.all([
    ...independent.filter((x) => x.name !== "appraiser").map(runEnricher),
    ...ownerDependent.map(runEnricher),
  ]);

  // Persist: upsert into Parcel + stamp PropertyDataPoint provenance.
  const parcelId = await this_persist(ctx, merged);

  const qualityScore = computeQuality(merged, distressSignals, sourcesSucceeded);
  return {
    countyFips: ctx.countyFips,
    parcelId,
    sourcesRun,
    sourcesSucceeded,
    fieldsEnriched: Object.keys(merged).length,
    distressSignals: [...distressSignals],
    qualityScore,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Persistence — merge into Parcel, stamp PropertyDataPoint per field.
// ---------------------------------------------------------------------------

async function this_persist(
  ctx: EnrichContext,
  merged: Record<string, { value: unknown; source: string; confidence: number }>,
): Promise<string | null> {
  if (!ctx.apn) return null;

  // Map merged fields onto the Parcel column shape (only known columns).
  const COL = new Set([
    "ownerName", "ownerMailingAddress", "situsAddress", "situsCity", "situsState",
    "situsZip", "marketValue", "assessedValue", "landValue", "propertyType",
    "yearBuilt", "squareFeet", "lotSize", "lastSalePrice", "lastSaleYear",
    "latitude", "longitude",
  ]);
  const parcelData: Record<string, unknown> = {};
  for (const [field, { value }] of Object.entries(merged)) {
    if (COL.has(field)) parcelData[field] = value;
  }

  const parcel = await prisma.parcel.upsert({
    where: { countyFips_apn: { countyFips: ctx.countyFips, apn: ctx.apn } },
    create: {
      countyFips: ctx.countyFips,
      apn: ctx.apn,
      state: ctx.state,
      source: "enrichment",
      fetchedAt: new Date(),
      ...parcelData,
    },
    update: { ...parcelData, fetchedAt: new Date() },
  });

  // Stamp PropertyDataPoint for any tenant Property linked to this parcel
  // (so the per-field source badges in the UI reflect the live enrichment).
  const linked = await prisma.property.findFirst({
    where: { apn: ctx.apn, state: ctx.state },
    select: { id: true },
  });
  if (linked) {
    const now = new Date();
    await prisma.$transaction(
      Object.entries(merged).map(([field, { value, source }]) =>
        prisma.propertyDataPoint.upsert({
          where: { propertyId_field_source: { propertyId: linked.id, field, source } },
          create: { propertyId: linked.id, field, source, value: JSON.stringify(value), fetchedAt: now },
          update: { value: JSON.stringify(value), fetchedAt: now },
        }),
      ),
    );
  }

  return parcel.id;
}

// ---------------------------------------------------------------------------
// Quality scoring — completeness + distress richness + source authority.
// ---------------------------------------------------------------------------

function computeQuality(
  merged: Record<string, unknown>,
  distress: Set<string>,
  sourcesSucceeded: string[],
): number {
  // Core fields we want for a deal-grade record.
  const core = ["ownerName", "situsAddress", "marketValue", "assessedValue", "yearBuilt", "squareFeet", "lastSalePrice"];
  const have = core.filter((f) => f in merged).length;
  const completeness = (have / core.length) * 60; // up to 60 pts
  const distressPts = Math.min(distress.size * 10, 25); // up to 25 pts
  const authorityPts = Math.min(sourcesSucceeded.length * 5, 15); // up to 15 pts
  return Math.round(completeness + distressPts + authorityPts);
}
