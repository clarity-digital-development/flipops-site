import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { enrichProperty } from "@/lib/data-sources/enrichment";

// ---------------------------------------------------------------------------
// POST /api/properties/enrich
// The depth-layer trigger: fire the live multi-source pull (appraiser + clerk
// lis pendens + tax delinquency) for an engaged property and merge into the
// Parcel/PropertyDataPoint layer. Returns a quality summary.
//
// Body: { countyFips, apn?, address?: { street, city, state, zip } }
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  countyFips: z.string().regex(/^\d{5}$/),
  state: z.string().length(2).default("FL"),
  apn: z.string().optional(),
  address: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  let body;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.apn && !body.address) {
    return NextResponse.json({ error: "apn or address required" }, { status: 400 });
  }

  const summary = await enrichProperty({
    countyFips: body.countyFips,
    state: body.state,
    apn: body.apn,
    address: body.address,
  });

  return NextResponse.json(summary);
}
