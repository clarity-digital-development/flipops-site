// ---------------------------------------------------------------------------
// POST /api/documents/[id]/sign-url
//
// Returns a short-lived (~5min) DocuSign embedded signing URL for the
// Document's envelope. The UI can render this in an iframe so the signer
// completes the envelope without leaving FlipOps.
//
// Request body (all optional):
//   { signerEmail?: string, signerName?: string, returnUrl?: string }
//
// Defaults:
//   - signerEmail → first email in Document.signerRoles, falls back to the
//     authenticated user's email.
//   - signerName  → matching role name, falls back to email-as-name.
//   - returnUrl   → `${request.origin}/app/documents?signed=<id>` so the
//     signer lands back in the Documents tab.
//
// Auth: requireUser(); ownership-checked.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { getRecipientView, DocuSignError } from "@/lib/docusign/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function getDocumentDelegate() {
  const client = prisma as unknown as {
    document?: { findUnique: (args: unknown) => Promise<unknown> };
  };
  return client.document;
}

type SignerRole = { role: string; name?: string; email?: string };
type DocumentRow = {
  id: string;
  userId: string;
  envelopeId?: string | null;
  signerRoles?: string | SignerRole[] | null;
};

function parseSignerRoles(raw: DocumentRow["signerRoles"]): SignerRole[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SignerRole[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

export async function POST(req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId, email: authEmail } = guard;

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
    | DocumentRow
    | null;
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!existing.envelopeId) {
    return NextResponse.json(
      { error: "Document has no envelope yet (POST /envelope first)" },
      { status: 409 },
    );
  }

  let body: {
    signerEmail?: string;
    signerName?: string;
    returnUrl?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty body is fine
  }

  const roles = parseSignerRoles(existing.signerRoles);
  const firstWithEmail = roles.find((r) => r.email);
  const signerEmail =
    body.signerEmail || firstWithEmail?.email || authEmail || undefined;
  if (!signerEmail) {
    return NextResponse.json(
      { error: "Could not resolve a signer email for this envelope" },
      { status: 422 },
    );
  }
  const signerName =
    body.signerName ||
    firstWithEmail?.name ||
    firstWithEmail?.role ||
    signerEmail;

  // Default the return URL to the Documents tab with a query param the page
  // can read on mount to flash a "Thanks for signing!" toast.
  let returnUrl = body.returnUrl;
  if (!returnUrl) {
    try {
      const origin = new URL(req.url).origin;
      returnUrl = `${origin}/app/documents?signed=${encodeURIComponent(id)}`;
    } catch {
      returnUrl = "/app/documents";
    }
  }

  try {
    const view = await getRecipientView({
      envelopeId: existing.envelopeId,
      signerEmail,
      signerName,
      returnUrl,
    });
    // DocuSign recipient view URLs expire in ~5 minutes. Surface that so the
    // UI can decide whether to refetch before opening the iframe.
    return NextResponse.json({ url: view.url, expiresIn: 300 });
  } catch (err) {
    if (err instanceof DocuSignError) {
      const status = err.status === 503 ? 503 : 502;
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status },
      );
    }
    console.error("[/api/documents/[id]/sign-url] POST failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
