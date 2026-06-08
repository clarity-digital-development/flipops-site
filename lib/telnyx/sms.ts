// ---------------------------------------------------------------------------
// Telnyx 10DLC SMS wrapper — sendSMS({ from, to, body }) → message id.
//
// Calls POST https://api.telnyx.com/v2/messages with the messaging-profile
// fallback baked into Telnyx (the `from` number's profile is used for routing,
// throughput, opt-out auto-handling, and STIR/SHAKEN attestation).
//
// We deliberately do NOT pull in @telnyx/node — see the note in client.ts.
// This module is the single SMS surface; the dialer-dispatch worker calls it
// after passing the TCPA quiet-hours gate.
//
// On stub mode (TELNYX_API_KEY unset) the underlying `request()` returns
// `{ data: undefined }` and we synthesize a deterministic stub id so the
// caller's audit row still has something to log.
// ---------------------------------------------------------------------------

import { telnyx, TelnyxError } from "@/lib/telnyx/client";

export interface SendSMSParams {
  /** Origination number in E.164 (e.g. '+19045550199'). Must be a Telnyx-owned + 10DLC-registered number. */
  from: string;
  /** Recipient phone in E.164 (e.g. '+19045551234'). */
  to: string;
  /** Message body. Telnyx will segment automatically. */
  body: string;
  /**
   * Optional Telnyx Messaging Profile ID. When omitted, Telnyx routes by the
   * `from` number's assigned profile, which is the normal case.
   */
  messagingProfileId?: string;
  /**
   * Optional webhook override. Production wires the global webhook URL on the
   * Messaging Profile, so this is only for per-message override during tests.
   */
  webhookUrl?: string;
}

interface TelnyxMessageResponse {
  id: string;
  record_type?: string;
  direction?: string;
  to?: Array<{ phone_number: string; status: string }>;
  from?: { phone_number: string };
  text?: string;
}

/**
 * Send an SMS via Telnyx Messaging. Returns the Telnyx message id (UUID).
 *
 * Throws `TelnyxError` on a 4xx/5xx from the carrier. The dialer-dispatch
 * worker catches that and routes to the dispatch-failed audit path.
 */
export async function sendSMS(params: SendSMSParams): Promise<string> {
  const { from, to, body, messagingProfileId, webhookUrl } = params;

  if (!from || !to || !body) {
    throw new TypeError(
      `sendSMS: from/to/body are required (from=${from}, to=${to}, bodyLen=${body?.length ?? 0})`,
    );
  }

  const client = telnyx();
  const res = await client.raw<TelnyxMessageResponse>("POST", "/messages", {
    body: {
      from,
      to,
      text: body,
      messaging_profile_id: messagingProfileId,
      webhook_url: webhookUrl,
    },
  });

  // Stub mode (no TELNYX_API_KEY) — synthesize a deterministic id so audit
  // rows still carry something traceable. Logging happens in client.ts.
  if (!res.data) {
    return `stub-sms-${Date.now()}`;
  }
  return res.data.id;
}
