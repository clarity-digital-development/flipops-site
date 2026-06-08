// ---------------------------------------------------------------------------
// POST + GET /api/webhooks/nylas
//
// - GET: Nylas challenge handshake — echo back the `challenge` query param so
//   Nylas accepts the endpoint registration.
// - POST: HMAC-SHA256 verification against NYLAS_WEBHOOK_SECRET, then route
//   inbound message events into Property.contactNotes when the sender's email
//   matches a Property.emails entry. Returns 200 fast so Nylas doesn't retry.
//
// Persistence model: we DON'T add a new table here. Property.contactNotes is
// a JSON array column with shape [{date, note, method, sentiment}] — we append
// one entry per matched inbound message. Mismatched senders are logged and
// dropped (no spurious rows).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Nylas registration handshake: ?challenge=<random>. Echo it back as plain text.
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: true });
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // timingSafeEqual requires equal lengths.
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function extractEmail(addr: unknown): string | null {
  if (typeof addr === "string") return addr.toLowerCase().trim() || null;
  if (addr && typeof addr === "object") {
    const e = (addr as { email?: unknown }).email;
    if (typeof e === "string") return e.toLowerCase().trim() || null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[nylas:webhook] NYLAS_WEBHOOK_SECRET not set");
    // Return 200 anyway so Nylas doesn't retry-loop the dead endpoint.
    return NextResponse.json({ ok: true, note: "secret_unset" });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-nylas-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse the envelope. Nylas v3 sends { type, data: { object: {...} } }.
  let envelope: any;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = envelope?.type ?? "";
  const messageObj = envelope?.data?.object;

  // Only persist inbound message-related events. Other types (calendar, etc.)
  // are accepted with 200 so Nylas marks them delivered.
  if (!eventType.startsWith("message") || !messageObj) {
    return NextResponse.json({ ok: true });
  }

  const fromList: unknown[] = Array.isArray(messageObj.from) ? messageObj.from : [];
  const fromEmails = fromList
    .map(extractEmail)
    .filter((e): e is string => Boolean(e));

  if (fromEmails.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Find any Property whose emails JSON column contains one of these senders.
  // Property.emails is a JSON-encoded string[] — we LIKE-match on the raw
  // serialized form to avoid loading every Property row.
  const orClauses = fromEmails.map((e) => ({
    emails: { contains: e } as const,
  }));

  const matches = await prisma.property.findMany({
    where: { OR: orClauses },
    select: { id: true, contactNotes: true, emails: true },
    take: 25, // cap blast-radius; same sender may exist on many leads
  });

  if (matches.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const noteEntry = {
    date: new Date().toISOString(),
    note: messageObj.subject ?? messageObj.snippet ?? "Inbound email",
    method: "email",
    sentiment: "neutral",
    nylasMessageId: messageObj.id ?? null,
    fromEmail: fromEmails[0],
  };

  // Append the note to each matched Property.contactNotes JSON array.
  await Promise.all(
    matches.map(async (p) => {
      let arr: unknown[] = [];
      if (p.contactNotes) {
        try {
          const parsed = JSON.parse(p.contactNotes);
          if (Array.isArray(parsed)) arr = parsed;
        } catch {
          // malformed — overwrite
        }
      }
      arr.push(noteEntry);
      await prisma.property.update({
        where: { id: p.id },
        data: { contactNotes: JSON.stringify(arr) },
      });
    }),
  );

  return NextResponse.json({ ok: true, matched: matches.length });
}
