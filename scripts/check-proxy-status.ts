/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// check-proxy-status.ts — provider-agnostic proxy health verification.
//
// Run when you suspect the residential proxy is broken (e.g. when scrapers
// start failing with 4xx/5xx). Returns a structured report on:
//   1. (Optional) Bright Data account/zone API state — only if a BD URL
//      and BD API token are configured; harmless skip otherwise.
//   2. Live proxied fetches against 3 targets (the ground truth — always run):
//      a generic BD self-health URL, a generic GET, and a POST against a
//      production-scraper target. The POST is the one that catches the
//      KYC / no-POST-allowed gates some residential providers apply.
//
// Usage:
//   npx tsx scripts/check-proxy-status.ts
//
// Env vars (precedence: first non-empty wins):
//   PROXY_URL                  — required. Provider-agnostic proxy URL.
//                                As of 2026-05-31 this points at
//                                DataImpulse; previously was BD.
//   BRIGHT_DATA_PROXY_URL      — fallback for the live probes if PROXY_URL is
//                                unset. Kept for legacy/diagnostic use.
//   BRIGHT_DATA_API_TOKEN      — optional. Enables the BD account/zone API
//                                checks. Not used by DataImpulse.
//   BRIGHT_DATA_ZONE_NAME      — optional; only for BD. Defaults to parsing
//                                `zone-<name>` from the BD proxy URL username.
//
// Exit codes:
//   0 — healthy: at least one live proxied fetch returned 2xx AND the
//       production-scraper POST returned 2xx
//   1 — zone disabled or not in active list (BD-specific)
//   2 — quota exhausted / account suspension (HTTP 407 / 502 from proxy)
//   3 — policy restriction (HTTP 402 / bad_endpoint — KYC required, or
//       zone product mismatch; provider-specific fix)
//   4 — other (network error, missing env, unrecognized error)
// ---------------------------------------------------------------------------

import { ProxyAgent } from "undici";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail" | "skip";
  detail: string;
}

const RESULTS: CheckResult[] = [];

const BD_API_BASE = "https://api.brightdata.com";

function record(r: CheckResult) {
  RESULTS.push(r);
}

function parseZoneFromProxyUrl(url: string): string | null {
  // Username format: brd-customer-<id>-zone-<name>[-country-us]
  try {
    const u = new URL(url);
    const m = u.username.match(/zone-([a-zA-Z0-9_-]+?)(?:-country-|$|@)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function bdApiGet<T = unknown>(path: string, token: string): Promise<{ status: number; body?: T; raw?: string }> {
  try {
    const res = await fetch(`${BD_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let body: T | undefined;
    try {
      body = JSON.parse(text) as T;
    } catch {
      // not JSON
    }
    return { status: res.status, body, raw: text };
  } catch (err) {
    return { status: 0, raw: (err as Error).message };
  }
}

async function checkAccountStatus(token: string) {
  const r = await bdApiGet<{
    status?: string;
    customer?: string;
    can_make_requests?: boolean;
    auth_fail_reason?: string;
    ip?: string;
  }>("/status", token);
  if (r.status === 401 || r.status === 403) {
    record({ name: "BD account /status", status: "fail", detail: `auth ${r.status} — API token rejected. Regenerate at brightdata.com/cp/setting/users` });
    return null;
  }
  if (r.status === 404) {
    record({ name: "BD account /status", status: "skip", detail: "endpoint not found (BD API may have moved); falling through" });
    return null;
  }
  if (r.status >= 400) {
    record({ name: "BD account /status", status: "warn", detail: `HTTP ${r.status} — ${r.raw?.slice(0, 120)}` });
    return null;
  }
  const ok = r.body?.can_make_requests !== false;
  const fail = r.body?.auth_fail_reason;
  record({
    name: "BD account /status",
    status: ok ? "ok" : "fail",
    detail: ok
      ? `customer=${r.body?.customer ?? "?"} ip=${r.body?.ip ?? "?"} can_make_requests=true`
      : `auth_fail_reason=${fail ?? "(none)"}`,
  });
  return r.body;
}

async function checkZoneActive(token: string, zone: string) {
  const r = await bdApiGet<Array<{ name: string; type: string }>>("/zone/get_active_zones", token);
  if (r.status >= 400) {
    record({
      name: "BD /zone/get_active_zones",
      status: r.status === 404 ? "skip" : "warn",
      detail: `HTTP ${r.status}`,
    });
    return null;
  }
  if (!Array.isArray(r.body)) {
    record({ name: "BD /zone/get_active_zones", status: "warn", detail: "unexpected shape" });
    return null;
  }
  const found = r.body.find((z) => z.name === zone);
  record({
    name: `BD zone "${zone}" in active list`,
    status: found ? "ok" : "fail",
    detail: found
      ? `type=${found.type}, ${r.body.length} active zones total`
      : `NOT FOUND — zone may be disabled or deleted. ${r.body.length} active zones present: ${r.body.map((z) => z.name).join(", ").slice(0, 200)}`,
  });
  return found;
}

async function checkZoneStatus(token: string, zone: string) {
  const r = await bdApiGet<{ status?: string }>(`/zone/status?zone=${encodeURIComponent(zone)}`, token);
  if (r.status === 404) {
    record({ name: `BD /zone/status?zone=${zone}`, status: "skip", detail: "endpoint or zone not found" });
    return null;
  }
  if (r.status >= 400) {
    record({ name: `BD /zone/status`, status: "warn", detail: `HTTP ${r.status} — ${r.raw?.slice(0, 120)}` });
    return null;
  }
  record({ name: `BD /zone/status?zone=${zone}`, status: "ok", detail: `status=${r.body?.status ?? r.raw?.slice(0, 100)}` });
  return r.body;
}

interface ProxyFetchResult {
  url: string;
  httpStatus: number;
  brdErrorCode?: string;
  brdErrorMsg?: string;
  body?: string;
  networkError?: string;
}

async function liveProxyFetch(proxyUrl: string, targetUrl: string, method: "GET" | "POST" = "GET", body?: string): Promise<ProxyFetchResult> {
  // TLS posture mirrors lib/scrapers/base/http-client.ts (see that file's
  // docstring for the full rationale):
  //   - proxyTls strict: brd.superproxy.io has a valid public cert; cred
  //     transit MUST verify or we mask MITM-on-the-way-to-BD.
  //   - requestTls relaxed: BD's Web Unlocker MITMs the target-TLS branch
  //     by DESIGN (to inject JS rendering / captcha solving). The cert we
  //     see in this branch is BD's MITM cert, not the target's. Strict
  //     verification here would fail 100% of the time and prevent this
  //     script from ever observing a real BD response (defeating its
  //     entire purpose of diagnosing BD health).
  //   - This script INTENTIONALLY matches production's TLS posture so a
  //     green verdict here means production scrapers will also work.
  //     Diverging would create a false confidence signal.
  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    requestTls: { rejectUnauthorized: false },
    proxyTls: { rejectUnauthorized: true },
  });
  try {
    const res = await fetch(targetUrl, {
      method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        ...(method === "POST"
          ? {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
            }
          : {}),
      },
      body,
      // @ts-expect-error undici dispatcher not in standard RequestInit
      dispatcher,
    });
    const text = await res.text();
    return {
      url: targetUrl,
      httpStatus: res.status,
      brdErrorCode: res.headers.get("x-brd-err-code") ?? res.headers.get("x-brd-error-code") ?? undefined,
      brdErrorMsg: res.headers.get("x-brd-err-msg") ?? res.headers.get("x-brd-error") ?? undefined,
      body: text.slice(0, 200),
    };
  } catch (err) {
    return {
      url: targetUrl,
      httpStatus: 0,
      networkError: (err as Error).message,
    };
  } finally {
    await dispatcher.close().catch(() => {});
  }
}

function classifyLiveFetch(r: ProxyFetchResult): { exitCode: number; status: CheckResult["status"]; summary: string } {
  if (r.networkError) {
    return { exitCode: 4, status: "fail", summary: `NETWORK ERROR: ${r.networkError}` };
  }
  if (r.httpStatus >= 200 && r.httpStatus < 300) {
    return { exitCode: 0, status: "ok", summary: `HTTP ${r.httpStatus} — proxy is healthy through to target` };
  }
  if (r.httpStatus === 402) {
    return {
      exitCode: 3,
      status: "fail",
      summary: `HTTP 402 (${r.brdErrorCode ?? "no code"}): ${r.brdErrorMsg ?? "Residential policy restriction — provider-specific. Common causes: KYC required, per-target POST block, restricted port."}`,
    };
  }
  if (r.httpStatus === 407) {
    return {
      exitCode: 2,
      status: "fail",
      summary: `HTTP 407: Account suspended or proxy credentials invalid. Check billing at brightdata.com/cp/setting/billing`,
    };
  }
  if (r.httpStatus === 502) {
    return {
      exitCode: 2,
      status: "fail",
      summary: `HTTP 502: Zone usage limit reached or upstream failure. Check usage at brightdata.com/cp/zones`,
    };
  }
  return {
    exitCode: 4,
    status: "warn",
    summary: `HTTP ${r.httpStatus}${r.brdErrorCode ? ` (${r.brdErrorCode})` : ""}: ${r.brdErrorMsg ?? r.body?.slice(0, 100) ?? "(no body)"}`,
  };
}

function renderTable() {
  const wName = Math.max(8, ...RESULTS.map((r) => r.name.length));
  const wStatus = 8;
  console.log("");
  console.log("=".repeat(78));
  console.log("PROXY STATUS CHECK");
  console.log("=".repeat(78));
  console.log(`${"check".padEnd(wName)}  ${"status".padEnd(wStatus)}  detail`);
  console.log(`${"-".repeat(wName)}  ${"-".repeat(wStatus)}  ${"-".repeat(78 - wName - wStatus - 4)}`);
  for (const r of RESULTS) {
    const statusLabel = r.status.toUpperCase().padEnd(wStatus);
    console.log(`${r.name.padEnd(wName)}  ${statusLabel}  ${r.detail}`);
  }
  console.log("");
}

async function main() {
  const proxyUrl = process.env.PROXY_URL ?? process.env.BRIGHT_DATA_PROXY_URL;
  if (!proxyUrl) {
    console.error("FATAL: PROXY_URL (or BRIGHT_DATA_PROXY_URL as fallback) is not set. Cannot run live proxy fetch.");
    process.exit(4);
  }

  // Provider identification — best-effort by host.
  let provider = "unknown";
  try {
    const u = new URL(proxyUrl);
    if (u.host.includes("brd.superproxy.io") || u.host.includes("brightdata")) provider = "Bright Data";
    else if (u.host.includes("dataimpulse")) provider = "DataImpulse";
    else if (u.host.includes("oxylabs")) provider = "Oxylabs";
    else if (u.host.includes("smartproxy")) provider = "Smartproxy";
    else provider = u.host;
  } catch {
    // ignore
  }

  // BD API token only meaningful when the proxy URL is actually BD.
  const isBd = provider === "Bright Data";
  const token = isBd ? process.env.BRIGHT_DATA_API_TOKEN : undefined;
  const zone = isBd
    ? (process.env.BRIGHT_DATA_ZONE_NAME ?? parseZoneFromProxyUrl(proxyUrl))
    : null;

  console.log(`Provider:  ${provider}`);
  console.log(`Proxy URL: ${proxyUrl.replace(/:[^@]+@/, ":***@")}`);
  if (isBd) {
    console.log(`Zone:      ${zone ?? "(could not parse)"}`);
    console.log(`API Token: ${token ? "(set)" : "(not set — API checks will be skipped)"}`);
  }

  // ----- BD-only API checks (gated on provider + token) -----
  if (isBd && token && zone) {
    await checkAccountStatus(token);
    await checkZoneActive(token, zone);
    await checkZoneStatus(token, zone);
  } else if (isBd && !token) {
    record({ name: "BD account API", status: "skip", detail: "set BRIGHT_DATA_API_TOKEN to enable. Get it from BD → Account settings → API token" });
  } else if (!isBd) {
    record({ name: "Provider account API", status: "skip", detail: `${provider} doesn't have an account-API check yet; relying on live probes` });
  }

  // ----- Live fetch ground-truth checks -----
  console.log("\nRunning live proxied fetches (ground truth)...");

  // Probe 1: BD's own health endpoint (always permitted)
  const r1 = await liveProxyFetch(proxyUrl, "https://geo.brdtest.com/welcome.txt?country=us");
  const c1 = classifyLiveFetch(r1);
  record({ name: "GET geo.brdtest.com (BD self-health)", status: c1.status, detail: c1.summary });

  // Probe 2: a generic public endpoint that requires real residential exit
  const r2 = await liveProxyFetch(proxyUrl, "https://httpbin.org/ip");
  const c2 = classifyLiveFetch(r2);
  record({ name: "GET httpbin.org/ip (generic GET)", status: c2.status, detail: c2.summary });

  // Probe 3: a POST endpoint that mirrors what production scrapers do —
  // this is the one that previously surfaced the 402 KYC issue.
  const r3 = await liveProxyFetch(
    proxyUrl,
    "https://netapps.ocfl.net/BestJail/Home/getInmates/SMITH",
    "POST",
    "id=",
  );
  const c3 = classifyLiveFetch(r3);
  record({ name: "POST netapps.ocfl.net (matches prod scrapers)", status: c3.status, detail: c3.summary });

  renderTable();

  // Verdict: worst exit code wins
  const exit = Math.max(c1.exitCode, c2.exitCode, c3.exitCode);
  console.log("=".repeat(78));
  if (exit === 0) {
    console.log(`VERDICT: HEALTHY (${provider}) — all probes returned 2xx. Production scrapers should resume normal operation.`);
  } else if (exit === 1) {
    console.log("VERDICT: ZONE DISABLED — check the provider's zone dashboard.");
  } else if (exit === 2) {
    console.log(`VERDICT: BILLING / QUOTA (${provider}) — check the provider's billing/usage dashboard.`);
  } else if (exit === 3) {
    if (isBd) {
      console.log("VERDICT: KYC / POLICY GATE (Bright Data) — submit KYC at https://brightdata.com/cp/kyc OR switch zone product (Datacenter / Web Unlocker / ISP).");
    } else {
      console.log(`VERDICT: POLICY GATE (${provider}) — the residential network blocked the request, often due to a per-target restriction. Check the provider's docs / contact support.`);
    }
  } else {
    console.log("VERDICT: UNCLASSIFIED — see check table above for individual probe details.");
  }
  console.log("=".repeat(78));
  process.exit(exit);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(4);
});
