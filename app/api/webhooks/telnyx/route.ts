// ---------------------------------------------------------------------------
// POST /api/webhooks/telnyx
//
// Ed25519 signature verification against TELNYX_PUBLIC_KEY env var, then route
// the parsed envelope through lib/telnyx/webhook-router.ts (already exists).
//
// Headers:
//   telnyx-signature-ed25519 — base64-encoded Ed25519 signature
//   telnyx-timestamp         — Unix timestamp (signed payload = `${ts}|${body}`)
//
// We return 200 fast even on routing failure — Telnyx retry storms are worse
// than dropped events. The router itself logs handler errors.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { routeTelnyxEvent } from "@/lib/telnyx/webhook-router";

function verifyEd25519(
  rawBody: string,
  timestamp: string,
  signature: string,
  publicKeyBase64: string,
): boolean {
  try {
    // Telnyx signs `${timestamp}|${rawBody}` with Ed25519.
    const payload = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
    const sigBuf = Buffer.from(signature, "base64");
    // Telnyx publishes the public key as raw base64. crypto.verify wants a
    // KeyObject; build it from a SPKI DER prefix + the raw 32 bytes.
    const rawKey = Buffer.from(publicKeyBase64, "base64");
    // Ed25519 SPKI DER prefix (12 bytes) + raw key (32 bytes) = 44 bytes total.
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const spki = Buffer.concat([spkiPrefix, rawKey]);
    const keyObj = crypto.createPublicKey({
      key: spki,
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, payload, keyObj, sigBuf);
  } catch (err) {
    console.error("[telnyx:webhook] signature verify error", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[telnyx:webhook] TELNYX_PUBLIC_KEY not set");
    // Still 200 so Telnyx doesn't retry-loop. Misconfig is on us.
    return NextResponse.json({ ok: true, note: "public_key_unset" });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("telnyx-signature-ed25519") ?? "";
  const timestamp = request.headers.get("telnyx-timestamp") ?? "";

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  if (!verifyEd25519(rawBody, timestamp, signature, publicKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let envelope: any;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await routeTelnyxEvent(envelope);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[telnyx:webhook] router threw", err);
    // Swallow handler errors — 200 prevents retry storms. Errors land in logs.
    return NextResponse.json({ ok: true, handled: false, note: "router_error" });
  }
}
