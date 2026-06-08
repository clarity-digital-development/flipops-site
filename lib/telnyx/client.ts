/**
 * Telnyx API Client (REST v2)
 * --------------------------------------------------------------------------
 * Native-fetch wrapper around the Telnyx Call Control REST API.
 *
 * Why not @telnyx/node?
 *   - Not installed in package.json (verified 2026-06-08).
 *   - The SDK pulls in node-form-data + node-fetch shims which conflict with
 *     Next.js 16 / React 19 edge runtime. Native fetch is universal.
 *   - We only need ~6 endpoints — not worth 200kb of SDK.
 *
 * Auth: Bearer token via TELNYX_API_KEY env var.
 * Docs: https://developers.telnyx.com/api/call-control
 */

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

export interface TelnyxClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface TelnyxResponse<T = unknown> {
  data?: T;
  errors?: Array<{ code: string; title: string; detail?: string }>;
}

export class TelnyxError extends Error {
  status: number;
  errors: Array<{ code: string; title: string; detail?: string }>;
  constructor(message: string, status: number, errors: TelnyxError['errors'] = []) {
    super(message);
    this.name = 'TelnyxError';
    this.status = status;
    this.errors = errors;
  }
}

function getApiKey(opt?: string): string | null {
  return opt ?? process.env.TELNYX_API_KEY ?? null;
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; apiKey?: string; baseUrl?: string; timeoutMs?: number } = {}
): Promise<TelnyxResponse<T>> {
  const apiKey = getApiKey(opts.apiKey);
  if (!apiKey) {
    // Stub-mode: log and return empty. Lets dev environments boot without
    // credentials — useful during Sprint 2 scaffolding.
    console.warn(`[telnyx] TELNYX_API_KEY not set — stub call to ${method} ${path}`);
    return { data: undefined };
  }

  const baseUrl = opts.baseUrl ?? TELNYX_API_BASE;
  const url = `${baseUrl}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as TelnyxResponse<T>) : {};

    if (!res.ok) {
      throw new TelnyxError(
        `Telnyx ${method} ${path} failed (${res.status})`,
        res.status,
        json.errors ?? []
      );
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------
// Call Control endpoints (Sprint 3 surface area)
// ----------------------------------------------------------------------------

export interface CallControlIdParams {
  callControlId: string;
}

export function createTelnyxClient(options: TelnyxClientOptions = {}) {
  const apiKey = options.apiKey;
  const baseUrl = options.baseUrl;
  const timeoutMs = options.timeoutMs;
  const opts = { apiKey, baseUrl, timeoutMs };

  return {
    /** Place an outbound call. */
    dial(params: {
      to: string;
      from: string;
      connectionId: string;
      audioUrl?: string;
      clientState?: string;
      webhookUrl?: string;
    }) {
      return request<{ call_control_id: string; call_leg_id: string }>(
        'POST',
        '/calls',
        {
          ...opts,
          body: {
            to: params.to,
            from: params.from,
            connection_id: params.connectionId,
            audio_url: params.audioUrl,
            client_state: params.clientState,
            webhook_url: params.webhookUrl,
          },
        }
      );
    },

    /** Answer an inbound call. */
    answer(p: CallControlIdParams & { clientState?: string }) {
      return request('POST', `/calls/${p.callControlId}/actions/answer`, {
        ...opts,
        body: { client_state: p.clientState },
      });
    },

    /** Hang up an active call. */
    hangup(p: CallControlIdParams) {
      return request('POST', `/calls/${p.callControlId}/actions/hangup`, opts);
    },

    /** Blind transfer to another number. */
    transfer(p: CallControlIdParams & { to: string; from?: string }) {
      return request('POST', `/calls/${p.callControlId}/actions/transfer`, {
        ...opts,
        body: { to: p.to, from: p.from },
      });
    },

    /** Start playback of an audio file. */
    playbackStart(p: CallControlIdParams & { audioUrl: string; loop?: number }) {
      return request('POST', `/calls/${p.callControlId}/actions/playback_start`, {
        ...opts,
        body: { audio_url: p.audioUrl, loop: p.loop },
      });
    },

    /** Start call recording. */
    recordStart(p: CallControlIdParams & { format?: 'wav' | 'mp3'; channels?: 'single' | 'dual' }) {
      return request('POST', `/calls/${p.callControlId}/actions/record_start`, {
        ...opts,
        body: { format: p.format ?? 'mp3', channels: p.channels ?? 'dual' },
      });
    },

    /** Start real-time transcription. */
    transcriptionStart(p: CallControlIdParams & { language?: string }) {
      return request('POST', `/calls/${p.callControlId}/actions/transcription_start`, {
        ...opts,
        body: { language: p.language ?? 'en' },
      });
    },

    /** Speak text via TTS. */
    speak(p: CallControlIdParams & { payload: string; voice?: string; language?: string }) {
      return request('POST', `/calls/${p.callControlId}/actions/speak`, {
        ...opts,
        body: {
          payload: p.payload,
          voice: p.voice ?? 'female',
          language: p.language ?? 'en-US',
        },
      });
    },

    /** Generic escape hatch for endpoints not yet wrapped. */
    raw: request,
  };
}

export type TelnyxClient = ReturnType<typeof createTelnyxClient>;

/** Singleton — lazy so importing this module does not require env at boot. */
let _singleton: TelnyxClient | null = null;
export function telnyx(): TelnyxClient {
  if (!_singleton) _singleton = createTelnyxClient();
  return _singleton;
}
