// ---------------------------------------------------------------------------
// POST /api/dialer/jwt
//
// Mints a short-lived Telnyx telephony JWT for the browser WebRTC client.
//
// The browser SDK (@telnyx/webrtc) authenticates against the Telnyx SIP
// gateway using a per-session JWT minted from a Telephony Credential. This
// keeps the long-lived TELNYX_API_KEY server-side; the browser only ever
// sees an ephemeral token bound to a single credential.
//
// Reference: https://developers.telnyx.com/docs/voice/programmable-voice/webrtc-quickstart
//   POST /v2/telephony_credentials/{id}/token  →  text/plain JWT body
//
// Env vars:
//   TELNYX_API_KEY                  (required) Bearer for the REST call
//   TELNYX_TELEPHONY_CREDENTIAL_ID  (required) The credential to mint against
//   TELNYX_SIP_USERNAME             (optional) Returned as-is for SDK login
//
// Auth: requireUser() — must be a signed-in FlipOps user. We never expose
// JWTs to anonymous traffic; that would let anyone burn Telnyx minutes on
// our credential.
//
// Failure mode: if either env var is unset, returns 503 + { configured:false }.
// The FlipPhone UI degrades to read-only "Telnyx not configured" instead
// of crashing. This matches the pattern used by lib/telnyx/webhook-router.ts
// (gated behind PHONECALL_MODEL_READY).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  const apiKey = process.env.TELNYX_API_KEY;
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID;
  const sipUsername = process.env.TELNYX_SIP_USERNAME ?? null;

  if (!apiKey || !credentialId) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Telnyx not configured. Set TELNYX_API_KEY + TELNYX_TELEPHONY_CREDENTIAL_ID.",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/plain",
        },
        // Telnyx returns the JWT as plain text in the response body.
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[dialer/jwt] Telnyx token mint failed status=${res.status} body=${detail.slice(0, 200)}`,
      );
      return NextResponse.json(
        { configured: true, error: "Telnyx token mint failed" },
        { status: 502 },
      );
    }

    const token = (await res.text()).trim();
    if (!token) {
      return NextResponse.json(
        { configured: true, error: "Empty token from Telnyx" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      configured: true,
      token,
      sipUsername,
      userId: guard.userId,
    });
  } catch (err) {
    console.error("[dialer/jwt] mint error", err);
    return NextResponse.json(
      { configured: true, error: "Internal error minting Telnyx token" },
      { status: 500 },
    );
  }
}
