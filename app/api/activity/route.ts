// ---------------------------------------------------------------------------
// POST /api/activity
//
// Lane 3 (2026-06-09): Activity.userId is now the SOURCE OF TRUTH. The schema
// agent dropped the hard team requirement — teamId/memberId are now nullable.
// Solo users can fire Activity rows tied to userId alone; the Team-scoped path
// is gone. Team users still get rows (they just won't auto-populate teamId/
// memberId from this endpoint; those columns are populated by separate
// team-scoped flows when/if they're rewired).
//
// Body:
//   {
//     type: string,                  // 'call' | 'sms' | 'email' | 'note' | 'task' | 'skip_trace_run' | ...
//     propertyId?: string,
//     occurredAt?: string (ISO),
//     durationMs?: number,           // converted to durationSec internally
//     dispositionNotes?: string,
//   }
//
// Returns: { id, created: true }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

const BodySchema = z.object({
  type: z.string().min(1).max(64),
  propertyId: z.string().optional(),
  dealId: z.string().optional(),
  contractId: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  dispositionNotes: z.string().max(4000).optional(),
  outcome: z.string().max(64).optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const durationSec =
    typeof body.durationMs === "number" ? Math.round(body.durationMs / 1000) : undefined;

  const activity = await prisma.activity.create({
    data: {
      userId,
      // teamId / memberId intentionally omitted — userId is source of truth.
      // Solo users get null; team users get null here too. Team-scoped flows
      // populate those columns separately when needed.
      type: body.type,
      outcome: body.outcome ?? null,
      propertyId: body.propertyId ?? null,
      dealId: body.dealId ?? null,
      contractId: body.contractId ?? null,
      duration: durationSec,
      notes: body.dispositionNotes ?? null,
      sentiment: body.sentiment ?? null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: activity.id, created: true });
}
