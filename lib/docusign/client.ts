// ---------------------------------------------------------------------------
// lib/docusign/client.ts
//
// DocuSign eSignature REST API client. Lane 4 of the Sprint 3 audit follow-up
// (E-signature — "DEAD-UI-AND-PROVIDER-AUDIT-2026-06-08.md").
//
// Auth: JWT consent grant (RS256). The caller does the one-time consent grant
// in the DocuSign admin portal; from then on the server can mint access tokens
// without a refresh-token dance. See:
//   https://developers.docusign.com/platform/auth/jwt/jwt-get-token/
//
// Env vars (lazy-read so the module can be imported in environments where
// DocuSign isn't configured yet):
//
//   DOCUSIGN_INTEGRATION_KEY     OAuth client_id of the integration
//   DOCUSIGN_USER_ID             API username (GUID) of the impersonated user
//   DOCUSIGN_ACCOUNT_ID          DocuSign account GUID
//   DOCUSIGN_PRIVATE_KEY         RSA private key PEM (supports `\n` escapes)
//   DOCUSIGN_BASE_URL            Optional override; defaults to demo. Set to
//                                  https://www.docusign.net   for production.
//                                Auth host is derived from this:
//                                  account-d.docusign.com  for demo,
//                                  account.docusign.com    for production.
//
// No external dependencies: uses Node's `crypto` for the JWT signature and the
// built-in `fetch` for HTTP. Throws typed DocuSignError so callers can map to
// 4xx vs 5xx.
// ---------------------------------------------------------------------------

import crypto from "crypto";

export class DocuSignError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "DocuSignError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Config (lazy)
// ---------------------------------------------------------------------------

type DocuSignConfig = {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  baseUrl: string; // e.g. https://demo.docusign.net  (no trailing slash)
  authHost: string; // e.g. account-d.docusign.com    (host only, no scheme)
};

function readConfig(): DocuSignConfig {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const rawKey = process.env.DOCUSIGN_PRIVATE_KEY;
  if (!integrationKey || !userId || !accountId || !rawKey) {
    throw new DocuSignError(
      "DocuSign client is not configured (missing env vars)",
      503,
    );
  }
  // Support env files that escape newlines in the PEM.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  // Default to demo. Operators flip DOCUSIGN_BASE_URL to the production REST
  // host (e.g. https://na3.docusign.net) when ready.
  const baseUrl = (
    process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net"
  ).replace(/\/$/, "");
  const isDemo = baseUrl.includes("demo.docusign.net");
  const authHost = isDemo ? "account-d.docusign.com" : "account.docusign.com";

  return { integrationKey, userId, accountId, privateKey, baseUrl, authHost };
}

// ---------------------------------------------------------------------------
// JWT minting + token cache
// ---------------------------------------------------------------------------

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(cfg: DocuSignConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  // 1h is the max DocuSign accepts; we cache for 50m to stay safely under.
  const payload = {
    iss: cfg.integrationKey,
    sub: cfg.userId,
    aud: cfg.authHost,
    iat: now,
    exp: now + 60 * 60,
    scope: "signature impersonation",
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(cfg.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

type TokenCacheEntry = { token: string; expiresAt: number };
let tokenCache: TokenCacheEntry | null = null;

export async function getAccessToken(): Promise<string> {
  const cfg = readConfig();
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const jwt = signJwt(cfg);
  const res = await fetch(`https://${cfg.authHost}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    // `consent_required` is the classic DocuSign trip-wire: the integration
    // user has not granted consent to the integration key. Surface it cleanly.
    throw new DocuSignError(
      body.error_description || body.error || "DocuSign token request failed",
      res.status,
      body,
    );
  }

  // expires_in is in seconds; cap our cache at 50m regardless.
  const ttlMs = Math.min((body.expires_in ?? 3600) * 1000, 50 * 60 * 1000);
  tokenCache = { token: body.access_token, expiresAt: now + ttlMs };
  return body.access_token;
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function dsFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cfg = readConfig();
  const token = await getAccessToken();
  const url = `${cfg.baseUrl}/restapi${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new DocuSignError(
      `DocuSign ${init.method || "GET"} ${path} failed (${res.status})`,
      res.status,
      body,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DocuSignDocument = {
  /** Plain filename (with extension). */
  name: string;
  /** File extension: pdf, docx, png, ... */
  fileExtension: string;
  /** Base64-encoded bytes of the document. */
  documentBase64: string;
};

export type DocuSignSigner = {
  email: string;
  name: string;
  /** Optional 1-based ordering for sequential signing. Defaults to 1. */
  routingOrder?: number;
  /**
   * Optional client user id. If present, the recipient is treated as an
   * EMBEDDED signer (required for getRecipientView). If omitted, DocuSign
   * will email the signer directly.
   */
  clientUserId?: string;
};

export type CreateEnvelopeParams = {
  documents: DocuSignDocument[];
  signers: DocuSignSigner[];
  emailSubject: string;
  emailBlurb?: string;
  /** Defaults to "sent" (envelope dispatched immediately). "created" leaves it as a draft. */
  status?: "sent" | "created";
};

export type CreateEnvelopeResult = {
  envelopeId: string;
  status: string;
  statusDateTime?: string;
  uri?: string;
};

export async function createEnvelope(
  params: CreateEnvelopeParams,
): Promise<CreateEnvelopeResult> {
  const cfg = readConfig();

  const documents = params.documents.map((d, idx) => ({
    documentId: String(idx + 1),
    name: d.name,
    fileExtension: d.fileExtension,
    documentBase64: d.documentBase64,
  }));

  // Anchor a default SignHere tab on the literal token "\sn1\" in each doc so
  // anchored fields work even without explicit positioning. Senders who supply
  // their own templates can override later via the templates endpoint.
  const signers = params.signers.map((s, idx) => ({
    email: s.email,
    name: s.name,
    recipientId: String(idx + 1),
    routingOrder: String(s.routingOrder ?? 1),
    ...(s.clientUserId ? { clientUserId: s.clientUserId } : {}),
    tabs: {
      signHereTabs: [
        {
          anchorString: "\\sn1\\",
          anchorXOffset: "0",
          anchorYOffset: "0",
          anchorUnits: "pixels",
          anchorIgnoreIfNotPresent: "true",
        },
      ],
    },
  }));

  const body = {
    emailSubject: params.emailSubject,
    emailBlurb: params.emailBlurb,
    status: params.status ?? "sent",
    documents,
    recipients: { signers },
  };

  return dsFetch<CreateEnvelopeResult>(
    `/v2.1/accounts/${cfg.accountId}/envelopes`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export type EnvelopeStatus = {
  envelopeId: string;
  status: string;
  statusChangedDateTime?: string;
  sentDateTime?: string;
  completedDateTime?: string;
  declinedDateTime?: string;
  voidedDateTime?: string;
  voidedReason?: string;
};

export async function getEnvelopeStatus(
  envelopeId: string,
): Promise<EnvelopeStatus> {
  const cfg = readConfig();
  return dsFetch<EnvelopeStatus>(
    `/v2.1/accounts/${cfg.accountId}/envelopes/${encodeURIComponent(envelopeId)}`,
    { method: "GET" },
  );
}

export type RecipientViewParams = {
  envelopeId: string;
  signerEmail: string;
  signerName: string;
  /** Must match the clientUserId used at signer creation (embedded signing). */
  clientUserId?: string;
  /** Where DocuSign should redirect after signing. */
  returnUrl: string;
  /** Optional authentication method label. Defaults to "email". */
  authenticationMethod?: string;
};

export type RecipientViewResult = {
  /** Short-lived embedded signing URL (~5 minutes). */
  url: string;
};

export async function getRecipientView(
  params: RecipientViewParams,
): Promise<RecipientViewResult> {
  const cfg = readConfig();
  return dsFetch<RecipientViewResult>(
    `/v2.1/accounts/${cfg.accountId}/envelopes/${encodeURIComponent(
      params.envelopeId,
    )}/views/recipient`,
    {
      method: "POST",
      body: JSON.stringify({
        returnUrl: params.returnUrl,
        authenticationMethod: params.authenticationMethod || "email",
        email: params.signerEmail,
        userName: params.signerName,
        // Defaulting to the email avoids one more env var when callers haven't
        // chosen a stable client user id scheme yet.
        clientUserId: params.clientUserId || params.signerEmail,
      }),
    },
  );
}

// ---------------------------------------------------------------------------
// Status mapping helper (used by /api/webhooks/docusign)
// ---------------------------------------------------------------------------

export type DocStatus =
  | "draft"
  | "sent"
  | "delivered"
  | "signed"
  | "completed"
  | "void"
  | "expired";

export function mapEnvelopeStatusToDocStatus(
  status: string | undefined,
): DocStatus | null {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "signed":
      return "signed";
    case "completed":
      return "completed";
    case "declined":
    case "voided":
      return "void";
    case "expired":
      return "expired";
    default:
      return null;
  }
}
