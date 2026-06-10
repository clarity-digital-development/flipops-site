import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { emitLeadEvent } from "@/lib/events/emit";

// ---------------------------------------------------------------------------
// POST /api/leads/events
// Records a behavioral signal (the user-behavior model's training data).
// Called from the frontend on every meaningful lead interaction.
//
// Body: { eventType, sessionId?, propertyId?, parcelId?, leadSnapshot, metadata? }
//
// M1.1 (label-bleed P0): this route MUST NEVER silently drop an event.
//   - Authenticated sessions: requireUser() JIT-provisions the User row, so
//     the old silent `no_user` drop can no longer happen.
//   - Anonymous (pre-auth) sessions: events are accepted with userId=null and
//     the client-generated sessionId; they are attributed retroactively at
//     signup via POST /api/leads/events/link.
//   - Every rejection logs console.warn with the reason.
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "viewed", "opened", "pursued", "skipped", "called", "texted", "emailed",
  "offer_made", "contract_signed", "closed", "marked_dead", "saved", "enriched",
] as const;

const BodySchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  sessionId: z.string().min(8).max(128).optional(),
  propertyId: z.string().optional(),
  parcelId: z.string().optional(),
  leadSnapshot: z.record(z.string(), z.any()).default({}),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  let body;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.warn("[leads/events] rejected event: validation failed", err.issues);
      return NextResponse.json(
        { recorded: false, error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    console.warn("[leads/events] rejected event: invalid JSON body");
    return NextResponse.json({ recorded: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve identity. requireUser() JIT-provisions the Prisma User row for
  // valid Clerk sessions. Any guard error (401 unauthenticated, 404 Clerk has
  // no email) falls through to the anonymous-session path — events are never
  // dropped because of auth state.
  const guard = await requireUser();
  const userId = "error" in guard ? null : guard.userId;
  const authenticated = userId !== null;

  if (!authenticated && !body.sessionId) {
    console.warn("[leads/events] rejected event: anonymous request without sessionId", {
      eventType: body.eventType,
      propertyId: body.propertyId ?? null,
    });
    return NextResponse.json(
      { recorded: false, error: "sessionId is required for anonymous events" },
      { status: 400 },
    );
  }

  try {
    await emitLeadEvent(null, {
      userId,
      sessionId: body.sessionId ?? null,
      eventType: body.eventType,
      propertyId: body.propertyId,
      parcelId: body.parcelId,
      leadSnapshot: body.leadSnapshot,
      metadata: body.metadata,
    });
  } catch (err) {
    console.warn("[leads/events] rejected event: persist failed", {
      eventType: body.eventType,
      propertyId: body.propertyId ?? null,
      anonymous: !authenticated,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { recorded: false, error: "Failed to record event" },
      { status: 500 },
    );
  }

  // `authenticated` lets the client know it can fire the one-time
  // session→user link call for any stored anonymous sessionId.
  return NextResponse.json({ recorded: true, authenticated });
}
