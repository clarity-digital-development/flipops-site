// ---------------------------------------------------------------------------
// POST /api/webhooks/docusign
//
// DocuSign Connect webhook receiver. Verifies the HMAC signature DocuSign
// adds when "Include HMAC Signature" is enabled on the Connect config
// (header `X-DocuSign-Signature-1`), then maps the envelope event to the
// Document.status enum.
//
// We accept both DocuSign Connect REST/JSON payloads and the legacy XML
// payloads (sniffed by Content-Type) so the same endpoint works regardless of
// which format the operator picks in the Connect admin UI.
//
// Status mapping (envelope status → Document.status):
//   sent       → sent
//   delivered  → delivered
//   signed     → signed       (one signer of N has signed)
//   completed  → completed    (all signers have signed)
//   declined   → void
//   voided     → void
//   expired    → expired
//
// We return 200 OK on signature failure ONLY for unknown events; for actual
// bad signatures we return 401 so the operator notices in DocuSign's retry
// dashboard.
// ---------------------------------------------------------------------------

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapEnvelopeStatusToDocStatus } from "@/lib/docusign/client";

export const dynamic = "force-dynamic";

function getDocumentDelegate() {
  const client = prisma as unknown as {
    document?: {
      findFirst: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };
  return client.document;
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_HMAC;
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type ParsedEvent = {
  envelopeId: string;
  status: string;
};

function parseJsonPayload(text: string): ParsedEvent | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    // DocuSign Connect REST format:
    //   { event: "envelope-completed", data: { envelopeId, envelopeSummary: { status } } }
    const data = (json.data || json) as Record<string, unknown>;
    const envelopeId =
      (data.envelopeId as string) ||
      ((data.envelopeSummary as Record<string, unknown>)?.envelopeId as string);
    const summary = data.envelopeSummary as Record<string, unknown> | undefined;
    const status =
      (summary?.status as string) ||
      (data.status as string) ||
      (json.event as string)?.replace(/^envelope-/, "");
    if (!envelopeId || !status) return null;
    return { envelopeId, status };
  } catch {
    return null;
  }
}

function parseXmlPayload(text: string): ParsedEvent | null {
  // Avoid a full XML parser dep: pull the two tags we need via regex.
  // Connect legacy XML wraps the envelope under <EnvelopeStatus>.
  const idMatch = text.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/i);
  // The <Status> tag we want is the first one inside <EnvelopeStatus>; XML
  // also has per-recipient <Status> entries, so anchor to the envelope block.
  const statusBlock = text.match(/<EnvelopeStatus>([\s\S]*?)<\/EnvelopeStatus>/i);
  const statusMatch = statusBlock?.[1].match(/<Status>([^<]+)<\/Status>/i);
  if (!idMatch || !statusMatch) return null;
  return { envelopeId: idMatch[1].trim(), status: statusMatch[1].trim() };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-docusign-signature-1") ||
    req.headers.get("X-DocuSign-Signature-1");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const event = contentType.includes("xml")
    ? parseXmlPayload(rawBody)
    : parseJsonPayload(rawBody);

  if (!event) {
    // Unknown payload shape — ack with 200 so DocuSign doesn't retry forever,
    // but log so we can backfill the parser.
    console.warn("[/api/webhooks/docusign] Unparseable payload");
    return NextResponse.json({ received: true });
  }

  const newStatus = mapEnvelopeStatusToDocStatus(event.status);
  if (!newStatus) {
    return NextResponse.json({ received: true, ignored: event.status });
  }

  const doc = getDocumentDelegate();
  if (!doc) {
    // Schema not migrated yet — ack anyway so DocuSign doesn't retry.
    return NextResponse.json({ received: true, pending_migration: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const document = (await doc.findFirst({
    where: { envelopeId: event.envelopeId } as any,
  })) as { id: string; status?: string | null } | null;

  if (!document) {
    // Envelope not tied to a Document row — ack so DocuSign stops retrying.
    return NextResponse.json({ received: true, matched: false });
  }

  // Idempotent: only write when the status actually changed.
  if (document.status !== newStatus) {
    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completed" || newStatus === "signed") {
      data.signedAt = new Date();
    }
    if (newStatus === "void") {
      data.voidedAt = new Date();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await doc.update({ where: { id: document.id } as any, data: data as any });
  }

  return NextResponse.json({ received: true, status: newStatus });
}
