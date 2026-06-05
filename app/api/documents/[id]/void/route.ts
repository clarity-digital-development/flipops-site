// ---------------------------------------------------------------------------
// POST /api/documents/[id]/void
//
// Phase 6 — minimum-viable Documents backend.
// Sets a document's status to "void". Owner-scoped.
//
// This is intentionally a separate endpoint (rather than a PATCH) so that the
// UI's void-confirmation flow has a single, audit-loggable verb. A future
// phase will append to the document's auditLog when this fires.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await ctx.params;

  // Defensive cast for pre-db-push environments.
  const client = prisma as unknown as {
    document?: {
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };
  const doc = client.document;
  if (!doc) {
    return NextResponse.json(
      { error: "Document storage not provisioned yet" },
      { status: 503 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (await doc.findUnique({ where: { id } as any })) as
    | { userId: string; status: string }
    | null;
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status === "void") {
    return NextResponse.json({ error: "Already voided" }, { status: 409 });
  }

  const updated = await doc.update({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { id } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: "void" } as any,
  });

  return NextResponse.json({ document: updated });
}
