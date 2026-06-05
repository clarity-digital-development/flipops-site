// ---------------------------------------------------------------------------
// POST /api/documents/[id]/duplicate
//
// Phase 6 — minimum-viable Documents backend.
// Clones a document row owned by the authenticated user. The clone:
//   - gets a fresh cuid id
//   - keeps the same title, prefixed with "Copy of "
//   - resets status to "draft"
//   - resets version to 1
//   - clears signedAt / expiresAt / envelopeId / fileUrlCurrent
//
// File-storage cloning (PDF copy in S3 / Vercel Blob) is deferred until those
// providers are wired up.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

interface DocumentRow {
  id: string;
  userId: string;
  title: string;
  status: string;
  docType: string;
  signerRoles: string | null;
  relatedEntity: string | null;
  relatedId: string | null;
  relatedName: string | null;
  tags: string | null;
  folderId: string | null;
  fileUrlCurrent: string | null;
  envelopeId: string | null;
  version: number;
  createdByUserId: string | null;
  createdByUserName: string | null;
  auditLog: string | null;
}

export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const { id } = await ctx.params;

  const client = prisma as unknown as {
    document?: {
      findUnique: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
  };
  const doc = client.document;
  if (!doc) {
    return NextResponse.json(
      { error: "Document storage not provisioned yet" },
      { status: 503 },
    );
  }

  const source = (await doc.findUnique({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { id } as any,
  })) as DocumentRow | null;
  if (!source) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (source.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clone = await doc.create({
    data: {
      userId: source.userId,
      title: source.title.startsWith("Copy of ")
        ? source.title
        : `Copy of ${source.title}`,
      status: "draft",
      docType: source.docType,
      signerRoles: source.signerRoles,
      relatedEntity: source.relatedEntity,
      relatedId: source.relatedId,
      relatedName: source.relatedName,
      tags: source.tags,
      folderId: source.folderId,
      version: 1,
      createdByUserId: source.createdByUserId,
      createdByUserName: source.createdByUserName,
      // Intentionally drop fileUrlCurrent / envelopeId / signedAt / expiresAt.
      auditLog: JSON.stringify([
        {
          action: "duplicated",
          timestamp: new Date().toISOString(),
          userId,
          details: `Duplicated from ${source.id}`,
        },
      ]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  return NextResponse.json({ document: clone }, { status: 201 });
}
