// ---------------------------------------------------------------------------
// Telnyx Ringless Voicemail wrapper.
//
// Approach: Telnyx Call Control with the `custom_storage_credentials` /
// answering-machine-detection (AMD) trick:
//
//   1. Dial the recipient with `answering_machine_detection='premium'` and
//      `answering_machine_detection_config.total_analysis_time_millis` tuned
//      so the call leg lands directly on the carrier's voicemail platform
//      WITHOUT pulling ring current on the handset.
//   2. On the AMD machine-detected webhook (`call.machine.premium.greeting.ended`)
//      the worker plays the pre-recorded `media_url` via `playback_start`.
//   3. Telnyx tears down the leg automatically on playback completion.
//
// Some carriers route this as a "voicemail-only call" via a special LRN
// gateway, billed at a fraction of a normal call. Others (T-Mobile, US Cellular)
// require the operator to configure a custom_storage_credentials entry on the
// connection profile so the carrier accepts the direct-to-VM hint — that's a
// one-time setup, not a per-call concern, so this wrapper just dials and lets
// the connection profile handle the routing.
//
// What this function returns:
//   The Telnyx `call_control_id`. The worker logs it; webhook callbacks
//   later attach call.status / call.recording to the same id for audit.
//
// Stub mode (no TELNYX_API_KEY) returns a deterministic synth id.
// ---------------------------------------------------------------------------

import { telnyx } from "@/lib/telnyx/client";

export interface SendRinglessVoicemailParams {
  /** Origination number in E.164. Must belong to the configured Call Control connection. */
  from: string;
  /** Recipient phone in E.164. */
  to: string;
  /** Public HTTPS URL to a pre-recorded MP3 or WAV (Cloudflare R2 / S3 recommended). */
  mediaUrl: string;
  /**
   * Telnyx Call Control connection id. Defaults to env
   * `TELNYX_CALL_CONTROL_CONNECTION_ID` — set this once per workspace.
   */
  connectionId?: string;
  /**
   * Optional webhook override for per-message tracking. Production uses the
   * connection's global webhook URL.
   */
  webhookUrl?: string;
  /**
   * Free-form correlation handle, surfaced via `client_state` in webhooks
   * (Telnyx base64-encodes this for us). Use Lead.id or Campaign.id.
   */
  correlationId?: string;
}

interface TelnyxCallResponse {
  call_control_id: string;
  call_leg_id: string;
  call_session_id?: string;
}

/**
 * Dispatch a ringless voicemail. Returns the Telnyx call_control_id; the
 * `call.machine.premium.greeting.ended` webhook handler triggers playback.
 */
export async function sendRinglessVoicemail(
  params: SendRinglessVoicemailParams,
): Promise<string> {
  const { from, to, mediaUrl } = params;
  const connectionId =
    params.connectionId ?? process.env.TELNYX_CALL_CONTROL_CONNECTION_ID;

  if (!from || !to || !mediaUrl) {
    throw new TypeError(
      `sendRinglessVoicemail: from/to/mediaUrl are required (from=${from}, to=${to}, hasMedia=${!!mediaUrl})`,
    );
  }
  if (!connectionId) {
    throw new Error(
      "sendRinglessVoicemail: connectionId or TELNYX_CALL_CONTROL_CONNECTION_ID is required",
    );
  }

  const client = telnyx();
  // POST /v2/calls with AMD = premium so Telnyx hands us a precise
  // machine-greeting-ended event. The actual `playback_start` happens in the
  // webhook handler (lib/telnyx/webhook-router.ts) once the recipient's
  // voicemail platform finishes its greeting.
  const res = await client.raw<TelnyxCallResponse>("POST", "/calls", {
    body: {
      to,
      from,
      connection_id: connectionId,
      // RVM-specific tuning:
      answering_machine_detection: "premium",
      answering_machine_detection_config: {
        // Wait long enough to catch the carrier's actual greeting ending,
        // not the short "hello" of a live human (which we abandon).
        total_analysis_time_millis: 5_000,
        greeting_total_analysis_time_millis: 10_000,
        greeting_duration_millis: 1_500,
        initial_silence_millis: 4_500,
      },
      // Pass the media URL through client_state so the webhook handler can
      // pull it out without a Redis hop. Telnyx base64-encodes this.
      client_state: Buffer.from(
        JSON.stringify({
          purpose: "rvm",
          mediaUrl,
          correlationId: params.correlationId ?? null,
        }),
      ).toString("base64"),
      webhook_url: params.webhookUrl,
    },
  });

  if (!res.data) {
    return `stub-rvm-${Date.now()}`;
  }
  return res.data.call_control_id;
}
