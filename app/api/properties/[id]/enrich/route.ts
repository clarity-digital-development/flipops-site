// ---------------------------------------------------------------------------
// POST /api/properties/[id]/enrich
//
// Client-callable BatchData skip-trace trigger. Replaces the "Skip trace
// coming soon" toast in /app/leads and /app/properties/[id]. Gated to the
// signed-in user — only the owner of the Property row may enrich it.
//
// Response shape (success):
//   200 {
//     property: { ...updated Property row },
//     phoneCount: number,
//     emailCount: number,
//     lastEnrichedAt: string  // ISO timestamp
//   }
//
// Error responses:
//   401 Unauthorized — not signed in
//   404 Property not found (or not owned by caller)
//   409 Virtual lead — promote it first
//   503 Skip trace not configured. Set BATCHDATA_API_KEY in env.
//   502 BatchData upstream error (network / 4xx / 5xx)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import {
  skipTraceProperty,
  BatchDataNotConfiguredError,
} from "@/lib/batchdata/client";

function isVirtualLeadId(id: string): boolean {
  return typeof id === "string" && id.startsWith("virt-");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth — must be signed in. requireUser() resolves Clerk → Prisma User.id.
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await params;

  // 2. Reject virtual-lead ids — they have no Property row to update.
  if (isVirtualLeadId(id)) {
    return NextResponse.json(
      {
        error: "Virtual lead — promote it first",
        hint: "POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.",
        code: "VIRTUAL_LEAD_NOT_PROMOTED",
      },
      { status: 409 },
    );
  }

  // 3. Ownership check — caller must own this Property.
  const property = await prisma.property.findFirst({
    where: { id, userId },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // 4. Run the skip trace. Map missing-env to a humane 503.
  let traceResult;
  try {
    traceResult = await skipTraceProperty({
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
    });
  } catch (err) {
    if (err instanceof BatchDataNotConfiguredError) {
      return NextResponse.json(
        {
          error: "Skip trace not configured. Set BATCHDATA_API_KEY in env.",
          code: "BATCHDATA_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    console.error("[POST /api/properties/:id/enrich] BatchData call failed", err);
    return NextResponse.json(
      {
        error: "Skip trace provider unavailable",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  // 5. Merge results into Property.phoneNumbers / Property.emails (JSON arrays)
  //    and stamp metadata.skipTrace.enrichedAt. We persist the timestamp inside
  //    `metadata` (free-form JSON column) rather than adding a dedicated
  //    `lastEnrichedAt` column in this lane — schema migration is out of scope
  //    here. The response still exposes `lastEnrichedAt` so the UI contract is
  //    stable.
  const enrichedAt = new Date();

  // Merge phones — keep prior values, dedupe with new ones.
  const existingPhones: string[] = (() => {
    if (!property.phoneNumbers) return [];
    try {
      const parsed = JSON.parse(property.phoneNumbers);
      return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
    } catch {
      return [];
    }
  })();
  const existingEmails: string[] = (() => {
    if (!property.emails) return [];
    try {
      const parsed = JSON.parse(property.emails);
      return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
    } catch {
      return [];
    }
  })();

  const mergedPhones = Array.from(new Set([...existingPhones, ...traceResult.phones]));
  const mergedEmails = Array.from(new Set([...existingEmails, ...traceResult.emails]));

  // Merge metadata.
  let existingMetadata: Record<string, unknown> = {};
  if (property.metadata) {
    try {
      const parsed = JSON.parse(property.metadata);
      if (parsed && typeof parsed === "object") existingMetadata = parsed;
    } catch {
      // ignore malformed metadata; we'll overwrite
    }
  }
  const nextMetadata = {
    ...existingMetadata,
    skipTrace: {
      ...((existingMetadata.skipTrace as object | undefined) ?? {}),
      enrichedAt: enrichedAt.toISOString(),
      phonesFound: traceResult.phones.length,
      emailsFound: traceResult.emails.length,
      ownerName: traceResult.ownerName,
      mailingAddress: traceResult.mailingAddress,
      provider: "batchdata",
    },
  };

  const updated = await prisma.property.update({
    where: { id },
    data: {
      phoneNumbers: mergedPhones.length > 0 ? JSON.stringify(mergedPhones) : property.phoneNumbers,
      emails: mergedEmails.length > 0 ? JSON.stringify(mergedEmails) : property.emails,
      // If BatchData returned an owner name and we don't have one yet, fill it in.
      ownerName: property.ownerName ?? traceResult.ownerName ?? null,
      enriched: true,
      metadata: JSON.stringify(nextMetadata),
    },
  });

  return NextResponse.json({
    property: updated,
    phoneCount: traceResult.phones.length,
    emailCount: traceResult.emails.length,
    lastEnrichedAt: enrichedAt.toISOString(),
  });
}
