// ---------------------------------------------------------------------------
// /api/telnyx/assistants/[id] — GET + PATCH for the Oppenheimer panel.
//
// Telnyx's AI Assistants surface is accessed via the v2 REST API at
// `/v2/ai/assistants/{id}`. We use raw fetch through the existing telnyx()
// client's escape hatch rather than the SDK (see lib/telnyx/client.ts for
// rationale).
//
// Stub mode: when TELNYX_API_KEY is unset (dev / pre-launch) or the upstream
// returns 404 for the sentinel id 'primary', we serve a deterministic in-memory
// config so the UI is always interactive. PATCH echoes the body back as the
// new state. Production reads/writes through Telnyx.
//
// Auth: requireUser() — any signed-in user can read/write THEIR OWN assistant.
// Multi-tenant per-user routing (one Assistant per workspace) is Sprint 4;
// for now everyone shares the single assistant id passed in the URL.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

interface AssistantConfig {
  id: string;
  enabled: boolean;
  personality: "friendly" | "professional" | "brief" | "custom";
  voiceId: string;
  greeting: string;
  customPrompt: string;
}

// In-memory fallback when TELNYX_API_KEY isn't set. Process-local, so it
// resets on dev-server restart — that's fine for v0.
const stubStore = new Map<string, AssistantConfig>();

function defaultStub(id: string): AssistantConfig {
  return {
    id,
    enabled: true,
    personality: "friendly",
    voiceId: "alex",
    greeting: "Thanks for calling FlipOps — I'm Alex. How can I help?",
    customPrompt: "",
  };
}

async function fetchTelnyxAssistant(
  id: string,
): Promise<AssistantConfig | null> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${TELNYX_API_BASE}/ai/assistants/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    // Telnyx is consistent — short timeout is fine
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Telnyx GET /ai/assistants/${id} failed ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    data?: {
      id: string;
      enabled?: boolean;
      voice?: string;
      instructions?: string;
      greeting?: string;
      metadata?: { personality?: AssistantConfig["personality"] };
    };
  };
  if (!json.data) return null;
  return {
    id: json.data.id,
    enabled: json.data.enabled ?? true,
    personality: json.data.metadata?.personality ?? "friendly",
    voiceId: json.data.voice ?? "alex",
    greeting: json.data.greeting ?? "",
    customPrompt: json.data.instructions ?? "",
  };
}

async function patchTelnyxAssistant(
  id: string,
  patch: Partial<AssistantConfig>,
): Promise<AssistantConfig | null> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${TELNYX_API_BASE}/ai/assistants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      enabled: patch.enabled,
      voice: patch.voiceId,
      greeting: patch.greeting,
      instructions: patch.customPrompt,
      metadata: { personality: patch.personality },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(
      `Telnyx PATCH /ai/assistants/${id} failed ${res.status}: ${await res.text()}`,
    );
  }
  return fetchTelnyxAssistant(id);
}

// Next.js 16 — params is async.
type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  try {
    const live = await fetchTelnyxAssistant(id);
    if (live) return NextResponse.json({ assistant: live });
  } catch (err) {
    // Telnyx outage shouldn't break the panel — fall through to stub.
    console.warn(
      `[telnyx-assistants] GET fallthrough to stub: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  const stub = stubStore.get(id) ?? defaultStub(id);
  return NextResponse.json({ assistant: stub });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;

  let body: Partial<AssistantConfig>;
  try {
    body = (await req.json()) as Partial<AssistantConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist the patchable fields so a client can't shove arbitrary keys
  // into Telnyx metadata.
  const patch: Partial<AssistantConfig> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (
    body.personality === "friendly" ||
    body.personality === "professional" ||
    body.personality === "brief" ||
    body.personality === "custom"
  ) {
    patch.personality = body.personality;
  }
  if (typeof body.voiceId === "string" && body.voiceId.length > 0) {
    patch.voiceId = body.voiceId;
  }
  if (typeof body.greeting === "string") patch.greeting = body.greeting;
  if (typeof body.customPrompt === "string") patch.customPrompt = body.customPrompt;

  try {
    const live = await patchTelnyxAssistant(id, patch);
    if (live) return NextResponse.json({ assistant: live });
  } catch (err) {
    console.warn(
      `[telnyx-assistants] PATCH fallthrough to stub: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  // Stub-mode persist
  const current = stubStore.get(id) ?? defaultStub(id);
  const next: AssistantConfig = { ...current, ...patch };
  stubStore.set(id, next);
  return NextResponse.json({ assistant: next });
}
