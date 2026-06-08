// ---------------------------------------------------------------------------
// POST /api/activity
//
// Insert an Activity row — the same model the analytics route already queries
// (prisma/schema.prisma:1366). Activity requires { teamId, memberId } where
// memberId is a TeamMember row id. We resolve them from the signed-in user:
//
//   User → User.currentTeamId → TeamMember where (teamId, userId) matches
//
// If the user isn't a member of any team yet, we 200 with { skipped: true }
// rather than 409 — the caller is firing activity logs as a side-effect of
// primary actions (skip trace, log contact). It would be hostile to make the
// primary action 500 because the team scaffolding isn't wired yet.
//
// Body:
//   {
//     type: string,                  // 'call' | 'sms' | 'email' | 'note' | 'task' | 'skip_trace' | ...
//     propertyId?: string,
//     occurredAt?: string (ISO),
//     durationMs?: number,           // converted to durationSec internally
//     dispositionNotes?: string,
//   }
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

  // Resolve team + member. Users without a team are accepted silently — see
  // header comment for the rationale.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentTeamId: true },
  });
  if (!user?.currentTeamId) {
    return NextResponse.json({ skipped: true, reason: "NO_TEAM" });
  }

  const member = await prisma.teamMember.findFirst({
    where: { teamId: user.currentTeamId, userId, isActive: true },
    select: { id: true, responseTimeTarget: true },
  });
  if (!member) {
    return NextResponse.json({ skipped: true, reason: "NOT_TEAM_MEMBER" });
  }

  const durationSec =
    typeof body.durationMs === "number" ? Math.round(body.durationMs / 1000) : undefined;

  const activity = await prisma.activity.create({
    data: {
      teamId: user.currentTeamId,
      memberId: member.id,
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
    select: { id: true, occurredAt: true, type: true },
  });

  return NextResponse.json({ activity });
}
