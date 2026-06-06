// ---------------------------------------------------------------------------
// Probe DataImpulse residential reachability to or.duvalclerk.com.
//
// Goal: rule in/out geo/ASN-block hypothesis vs. Playwright-timeout hypothesis.
//
// Three sequential probes:
//   1. Direct GET (no proxy)              — baseline: does the site respond?
//   2. DataImpulse GET (politeFetch)      — does residential proxy reach it?
//   3. DataImpulse GET, 45s timeout       — slow-but-reachable vs truly blocked?
//
// Reports: status, durationMs, contentType, contentLength, redirects, error.
// ---------------------------------------------------------------------------

import { politeFetch } from "../lib/scrapers/base/http-client";

const TARGET_URL = "https://or.duvalclerk.com/";

interface ProbeResult {
  url: string;
  method: string;
  status: number | null;
  durationMs: number;
  contentType: string | null;
  contentLength: number | null;
  redirects: number;
  xBrdErrCode: string | null;
  error: string | null;
}

async function directGet(timeoutMs: number): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TARGET_URL, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    const body = await res.arrayBuffer();
    return {
      url: TARGET_URL,
      method: "GET (direct)",
      status: res.status,
      durationMs: Date.now() - start,
      contentType: res.headers.get("content-type"),
      contentLength: body.byteLength,
      redirects: res.redirected ? 1 : 0,
      xBrdErrCode: res.headers.get("x-brd-err-code"),
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      url: TARGET_URL,
      method: "GET (direct)",
      status: null,
      durationMs: Date.now() - start,
      contentType: null,
      contentLength: null,
      redirects: 0,
      xBrdErrCode: null,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

async function proxyGet(timeoutMs: number, label: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await politeFetch(TARGET_URL, {
      method: "GET",
      useProxy: true,
      rotateFingerprint: true,
      maxRetries: 0,
      timeoutMs,
      rateLimitMs: 0,
    });
    const body = await res.arrayBuffer();
    return {
      url: TARGET_URL,
      method: label,
      status: res.status,
      durationMs: Date.now() - start,
      contentType: res.headers.get("content-type"),
      contentLength: body.byteLength,
      redirects: res.redirected ? 1 : 0,
      xBrdErrCode: res.headers.get("x-brd-err-code"),
      error: null,
    };
  } catch (err) {
    return {
      url: TARGET_URL,
      method: label,
      status: null,
      durationMs: Date.now() - start,
      contentType: null,
      contentLength: null,
      redirects: 0,
      xBrdErrCode: null,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

function logResult(r: ProbeResult): void {
  console.log(JSON.stringify(r, null, 2));
}

function classify(
  direct: ProbeResult,
  proxy: ProbeResult,
  proxyExt: ProbeResult,
): string {
  const directOk = direct.status !== null && direct.status >= 200 && direct.status < 500;
  const proxyOk = proxy.status !== null && proxy.status >= 200 && proxy.status < 500;
  const proxyExtOk =
    proxyExt.status !== null && proxyExt.status >= 200 && proxyExt.status < 500;

  if (!directOk && direct.error) return "HOST_UNREACHABLE_DIRECT";
  if (proxyOk) return "HOST_REACHABLE_VIA_PROXY";
  if (!proxyOk && proxyExtOk) return "HOST_SLOW_BUT_REACHABLE";
  if (!proxyOk && !proxyExtOk && directOk) return "HOST_GEO_BLOCKED";
  return "UNCLEAR";
}

async function main(): Promise<void> {
  console.log(`PROXY_URL set: ${process.env.PROXY_URL ? "yes" : "no"}`);
  console.log(`Target: ${TARGET_URL}\n`);

  console.log("--- Probe 1: Direct GET (no proxy, 20s timeout) ---");
  const direct = await directGet(20_000);
  logResult(direct);

  console.log("\n--- Probe 2: DataImpulse GET (politeFetch, 20s timeout) ---");
  const proxy = await proxyGet(20_000, "GET (DataImpulse, 20s)");
  logResult(proxy);

  console.log("\n--- Probe 3: DataImpulse GET (politeFetch, 45s timeout) ---");
  const proxyExt = await proxyGet(45_000, "GET (DataImpulse, 45s)");
  logResult(proxyExt);

  const verdict = classify(direct, proxy, proxyExt);
  console.log(`\n=== VERDICT: ${verdict} ===`);
  console.log(
    JSON.stringify(
      {
        directGet: {
          status: direct.status,
          durationMs: direct.durationMs,
          contentLength: direct.contentLength,
          error: direct.error,
        },
        proxyGet: {
          status: proxy.status,
          durationMs: proxy.durationMs,
          contentLength: proxy.contentLength,
          error: proxy.error,
        },
        proxyGetExtended: {
          status: proxyExt.status,
          durationMs: proxyExt.durationMs,
          contentLength: proxyExt.contentLength,
          error: proxyExt.error,
        },
        verdict,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
