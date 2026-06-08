// ---------------------------------------------------------------------------
// POST /api/documents/[id]/envelope
//
// Sprint 3 — Lane 4 (DocuSign e-signature). The audit's blocker entry for
// /app/documents is "Send-for-signing path only emails PDF via Postmark (no
// actual signing envelope)." This route is the actual signing envelope.
//
// Behavior:
//   1. requireUser() — owner gate.
//   2. Load the Document, verify ownership.
//   3. Resolve PDF bytes (Document.fileUrl preferred; Document.content base64
//      as fallback).
//   4. Resolve signer routing list (Document.signerRoles; falls back to the
//      authenticated user's email if no signer is specified yet).
//   5. createEnvelope() against DocuSign, persist envelopeId + provider +
//      status='sent'.
//   6. Return { envelopeId, signerEmail } so the UI can toast the recipient.
//
// Notes:
//   - The Document model carries a `provider` enum (docusign / pandadoc /
//     hellosign) per the audit. We hard-code 'docusign' here — the model
//     supports the others, this route is DocuSign-specific.
//   - The defensive `getDocumentDelegate()` pattern mirrors the sibling routes
//     so this file keeps compiling before the Prisma schema patch lands.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import {
  createEnvelope,
  DocuSignError,
  type DocuSignSigner,
} from "@/lib/docusign/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function getDocumentDelegate() {
  const client = prisma as unknown as {
    document?: {
      findUnique: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };
  return client.document;
}

type SignerRole = {
  role: string;
  name?: string;
  email?: string;
  routingOrder?: number;
};

type DocumentRow = {
  id: string;
  userId: string;
  title: string;
  status?: string | null;
  provider?: string | null;
  envelopeId?: string | null;
  fileUrl?: string | null;
  content?: string | null; // base64-encoded PDF when fileUrl is absent
  signerRoles?: string | SignerRole[] | null;
  relatedName?: string | null;
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

async function loadPdfBase64(doc: DocumentRow): Promise<string | null> {
  // Preferred path: a fileUrl pointing at our storage layer (S3 / Vercel Blob).
  if (doc.fileUrl) {
    try {
      const res = await fetch(doc.fileUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.toString("base64");
    } catch {
      return null;
    }
  }
  // Fallback: caller already stashed a base64 PDF on the row.
  if (doc.content && typeof doc.content === "string") {
    return doc.content;
  }
  return null;
}

export async function POST(_req: Request, ctx: RouteContext) {
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
  if (existing.envelopeId) {
    return NextResponse.json(
      {
        error: "Document already has an envelope",
        envelopeId: existing.envelopeId,
      },
      { status: 409 },
    );
  }

  const pdfBase64 = await loadPdfBase64(existing);
  if (!pdfBase64) {
    return NextResponse.json(
      {
        error:
          "Document has no rendered PDF (set fileUrl or content before sending)",
      },
      { status: 422 },
    );
  }

  // Build signer list. Prefer roles persisted on the document; if none have an
  // email, fall back to the authenticated user so the envelope at least sends.
  const roles = parseSignerRoles(existing.signerRoles);
  const signers: DocuSignSigner[] = roles
    .filter((r) => r.email)
    .map((r, idx) => ({
      email: r.email as string,
      name: r.name || r.role || `Signer ${idx + 1}`,
      routingOrder: r.routingOrder ?? idx + 1,
    }));

  if (signers.length === 0) {
    if (!authEmail) {
      return NextResponse.json(
        { error: "No signer email on document and no fallback email on user" },
        { status: 422 },
      );
    }
    signers.push({ email: authEmail, name: authEmail, routingOrder: 1 });
  }

  try {
    const envelope = await createEnvelope({
      documents: [
        {
          name: `${existing.title}.pdf`,
          fileExtension: "pdf",
          documentBase64: pdfBase64,
        },
      ],
      signers,
      emailSubject: `Please sign: ${existing.title}`,
      emailBlurb: existing.relatedName
        ? `Related to ${existing.relatedName}.`
        : undefined,
      status: "sent",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await doc.update({
      where: { id } as any,
      data: {
        envelopeId: envelope.envelopeId,
        provider: "docusign",
        status: "sent",
        sentAt: new Date(),
      } as any,
    });

    return NextResponse.json({
      envelopeId: envelope.envelopeId,
      signerEmail: signers[0].email,
    });
  } catch (err) {
    if (err instanceof DocuSignError) {
      // 503 when DocuSign isn't configured, 502 otherwise so the UI can
      // differentiate "set up your account" from "DocuSign rejected this
      // payload."
      const status = err.status === 503 ? 503 : 502;
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status },
      );
    }
    console.error("[/api/documents/[id]/envelope] POST failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
