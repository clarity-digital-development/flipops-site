// ---------------------------------------------------------------------------
// lib/batchdata/client.ts — BatchData skip-trace API wrapper.
//
// Single public function: skipTraceProperty({ address, city, state, zip })
// → { phones, emails, ownerName, mailingAddress }
//
// Design notes:
//   - Reads BATCHDATA_API_KEY at CALL time (not module load) so a missing key
//     is a recoverable per-request 503 rather than a crash on cold boot.
//   - Throws `BatchDataNotConfiguredError` when the key is absent so callers
//     can map it to a humane 503 with a specific message. All other failures
//     (network, 4xx, 5xx) bubble as a regular Error.
//   - Normalizes the response shape: BatchData's actual payload nests phones
//     under `phoneNumbers: [{ number, type, score }]` or sometimes returns a
//     flat `phones: string[]`. We accept either and emit a clean string[].
//   - This is the same endpoint the weekly cron at
//     lib/cron/discovery/skip-tracing-enrichment.ts uses, kept as a separate
//     file so the cron path and the new client-callable route share zero
//     state but agree on the wire format.
// ---------------------------------------------------------------------------

const BATCHDATA_API_BASE = "https://api.batchdata.com/api/v1";

export class BatchDataNotConfiguredError extends Error {
  code = "BATCHDATA_NOT_CONFIGURED" as const;
  constructor() {
    super("BATCHDATA_API_KEY is not set");
    this.name = "BatchDataNotConfiguredError";
  }
}

export interface SkipTraceAddressInput {
  address: string; // street
  city: string;
  state: string;
  zip: string;
}

export interface SkipTraceResult {
  phones: string[];
  emails: string[];
  ownerName: string | null;
  mailingAddress: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  /** Raw upstream payload, kept for audit + future fields without a refactor. */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Internal: response normalizers. BatchData's docs and live responses don't
// perfectly agree on field names — we coerce both common shapes into a flat
// string[] of valid-looking values.
// ---------------------------------------------------------------------------

function normalizePhones(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "number" in p && typeof (p as { number: unknown }).number === "string") {
          return (p as { number: string }).number;
        }
        return null;
      })
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  }
  return [];
}

function normalizeEmails(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object" && "address" in e && typeof (e as { address: unknown }).address === "string") {
          return (e as { address: string }).address;
        }
        return null;
      })
      .filter((e): e is string => typeof e === "string" && /@/.test(e));
  }
  return [];
}

function normalizeOwnerName(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const o = input as { fullName?: unknown; firstName?: unknown; lastName?: unknown };
  if (typeof o.fullName === "string" && o.fullName.trim().length > 0) return o.fullName;
  const parts = [o.firstName, o.lastName].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
}

function normalizeMailingAddress(input: unknown): SkipTraceResult["mailingAddress"] {
  if (!input || typeof input !== "object") return null;
  const m = input as { street?: unknown; city?: unknown; state?: unknown; zip?: unknown };
  const out: NonNullable<SkipTraceResult["mailingAddress"]> = {};
  if (typeof m.street === "string") out.street = m.street;
  if (typeof m.city === "string") out.city = m.city;
  if (typeof m.state === "string") out.state = m.state;
  if (typeof m.zip === "string") out.zip = m.zip;
  return Object.keys(out).length > 0 ? out : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a single-address skip trace against BatchData.
 *
 * @throws BatchDataNotConfiguredError when BATCHDATA_API_KEY is missing.
 * @throws Error on network failure or non-2xx response.
 */
export async function skipTraceProperty(
  input: SkipTraceAddressInput,
): Promise<SkipTraceResult> {
  const apiKey = process.env.BATCHDATA_API_KEY;
  if (!apiKey) throw new BatchDataNotConfiguredError();

  const url = `${BATCHDATA_API_BASE}/property/skip-trace`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          address: {
            street: input.address,
            city: input.city,
            state: input.state,
            zip: input.zip,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `BatchData API error: ${res.status} ${res.statusText}${errText ? ` — ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const payload = (await res.json()) as unknown;

  // BatchData typically wraps the per-request result in `results[0]`. Fall back
  // to the top-level object so we work against both response shapes.
  let record: Record<string, unknown> | null = null;
  if (payload && typeof payload === "object") {
    const p = payload as { results?: unknown };
    if (Array.isArray(p.results) && p.results.length > 0 && typeof p.results[0] === "object") {
      record = p.results[0] as Record<string, unknown>;
    } else {
      record = payload as Record<string, unknown>;
    }
  }

  const phonesRaw = record?.phones ?? record?.phoneNumbers ?? null;
  const emailsRaw = record?.emails ?? null;
  const ownerRaw = record?.owner ?? null;
  const mailingRaw = record?.mailingAddress ?? null;

  return {
    phones: normalizePhones(phonesRaw),
    emails: normalizeEmails(emailsRaw),
    ownerName: normalizeOwnerName(ownerRaw),
    mailingAddress: normalizeMailingAddress(mailingRaw),
    raw: payload,
  };
}
