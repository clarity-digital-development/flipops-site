// ---------------------------------------------------------------------------
// One-shot cookie capture helper.
//
// Many county foreclosure portals (realforeclose.com et al.) gate their XHR
// endpoints behind a CFID/CFTOKEN + AWS ALB + CF_CLIENT_<COUNTY>_* cookie
// bundle that is set on a single splash GET. After that splash, subsequent
// XHRs to the same host succeed as long as those cookies travel along.
//
// This helper does ONE plain HTTP GET via politeFetch (NOT Playwright — we
// want this cheap, parallelizable, and runnable from Railway workers without
// a chromium dep), then parses the `Set-Cookie` response header(s) into a
// single `Cookie:` request header string ready to attach to subsequent
// politeFetch calls.
//
// Why a custom parser:
// - `response.headers.get('set-cookie')` returns a SINGLE comma-joined string
//   in undici / Node fetch. Naive `.split(',')` breaks on `Expires=Tue, 04 Jun
//   2026 ...` dates which contain commas.
// - Newer Node exposes `response.headers.getSetCookie(): string[]` which
//   splits correctly. We prefer it when available and fall back to a
//   positive-lookahead regex when not. The regex splits on a comma that is
//   followed by a `name=` token, which Expires-style commas never are.
//
// Proxy posture: defaults to useProxy=false. realforeclose.com's WAF returns
// 403 to the DataImpulse residential pool (verified by L0 probe 2026-06-02),
// so green-zone direct calls are the right default here. Callers can still
// override per-call if needed.
// ---------------------------------------------------------------------------

import { politeFetch } from "./http-client";

/**
 * Split header lookahead — matches a comma that is followed by whitespace and
 * a cookie-name token (`A-Z a-z 0-9 _ -` then `=`). Expires=... commas don't
 * match because what follows them is `Tue` / `Wed` / etc. followed by a space
 * and a digit, not `=`.
 */
const SET_COOKIE_SPLIT = /,\s*(?=[A-Za-z0-9_-]+=)/;

export type SetCookieParseStrategy = "getSetCookie" | "raw" | "positive-lookahead";

/**
 * Parse a Headers object's Set-Cookie value(s) into an array of raw cookie
 * strings (one per cookie, attributes still attached). Exported for testing.
 */
export function parseSetCookieHeaders(
  headers: Headers,
): { cookies: string[]; strategy: SetCookieParseStrategy } {
  // (a) Node >= 19.7 / undici exposes a properly-split array via getSetCookie().
  const maybeGetSetCookie = (headers as unknown as {
    getSetCookie?: () => string[];
  }).getSetCookie;
  if (typeof maybeGetSetCookie === "function") {
    const arr = maybeGetSetCookie.call(headers);
    if (Array.isArray(arr) && arr.length > 0) {
      return { cookies: arr, strategy: "getSetCookie" };
    }
  }

  // (b) Some impls expose .raw() returning { 'set-cookie': string[] } — try it.
  const maybeRaw = (headers as unknown as {
    raw?: () => Record<string, string[]>;
  }).raw;
  if (typeof maybeRaw === "function") {
    try {
      const raw = maybeRaw.call(headers);
      const arr = raw?.["set-cookie"];
      if (Array.isArray(arr) && arr.length > 0) {
        return { cookies: arr, strategy: "raw" };
      }
    } catch {
      // fall through
    }
  }

  // (c) Fallback: single comma-joined header string, split on positive
  //     lookahead so Expires=Tue, dd Mon yyyy commas don't false-trigger.
  const joined = headers.get("set-cookie");
  if (!joined) return { cookies: [], strategy: "positive-lookahead" };
  return {
    cookies: joined.split(SET_COOKIE_SPLIT),
    strategy: "positive-lookahead",
  };
}

/**
 * Reduce raw Set-Cookie strings (with attributes) to a `name=value; ...`
 * request-header value suitable for the `Cookie:` header. Exported for testing.
 */
export function buildCookieHeader(rawCookies: string[]): string {
  const pairs: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawCookies) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // name=value is everything up to the first ';' (which begins attributes).
    const semi = trimmed.indexOf(";");
    const pair = semi === -1 ? trimmed : trimmed.slice(0, semi);
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    pairs.push(pair);
  }
  return pairs.join("; ");
}

/**
 * One-shot cookie capture via plain GET + Set-Cookie parsing.
 * Returns a Cookie header value ready to attach to subsequent requests.
 *
 * Usage:
 *   const cookieHeader = await captureCookiesFromUrl(splashUrl, { useProxy: false });
 *   const res = await politeFetch(xhrUrl, { headers: { Cookie: cookieHeader }, useProxy: false });
 */
export async function captureCookiesFromUrl(
  url: string,
  opts?: { useProxy?: boolean },
): Promise<string> {
  const res = await politeFetch(url, {
    method: "GET",
    useProxy: opts?.useProxy ?? false,
    // Always rotate to a real Chrome UA for splash GETs. Even direct (green-
    // zone) splash requests need this — county WAFs (CloudFront / Imperva /
    // F5) commonly 403 the `FlipOps-PublicRecordsBot/1.0` UA on the front
    // door. We're identifying ourselves as a bot in other ways (rate limit,
    // strict per-host queue) and the goal here is to acquire a session
    // cookie, not to negotiate scraping etiquette via UA string.
    rotateFingerprint: true,
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Drain the body so the socket is released back to the agent. We don't
  // actually care about the HTML — only the Set-Cookie response headers.
  // (Reading is cheap; not draining can pin a connection in keep-alive.)
  try {
    await res.text();
  } catch {
    // ignore — header parse below is what matters
  }

  const { cookies } = parseSetCookieHeaders(res.headers);
  return buildCookieHeader(cookies);
}

// ---------------------------------------------------------------------------
// Inline unit-test-style assertions.
//
// Runs only when this module is executed directly (`tsx cookie-fetch.ts`),
// so importing it from production code is a no-op. We test the two pure
// helpers — parseSetCookieHeaders and buildCookieHeader — which is where
// all the tricky logic lives. The network call itself is a thin wrapper.
// ---------------------------------------------------------------------------

function _runInlineAssertions(): void {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const assert = (name: string, ok: boolean, detail?: string) => {
    results.push({ name, ok, detail });
  };

  // (a) Single Set-Cookie header parses correctly.
  {
    const h = new Headers();
    h.set("set-cookie", "AWSALB=abc123; Path=/; Expires=Tue, 04 Jun 2026 12:00:00 GMT");
    const { cookies } = parseSetCookieHeaders(h);
    const cookie = buildCookieHeader(cookies);
    assert(
      "single Set-Cookie parses",
      cookie === "AWSALB=abc123",
      `got "${cookie}" from ${JSON.stringify(cookies)}`,
    );
  }

  // (b) Comma-joined Set-Cookie with Expires-comma parses via positive lookahead.
  //     We force the lookahead path by stripping getSetCookie / raw off a
  //     plain object that quacks like Headers.
  {
    const joined = [
      "AWSALB=abc; Path=/; Expires=Tue, 04 Jun 2026 12:00:00 GMT",
      "CFID=7777; Path=/; HttpOnly",
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_LV=xyz; Path=/; Expires=Wed, 05 Jun 2026 00:00:00 GMT",
    ].join(", ");
    const fakeHeaders = {
      get: (k: string) =>
        k.toLowerCase() === "set-cookie" ? joined : null,
    } as unknown as Headers;
    const { cookies, strategy } = parseSetCookieHeaders(fakeHeaders);
    assert(
      "lookahead strategy chosen when no getSetCookie/raw",
      strategy === "positive-lookahead",
      `strategy=${strategy}`,
    );
    assert(
      "lookahead split yields 3 cookies (Expires commas ignored)",
      cookies.length === 3,
      `got ${cookies.length}: ${JSON.stringify(cookies)}`,
    );
    const cookie = buildCookieHeader(cookies);
    const expected =
      "AWSALB=abc; CFID=7777; CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_LV=xyz";
    assert(
      "lookahead → cookie header joined",
      cookie === expected,
      `got "${cookie}"`,
    );
  }

  // (c) Multiple cookies get joined with '; '
  {
    const h = new Headers();
    // Use the (a)-style API which sets one header; then we manually feed
    // buildCookieHeader an explicit array — this directly tests joining.
    const rawArr = [
      "AWSALB=v1; Path=/",
      "AWSALBCORS=v2; Path=/; SameSite=None; Secure",
      "cfid=v3; Path=/; HttpOnly",
      "cftoken=v4; Path=/; HttpOnly",
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_LV=v5; Path=/",
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_TC=v6; Path=/",
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_HC=v7; Path=/",
    ];
    const cookie = buildCookieHeader(rawArr);
    const expected =
      "AWSALB=v1; AWSALBCORS=v2; cfid=v3; cftoken=v4; " +
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_LV=v5; " +
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_TC=v6; " +
      "CF_CLIENT_HILLSBOROUGH_REALFORECLOSE_HC=v7";
    assert(
      "buildCookieHeader joins 7-cookie county bundle with '; '",
      cookie === expected,
      `got "${cookie}"`,
    );
    // also confirm we didn't lose any cookies
    assert(
      "all 7 cookies preserved in joined header",
      cookie.split("; ").length === 7,
    );
    // silence unused-binding lint without dragging in `h`
    void h;
  }

  // Print results.
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      // eslint-disable-next-line no-console
      console.log(`PASS  ${r.name}`);
    } else {
      failed++;
      // eslint-disable-next-line no-console
      console.error(`FAIL  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }
  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n${failed}/${results.length} assertions failed`);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log(`\nAll ${results.length} assertions passed.`);
  }
}

// Only run the assertions when invoked directly (tsx / node).
// Avoids any side effect when this module is imported by production code.
const _isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  /cookie-fetch(\.[tj]s)?$/.test(process.argv[1]);
if (_isMain) {
  _runInlineAssertions();
}
