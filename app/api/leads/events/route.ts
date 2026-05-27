import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordLeadEvent, type LeadEventType } from "@/lib/behavior/lead-events";

// ---------------------------------------------------------------------------
// POST /api/leads/events
// Records a behavioral signal (the user-behavior model's training data).
// Called from the frontend on every meaningful lead interaction.
//
// Body: { eventType, propertyId?, parcelId?, leadSnapshot, metadata? }
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "viewed", "opened", "pursued", "skipped", "called", "texted", "emailed",
  "offer_made", "contract_signed", "closed", "marked_dead", "saved", "enriched",
] as const;

const BodySchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  propertyId: z.string().optional(),
  parcelId: z.string().optional(),
  leadSnapshot: z.record(z.any()).default({}),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve internal user id from Clerk id.
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) {
    // No user row yet (pre-launch public bypass) — accept silently, nothing to attribute.
    return NextResponse.json({ recorded: false, reason: "no_user" });
  }

  await recordLeadEvent({
    userId: user.id,
    eventType: body.eventType as LeadEventType,
    propertyId: body.propertyId,
    parcelId: body.parcelId,
    leadSnapshot: body.leadSnapshot,
    metadata: body.metadata,
  });

  return NextResponse.json({ recorded: true });
}
