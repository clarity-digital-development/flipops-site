import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Raw snapshot capture — the bronze layer.
//
// Every scrape / API / enrichment fetch MUST call this with its FULL raw
// response before any extraction/normalization. We never discard raw data:
//   • The full payload (all 40+ appraiser fields, sale history, etc.) is
//     training-valuable even when the normalized layer keeps only a few fields.
//   • contentHash dedups identical re-fetches but still records a new row each
//     run, so re-scrapes form a time series — change-over-time is a strong
//     distress predictor.
//
// Append-only. Fire-and-forget friendly (callers can `void captureRaw(...)`
// to avoid blocking the hot path).
// ---------------------------------------------------------------------------

export interface CaptureRawInput {
  entityType: "parcel" | "property" | "owner";
  source: string;       // "firecrawl" | "fl-fgio" | "batchdata" | ...
  sourceTag: string;    // canonical provenance tag
  category?: string;    // "appraiser" | "clerk_records" | "tax_delinquency" | "bulk_roll" | "skip_trace"
  countyFips?: string;
  apn?: string;
  propertyId?: string;
  requestParams?: unknown; // url / query / schema we sent
  rawResponse: unknown;    // the WHOLE response
}

export async function captureRaw(input: CaptureRawInput): Promise<void> {
  try {
    const rawJson = input.rawResponse ?? {};
    const contentHash = createHash("sha256")
      .update(JSON.stringify(rawJson))
      .digest("hex");

    await prisma.rawSnapshot.create({
      data: {
        entityType: input.entityType,
        countyFips: input.countyFips ?? null,
        apn: input.apn ?? null,
        propertyId: input.propertyId ?? null,
        source: input.source,
        sourceTag: input.sourceTag,
        category: input.category ?? null,
        requestParams: (input.requestParams ?? undefined) as object | undefined,
        rawResponse: rawJson as object,
        contentHash,
      },
    });
  } catch (err) {
    // Never let raw-capture failures break the data pipeline — but log loudly,
    // because losing raw data is the one thing we're trying hardest to avoid.
    console.error(
      "[raw-capture] FAILED to persist raw snapshot — investigate:",
      input.sourceTag,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Retrieve the raw snapshot history for a parcel — the time series of every
 * fetch, newest first. Used for ML feature extraction + change detection.
 */
export async function getRawHistory(
  countyFips: string,
  apn: string,
  category?: string,
) {
  return prisma.rawSnapshot.findMany({
    where: { countyFips, apn, ...(category ? { category } : {}) },
    orderBy: { capturedAt: "desc" },
  });
}
