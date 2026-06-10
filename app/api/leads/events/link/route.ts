import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

// ---------------------------------------------------------------------------
// POST /api/leads/events/link
// Attribute anonymous (pre-auth) behavioral events to the now-authenticated
// user (M1.1 — label-bleed P0).
//
// The client persists a sessionId in localStorage and sends it with every
// /api/leads/events POST. When a signed-in session first sees a stored
// sessionId, it fires this one-time call; we UPDATE LeadEvent SET userId
// WHERE sessionId IN (...) AND userId IS NULL.
//
// Idempotent: already-linked events (userId non-null) are excluded by the
// WHERE clause, so repeated calls are harmless.
//
// Body: { sessionIds: string[] }
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  sessionIds: z.array(z.string().min(8).max(128)).min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;
    const { userId } = guard;

    let body;
    try {
      body = BodySchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.warn("[leads/events/link] rejected: validation failed", err.issues);
        return NextResponse.json(
          { linked: 0, error: "Validation failed", details: err.issues },
          { status: 400 },
        );
      }
      console.warn("[leads/events/link] rejected: invalid JSON body");
      return NextResponse.json({ linked: 0, error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await prisma.leadEvent.updateMany({
      where: {
        sessionId: { in: body.sessionIds },
        userId: null,
      },
      data: { userId },
    });

    if (result.count > 0) {
      console.log("[leads/events/link] linked anonymous events to user", {
        userId,
        sessionIds: body.sessionIds,
        linked: result.count,
      });
    }

    return NextResponse.json({ linked: result.count });
  } catch (error) {
    console.error("[leads/events/link] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
