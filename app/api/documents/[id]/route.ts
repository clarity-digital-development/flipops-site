// ---------------------------------------------------------------------------
// /api/documents/[id]
//
// Phase 6 — minimum-viable Documents backend.
//
//   GET    — read a single document (owner-scoped).
//   PATCH  — update status / title / tags / signerRoles / folderId.
//   DELETE — hard-delete the row.
//
// All three handlers are gated on requireUser(). Each one checks that the
// document's userId matches the caller before doing anything destructive.
//
// Deferred (out of scope this phase):
//   - PDF re-render on update
//   - audit-log append on every PATCH (only status changes get an entry)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Defensive accessor — until the Phase 6 schema patch is db-pushed, the
// `document` delegate may not exist on the generated client.
function getDocumentDelegate() {
  const client = prisma as unknown as {
    document?: {
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
    };
  };
  return client.document;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await ctx.params;

  const doc = getDocumentDelegate();
  if (!doc) {
    return NextResponse.json(
      { error: "Document storage not provisioned yet" },
      { status: 503 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const document = (await doc.findUnique({ where: { id } as any })) as
    | { userId: string }
    | null;
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (document.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ document });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await ctx.params;

  const doc = getDocumentDelegate();
  if (!doc) {
    return NextResponse.json(
      { error: "Document storage not provisioned yet" },
      { status: 503 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (await doc.findUnique({ where: { id } as any })) as
    | { userId: string }
    | null;
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist mutable fields. Anything else is silently dropped.
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.folderId === "string" || body.folderId === null) {
    data.folderId = body.folderId as string | null;
  }
  if (Array.isArray(body.tags)) data.tags = JSON.stringify(body.tags);
  if (Array.isArray(body.signerRoles)) {
    data.signerRoles = JSON.stringify(body.signerRoles);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await doc.update({ where: { id } as any, data: data as any });
  return NextResponse.json({ document: updated });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await ctx.params;

  const doc = getDocumentDelegate();
  if (!doc) {
    return NextResponse.json(
      { error: "Document storage not provisioned yet" },
      { status: 503 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (await doc.findUnique({ where: { id } as any })) as
    | { userId: string }
    | null;
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await doc.delete({ where: { id } as any });
  return NextResponse.json({ success: true });
}
