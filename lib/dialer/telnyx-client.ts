// ---------------------------------------------------------------------------
// useTelnyxClient — React hook wrapping @telnyx/webrtc's TelnyxRTC class.
//
// Lifecycle:
//   1. On mount, POST /api/dialer/jwt to mint a per-session JWT.
//   2. Instantiate TelnyxRTC over WSS with the JWT.
//   3. Subscribe to telnyx.notification events; map SDK call states to our
//      FlipPhone UI state machine (idle | dialing | ringing | active | ended).
//   4. On unmount, hang up any active call + disconnect from the gateway.
//
// Why a hook and not a Provider?
//   The FlipPhone is the only consumer today. A hook keeps the surface tiny
//   and avoids leaking the SDK singleton across the rest of the app. If we
//   later need shared state (e.g. caller-id selector synced with Oppenheimer)
//   we'll lift this into a Context — for now, YAGNI.
//
// Graceful degradation:
//   - /api/dialer/jwt 503 → hook returns { error, configured: false } and
//     all action methods are no-ops. FlipPhone keeps rendering.
//   - WSS connect failure → hook surfaces error string, no crash.
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The SDK lives at @telnyx/webrtc. We use dynamic import so SSR doesn't try
// to evaluate WebRTC code at module load.
// (TelnyxRTC depends on browser-only WebSocket + RTCPeerConnection globals.)
//
// Typed loosely on purpose — the SDK's public surface is small and stable
// enough that pinning to opaque shapes is safer than chasing minor type
// drift across 2.x minor versions.
type SdkCallState =
  | "new"
  | "trying"
  | "requesting"
  | "recovering"
  | "ringing"
  | "answering"
  | "early"
  | "active"
  | "held"
  | "hangup"
  | "destroy"
  | "purge";

interface SdkCall {
  id?: string;
  state: SdkCallState;
  hangup: () => void;
  muteAudio: () => void;
  unmuteAudio: () => void;
  hold: () => void;
  unhold: () => void;
  dtmf: (digit: string) => void;
}

interface SdkClient {
  on: (event: string, handler: (n: unknown) => void) => void;
  connect: () => void;
  disconnect: () => void;
  newCall: (opts: {
    destinationNumber: string;
    callerNumber?: string;
    audio?: boolean;
    video?: boolean;
  }) => SdkCall;
}

export type TelnyxCallState =
  | "idle"
  | "dialing"
  | "ringing"
  | "active"
  | "ended";

function mapSdkState(s: SdkCallState | undefined): TelnyxCallState {
  switch (s) {
    case "new":
    case "trying":
    case "requesting":
    case "recovering":
      return "dialing";
    case "ringing":
    case "answering":
    case "early":
      return "ringing";
    case "active":
    case "held":
      return "active";
    case "hangup":
    case "destroy":
    case "purge":
      return "ended";
    default:
      return "idle";
  }
}

export interface UseTelnyxClient {
  /** Current high-level UI state. */
  state: TelnyxCallState;
  /** True while there's an active or connecting call. */
  callActive: boolean;
  /** Latest connect/auth error, if any. Null when healthy. */
  error: string | null;
  /** True once /api/dialer/jwt returned a token AND WSS is connected. */
  ready: boolean;
  /** Whether Telnyx env vars are configured server-side. */
  configured: boolean;
  /** Telnyx call_control_id for the active call, if known. */
  activeCallId: string | null;
  /** Local SDK-reflected mute state. */
  isMuted: boolean;
  /** Local SDK-reflected hold state. */
  isHeld: boolean;
  /** Seconds since the call went 'active'. */
  callSeconds: number;
  /** Place an outbound call. */
  dialNumber: (destinationNumber: string, callerNumber?: string) => Promise<void>;
  /** Hang up the active call. Safe to call when idle. */
  hangup: () => Promise<void>;
  /** Toggle mute on the active call. */
  mute: () => void;
  /** Toggle hold on the active call. */
  hold: () => void;
  /** Send a DTMF tone on the active call. */
  sendDTMF: (digit: string) => void;
}

export function useTelnyxClient(): UseTelnyxClient {
  const [state, setState] = useState<TelnyxCallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const clientRef = useRef<SdkClient | null>(null);
  const callRef = useRef<SdkCall | null>(null);
  const timerRef = useRef<number | null>(null);

  // ---- connect on mount ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/dialer/jwt", { method: "POST" });
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setConfigured(false);
            setError(body?.error ?? "Telnyx not configured");
          }
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body?.error ?? `JWT mint failed (${res.status})`);
          return;
        }
        const { token, sipUsername } = (await res.json()) as {
          token: string;
          sipUsername: string | null;
        };

        // Lazy-load SDK to avoid SSR evaluation.
        const mod = (await import("@telnyx/webrtc")) as unknown as {
          TelnyxRTC: new (opts: {
            login_token?: string;
            login?: string;
            password?: string;
          }) => SdkClient;
        };

        const TelnyxRTC = mod.TelnyxRTC;
        const client: SdkClient = sipUsername
          ? new TelnyxRTC({ login: sipUsername, password: token })
          : new TelnyxRTC({ login_token: token });

        client.on("telnyx.ready", () => {
          if (!cancelled) setReady(true);
        });
        client.on("telnyx.error", (n: unknown) => {
          const msg =
            (n as { error?: { message?: string } })?.error?.message ??
            "Telnyx error";
          if (!cancelled) setError(msg);
        });
        client.on("telnyx.socket.close", () => {
          if (!cancelled) setReady(false);
        });
        client.on("telnyx.notification", (n: unknown) => {
          const note = n as { type?: string; call?: SdkCall };
          if (note?.type === "callUpdate" && note.call) {
            const call = note.call;
            callRef.current = call;
            const next = mapSdkState(call.state);
            setState(next);
            setActiveCallId(call.id ?? null);

            if (next === "active") {
              startTimer();
            }
            if (next === "ended") {
              stopTimer();
              // Reset transient flags so the next call starts clean.
              setIsMuted(false);
              setIsHeld(false);
              callRef.current = null;
            }
          }
        });

        client.connect();
        clientRef.current = client;
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Telnyx init failed";
          setError(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        callRef.current?.hangup();
      } catch {
        /* noop */
      }
      try {
        clientRef.current?.disconnect();
      } catch {
        /* noop */
      }
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- timer --------------------------------------------------------------
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return;
    setCallSeconds(0);
    timerRef.current = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ---- actions ------------------------------------------------------------
  const dialNumber = useCallback(
    async (destinationNumber: string, callerNumber?: string) => {
      const client = clientRef.current;
      if (!client) {
        setError("Telnyx client not ready");
        return;
      }
      try {
        const call = client.newCall({
          destinationNumber,
          callerNumber,
          audio: true,
          video: false,
        });
        callRef.current = call;
        setState("dialing");
        setActiveCallId(call.id ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Dial failed";
        setError(msg);
      }
    },
    [],
  );

  const hangup = useCallback(async () => {
    const call = callRef.current;
    if (!call) {
      setState("idle");
      return;
    }
    try {
      call.hangup();
    } catch {
      /* noop */
    }
    setState("ended");
    stopTimer();
  }, [stopTimer]);

  const mute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    if (isMuted) {
      call.unmuteAudio();
      setIsMuted(false);
    } else {
      call.muteAudio();
      setIsMuted(true);
    }
  }, [isMuted]);

  const hold = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    if (isHeld) {
      call.unhold();
      setIsHeld(false);
    } else {
      call.hold();
      setIsHeld(true);
    }
  }, [isHeld]);

  const sendDTMF = useCallback((digit: string) => {
    const call = callRef.current;
    if (!call) return;
    try {
      call.dtmf(digit);
    } catch {
      /* noop */
    }
  }, []);

  return {
    state,
    callActive: state !== "idle" && state !== "ended",
    error,
    ready,
    configured,
    activeCallId,
    isMuted,
    isHeld,
    callSeconds,
    dialNumber,
    hangup,
    mute,
    hold,
    sendDTMF,
  };
}
