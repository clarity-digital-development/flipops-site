// ---------------------------------------------------------------------------
// CAPTCHA solver — 2captcha-class reCAPTCHA v2 token source.
//
// Provider-agnostic by env: TWOCAPTCHA_API_KEY (alias CAPTCHA_SOLVER_API_KEY).
// Implements the `solveRecaptcha(sitekey, pageUrl) => Promise<token>` hook that
// the Landmark official-records adapter (and any future captcha-gated scraper)
// consumes. When no key is configured, getCaptchaSolver() returns undefined and
// callers fall back to their no-token path (persist 0, report captcha-required).
//
// Flow (classic in.php/res.php — stable, simplest, works across 2captcha-API
// compatibles like anti-captcha/capmonster via base URL override):
//   1. POST in.php  method=userrecaptcha googlekey=<sitekey> pageurl=<url>
//      → captcha id
//   2. poll res.php action=get id=<id> until "OK|<token>" or timeout
//
// Cost: ~$1-3 / 1000 solves. reCAPTCHA v2 typically resolves in 15-60s.
// Grey-zone per the scraping risk policy — yellow with hardening (rate-limited,
// audited via the BulkIngestJob the calling scraper already creates). User
// opted in 2026-06-11 (OPERATIONS OPS-8).
// ---------------------------------------------------------------------------

const DEFAULT_BASE = "https://2captcha.com";
const POLL_INTERVAL_MS = 6_000;
const SUBMIT_TIMEOUT_MS = 20_000;
const SOLVE_TIMEOUT_MS = 180_000; // reCAPTCHA v2 worst-case

export interface CaptchaSolverConfig {
  apiKey: string;
  /** Override for 2captcha-compatible providers (anti-captcha, capmonster). */
  baseUrl?: string;
}

function readConfig(): CaptchaSolverConfig | null {
  const apiKey = process.env.TWOCAPTCHA_API_KEY || process.env.CAPTCHA_SOLVER_API_KEY;
  if (!apiKey) return null;
  return { apiKey, baseUrl: process.env.CAPTCHA_SOLVER_BASE_URL || DEFAULT_BASE };
}

async function fetchText(url: string, init: RequestInit, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Solve a reCAPTCHA v2 challenge, returning the g-recaptcha-response token.
 * Throws on hard failure (bad key, zero balance, unsolvable, timeout) so the
 * caller's BulkIngestJob audit captures the reason rather than silently 0-rowing.
 */
export async function solveRecaptchaV2(
  cfg: CaptchaSolverConfig,
  sitekey: string,
  pageUrl: string,
): Promise<string> {
  const base = cfg.baseUrl ?? DEFAULT_BASE;

  // 1. Submit.
  const submitBody = new URLSearchParams({
    key: cfg.apiKey,
    method: "userrecaptcha",
    googlekey: sitekey,
    pageurl: pageUrl,
    json: "1",
  });
  const submitRaw = await fetchText(
    `${base}/in.php`,
    { method: "POST", body: submitBody },
    SUBMIT_TIMEOUT_MS,
  );
  let submit: { status: number; request: string };
  try {
    submit = JSON.parse(submitRaw);
  } catch {
    throw new Error(`captcha-solver: non-JSON submit response: ${submitRaw.slice(0, 120)}`);
  }
  if (submit.status !== 1) {
    // request carries the error code (ERROR_ZERO_BALANCE, ERROR_WRONG_GOOGLEKEY, …)
    throw new Error(`captcha-solver: submit failed: ${submit.request}`);
  }
  const id = submit.request;

  // 2. Poll.
  const deadline = Date.now() + SOLVE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollRaw = await fetchText(
      `${base}/res.php?key=${encodeURIComponent(cfg.apiKey)}&action=get&id=${encodeURIComponent(id)}&json=1`,
      { method: "GET" },
      SUBMIT_TIMEOUT_MS,
    );
    let poll: { status: number; request: string };
    try {
      poll = JSON.parse(pollRaw);
    } catch {
      continue; // transient; keep polling until deadline
    }
    if (poll.status === 1) return poll.request; // the token
    if (poll.request !== "CAPCHA_NOT_READY") {
      throw new Error(`captcha-solver: solve failed: ${poll.request}`);
    }
  }
  throw new Error(`captcha-solver: timed out after ${SOLVE_TIMEOUT_MS / 1000}s for ${sitekey}`);
}

/**
 * Returns the `solveRecaptcha` hook when a solver is configured, else undefined.
 * Scrapers wire this in: `solveRecaptcha: getCaptchaSolver()`.
 */
export function getCaptchaSolver():
  | ((sitekey: string, pageUrl: string) => Promise<string>)
  | undefined {
  const cfg = readConfig();
  if (!cfg) return undefined;
  return (sitekey: string, pageUrl: string) => solveRecaptchaV2(cfg, sitekey, pageUrl);
}

/** True when TWOCAPTCHA_API_KEY (or alias) is set — for registry gating + logs. */
export function isCaptchaSolverConfigured(): boolean {
  return readConfig() !== null;
}

/** Best-effort account balance (USD) for a preflight log; null on any error. */
export async function captchaSolverBalance(): Promise<number | null> {
  const cfg = readConfig();
  if (!cfg) return null;
  try {
    const raw = await fetchText(
      `${cfg.baseUrl ?? DEFAULT_BASE}/res.php?key=${encodeURIComponent(cfg.apiKey)}&action=getbalance&json=1`,
      { method: "GET" },
      SUBMIT_TIMEOUT_MS,
    );
    const j = JSON.parse(raw) as { status: number; request: string };
    return j.status === 1 ? Number(j.request) : null;
  } catch {
    return null;
  }
}
