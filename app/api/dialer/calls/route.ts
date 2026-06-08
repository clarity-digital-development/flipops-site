// ---------------------------------------------------------------------------
// GET  /api/dialer/calls   — caller's PhoneCall history (latest 100)
// POST /api/dialer/calls   — record an outbound call attempt from FlipPhone
//
// Both endpoints are gated behind `PHONECALL_MODEL_READY=1` because the
// PhoneCall Prisma model has NOT YET been migrated as of 2026-06-08
// (see prisma/schema.patch.phonecall.prisma for the pending patch and the
// gating pattern documented in lib/telnyx/webhook-router.ts).
//
// When the gate is off:
//   GET  → returns { calls: [] } so the History tab renders an empty state
//          instead of 500ing
//   POST → returns 503 so the FlipPhone fire-and-forget logger can swallow
//
// When the gate is on:
//   GET  → returns the latest 100 PhoneCall rows for the caller
//   POST → upserts on telnyxCallControlId (so a later webhook can fill in
//          recording/duration/outcome without dup rows)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

function modelReady(): boolean {
  return process.env.PHONECALL_MODEL_READY === "1";
}

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  if (!modelReady()) {
    return NextResponse.json({ calls: [], modelReady: false });
  }

  try {
    // Prisma client typing only knows about phoneCall once the schema patch
    // is merged + `prisma generate` is re-run. Until then, runtime-cast.
    const client = prisma as unknown as {
      phoneCall: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };
    const calls = await client.phoneCall.findMany({
      where: { userId: guard.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ calls, modelReady: true });
  } catch (err) {
    console.error("[dialer/calls GET] error", err);
    return NextResponse.json(
      { error: "Failed to load call history" },
      { status: 500 },
    );
  }
}

const PostBodySchema = z.object({
  telnyxCallControlId: z.string().nullable().optional(),
  toNumber: z.string().min(1),
  fromNumber: z.string().min(1),
  propertyId: z.string().nullable().optional(),
  durationSec: z.number().int().nonnegative().nullable().optional(),
  outcome: z.string().nullable().optional(),
  dispositionNotes: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  if (!modelReady()) {
    return NextResponse.json(
      {
        recorded: false,
        modelReady: false,
        message:
          "PhoneCall model not migrated. Apply prisma/schema.patch.phonecall.prisma and set PHONECALL_MODEL_READY=1.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.format() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const client = prisma as unknown as {
      phoneCall: {
        upsert: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<unknown>;
      };
    };

    // If we have a call_control_id, upsert (webhook may have created the row
    // already). Otherwise just create a fresh row keyed only by user+time.
    const base = {
      userId: guard.userId,
      direction: "outbound",
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      propertyId: input.propertyId ?? null,
      durationSec: input.durationSec ?? null,
      outcome: input.outcome ?? null,
      dispositionNotes: input.dispositionNotes ?? null,
      status: input.status ?? "hangup",
      endedAt: new Date(),
    };

    const call = input.telnyxCallControlId
      ? await client.phoneCall.upsert({
          where: { telnyxCallControlId: input.telnyxCallControlId },
          create: { ...base, telnyxCallControlId: input.telnyxCallControlId },
          update: {
            durationSec: base.durationSec,
            outcome: base.outcome,
            dispositionNotes: base.dispositionNotes,
            status: base.status,
            endedAt: base.endedAt,
          },
        })
      : await client.phoneCall.create({
          data: {
            ...base,
            // Synthetic id so the unique constraint holds for client-side-
            // only calls (Telnyx event never arrived).
            telnyxCallControlId: `local-${guard.userId}-${Date.now()}`,
          },
        });

    return NextResponse.json({ recorded: true, call });
  } catch (err) {
    console.error("[dialer/calls POST] error", err);
    return NextResponse.json(
      { error: "Failed to record call" },
      { status: 500 },
    );
  }
}
