# BatchData Integration Spec

**Status:** Draft — ready for developer handoff
**Author:** FlipOps engineering
**Target vendor:** BatchData (batchdata.io) — property data + skip trace
**Bootstrap phase:** Yes. We will migrate to Cotality at scale; BatchData is the V1 data source.
**Related files in repo:**
- `flipops-site/lib/batchdata.ts` — existing minimal skip-trace helper (single endpoint only)
- `flipops-site/prisma/schema.prisma` — `Property` model already has fields we will write to
- `flipops-site/app/api/webhooks/` — vendor webhook handler pattern to mirror (`calltools`, `clerk`, `n8n`, `sheets`)
- `flipops-site/lib/reapi/` — reference integration we are replacing/augmenting
- `flipops-site/CLAUDE.md` — documents that `BATCHDATA_API_KEY` already exists and a weekly skip-trace cron already runs

> **Important doc-access note.** BatchData's developer portal (`developer.batchdata.com`) is a Stoplight site that renders endpoint reference pages with JavaScript. `WebFetch` and most static crawlers return empty pages. This spec was assembled from:
> 1. The working `lib/batchdata.ts` in this repo (real base URL + auth).
> 2. An official Python mock-API notebook (`analyticsariel/projects/skip_tracing/batchdata_skip_tracing_mock_data.ipynb`) — full request + response JSON against the Stoplight mock server.
> 3. The public MCP server `zellerhaus/batchdata-mcp-real-estate` (`batchdata_mcp_server.ts`) — authoritative endpoint paths and `searchCriteria` shapes for property search, lookup, address verify, geocode.
> 4. BatchData marketing + support pages (batchdata.io, help.batchservice.com) for pricing, compliance, hit-rate, pagination semantics.
>
> Items flagged **[NEEDS VERIFICATION FROM PORTAL]** need a developer with portal login to confirm. Everything else has at least one primary source and matches across sources.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [One-Time Setup](#2-one-time-setup)
3. [Environment Variables](#3-environment-variables)
4. [Authentication, Base URL, Rate Limits, Errors](#4-authentication-base-url-rate-limits-errors)
5. [Endpoint Catalog](#5-endpoint-catalog)
6. [Property Search — Request & Filter Reference](#6-property-search--request--filter-reference)
7. [Skip Trace — Request & Response Reference](#7-skip-trace--request--response-reference)
8. [Property Lookup — Single-Address Enrichment](#8-property-lookup--single-address-enrichment)
9. [Async Endpoints & Webhooks](#9-async-endpoints--webhooks)
10. [Database Schema Additions](#10-database-schema-additions)
11. [Internal API Routes on FlipOps](#11-internal-api-routes-on-flipops)
12. [Client Library (`lib/batchdata/`)](#12-client-library-libbatchdata)
13. [UI Surfaces (Leads page)](#13-ui-surfaces-leads-page)
14. [Phased Build Plan](#14-phased-build-plan)
15. [Cost Model](#15-cost-model)
16. [TCPA / DNC Compliance](#16-tcpa--dnc-compliance)
17. [Error Handling, Retries, Rate-Limit Strategy](#17-error-handling-retries-rate-limit-strategy)
18. [Data Quality Notes & Gotchas](#18-data-quality-notes--gotchas)
19. [Migration Path to Cotality](#19-migration-path-to-cotality)
20. [Open Questions / NEEDS VERIFICATION](#20-open-questions--needs-verification)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            FlipOps (Next.js 15)                          │
│                                                                          │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐  │
│  │  Leads UI    │────▶│  /api/batchdata/ │────▶│  lib/batchdata/      │  │
│  │  (ZIP +      │     │  search          │     │  client.ts           │  │
│  │   filters)   │     │  skip-trace      │     │  (fetch + retry +    │  │
│  └──────────────┘     │  query           │     │   rate-limit +       │  │
│                       │  lookup          │     │   Zod response       │  │
│  ┌──────────────┐     └────────┬─────────┘     │   validation)        │  │
│  │ Underwriting │              │               └──────────┬───────────┘  │
│  │  "Skip Trace"│──────────────┘                          │              │
│  └──────────────┘                                         │              │
│                                                           │              │
│  ┌──────────────┐     ┌──────────────────┐                │              │
│  │  Cron worker │────▶│ cron/discovery/  │────────────────┘              │
│  │  (nightly)   │     │ batchdata-pull   │     writes ▼                  │
│  └──────────────┘     └──────────────────┘     ┌──────────────────────┐  │
│                                                │  Prisma / Postgres   │  │
│  ┌──────────────────────┐                      │                      │  │
│  │ Webhook receiver     │─── writes ─────────▶ │  Property            │  │
│  │ /api/webhooks/       │                      │  BatchDataQuery      │  │
│  │   batchdata          │                      │  BatchDataRun        │  │
│  └──────────────────────┘                      │  SkipTraceResult     │  │
│         ▲                                      │  BatchDataApiLog     │  │
│         │ optional async callback              └──────────────────────┘  │
│                                                                          │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          │  HTTPS (Bearer token)
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  BatchData API  (api.batchdata.com/api/v1)               │
│                                                                          │
│  /property/search/sync     /property/search/async                        │
│  /property/lookup/sync     /property/lookup/async                        │
│  /property/skip-trace      /property/skip-trace/async                    │
│  /address/verify           /address/autocomplete                         │
│  /address/geocode          /address/reverse-geocode                      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Flow descriptions**

- **Interactive search (Phase 1).** User enters ZIP + distress chips on the Leads page → `POST /api/batchdata/search` runs the query synchronously → matches are upserted into `Property` with `dataSource='batchdata'` and scored by the existing distress algorithm (`lib/reapi/utils/distress-scorer.ts`) → response is returned and rendered on the map + list.
- **Skip trace (Phase 2).** User clicks "Skip Trace" on a property card → `POST /api/batchdata/skip-trace` hits `/property/skip-trace` (sync, up to 100 addresses per call) → writes phone/email arrays to the existing `Property.phoneNumbers` / `Property.emails` JSON columns, stores the raw response in `SkipTraceResult`, flips `Property.enriched=true`.
- **Saved searches (Phase 4).** `BatchDataQuery` row stores filter JSON; a nightly cron (`cron/discovery/batchdata-pull.ts`) re-runs each query, diffs against existing `Property` rows in that query's scope, and upserts only new matches. A `BatchDataRun` row logs each execution (count, cost, timing).
- **Async webhook (optional, Phase 5+).** For very large pulls, use `/property/search/async` + `/property/skip-trace/async` which accept a callback URL; our `/api/webhooks/batchdata` receives the result payload, verifies signature, and queues row writes.

---

## 2. One-Time Setup

### 2.1 Create BatchData account
1. Sign up at `https://batchdata.io` (now also accessible via `app.batchdata.com`). BatchSkipTracing customers were merged into BatchData on 2025-08-15 — if the account already exists on BatchSkipTracing, those credentials carry over.
2. Choose plan:
   - **Development / internal testing:** request a **mock API key** (aimed at the Stoplight mock base URL `https://stoplight.io/mocks/batchdata/batchdata/20349728`). This returns canned responses and does not bill.
   - **Production:** subscribe to Property Data + Skip Tracing (see [§15 Cost Model](#15-cost-model)).
3. Generate live API key in the account dashboard (Settings → API Keys). Copy it immediately; BatchData does not re-display.

### 2.2 Register webhook (if using async)
In the account dashboard, register a callback URL for async results. Use:

```
https://app.flipops.com/api/webhooks/batchdata
```

Generate and save the **webhook signing secret** — we store it as `BATCHDATA_WEBHOOK_SECRET` and use it to HMAC-verify incoming requests.

### 2.3 Allow-list egress IPs (optional)
BatchData does not require IP allow-listing today, but document Railway's egress IP range in `docs/deployment/` in case it is added later.

### 2.4 Connect to Slack notifications
The existing alert bus (`lib/notifications.ts`) posts to Slack; Phase 1 will add a `batchdata.search.completed` notification type for large pulls.

---

## 3. Environment Variables

Add to `env.sample` and Railway production env:

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `BATCHDATA_API_KEY` | yes (prod) | Bearer token for live API. | `bd_live_abcd1234…` |
| `BATCHDATA_API_KEY_MOCK` | optional | Mock key for Stoplight mock URL used in tests. | `bd_mock_…` |
| `BATCHDATA_BASE_URL` | no | Override base URL. Defaults to `https://api.batchdata.com/api/v1`. Set to `https://stoplight.io/mocks/batchdata/batchdata/20349728` in test/preview. | |
| `BATCHDATA_WEBHOOK_SECRET` | yes (if async) | HMAC secret shared with BatchData for signing async callbacks. | `whsec_…` |
| `BATCHDATA_MAX_RPS` | no | Client-side throttle in requests/sec. Defaults to `5`. | `5` |
| `BATCHDATA_DAILY_BUDGET_CENTS` | no | Soft cap per day in cents — cron checks before running. | `10000` |
| `FO_BATCHDATA_ENABLED` | no | Feature flag. Default `true`. | `true` |

> The existing `CLAUDE.md` already lists `BATCHDATA_API_KEY - BatchData API for skip tracing ($0.20/record)`. Keep that value; we only add the new vars around it.

---

## 4. Authentication, Base URL, Rate Limits, Errors

### 4.1 Auth header
All endpoints accept:

```
Authorization: Bearer <BATCHDATA_API_KEY>
Content-Type:  application/json
Accept:        application/json
```

> Confirmed from `lib/batchdata.ts` (in-repo) and `batchdata_mcp_server.ts` (public MCP server). Some blog posts also reference an `X-API-Key` header; **prefer `Authorization: Bearer` — that is what the working code uses.** If BatchData support says otherwise for a newer endpoint, add a per-endpoint override in the client.

### 4.2 Base URL

- **Production:** `https://api.batchdata.com/api/v1`
- **Mock (Stoplight):** `https://stoplight.io/mocks/batchdata/batchdata/20349728`
  - Append the same endpoint paths (e.g., `/property/skip-trace`) — payloads and response shapes match prod.

### 4.3 Rate limits

BatchData does not publish hard per-account RPS limits in public docs. Observed/community limits:

| Endpoint family | Safe rate | Absolute max (per public MCP docs, approximate) |
|---|---|---|
| `/address/verify` | 50 rps | 5,000 rps (1,000 recommended) |
| `/address/geocode`, `/reverse-geocode` | 30 rps | 90 rps (75 recommended) |
| `/property/search/sync`, `/property/lookup/sync` | 5 rps | 1,000 total concurrent requests |
| `/property/skip-trace` | 5 rps, ≤100 addresses/request | — |

Default our client to **5 rps with a token-bucket limiter** (see [§17](#17-error-handling-retries-rate-limit-strategy)). On `429`, back off exponentially (250 ms → 500 ms → 1 s → 2 s → 4 s, max 5 retries).

### 4.4 HTTP status codes

| Status | Meaning | Action |
|---|---|---|
| `200` | OK — check `results.meta.results.errorCount` and per-record `meta.error` for partial failures. | Process response. |
| `202` | Accepted (async only) — job queued; results via webhook. | Store `jobId`. |
| `400` / `422` | Malformed JSON / invalid field. | Log full body; do not retry. Surface to developer. |
| `401` / `403` | Bad key / unauthorized for endpoint. | Surface to ops; do not retry. |
| `404` | No match (lookup) or resource not found. | Record as "no match" — billable only if BatchData's per-record semantics say so. |
| `415` | Unsupported Media Type — `Content-Type` missing. | Fix header. |
| `429` | Rate limit. | Back off + retry. |
| `5xx` | BatchData outage. | Exponential retry up to 5x. If still failing, circuit-break for 60 s. |

### 4.5 Response envelope (shared across POST endpoints)

```json
{
  "status": { "code": 200, "text": "OK" },
  "results": {
    "persons":  [ ... ],      // or "properties" / "addresses" depending on endpoint
    "meta": {
      "apiVersion": "2.10.2",
      "performance": { "totalRequestTime": 948, "startTime": "…", "endTime": "…" },
      "results":   { "requestCount": 1, "matchCount": 1, "noMatchCount": 0, "errorCount": 0 },
      "requestId": "1gKSoy00kQLgmyQ"
    }
  }
}
```

Always persist `results.meta.requestId` on our side (for BatchData support tickets and dedup).

---

## 5. Endpoint Catalog

All endpoints are `POST` with JSON body unless noted. Base URL prepended.

| Path | Purpose | Sync/Async | Max records per request |
|---|---|---|---|
| `/property/search/sync` | Filtered list query (distress, geo, valuation, etc.) | sync | `take` up to ~100 per page; paginate with `skip` |
| `/property/search/async` | Same as above, async via webhook | async | much higher — designed for bulk list pulls |
| `/property/lookup/sync` | Full 700+ attribute enrichment for one address or APN | sync | 1 per request |
| `/property/lookup/async` | Same async; for batches | async | bulk |
| `/property/skip-trace` | Return owner contact info for 1–100 property addresses | sync | **100 addresses per call** |
| `/property/skip-trace/async` | Same, async via webhook | async | bulk |
| `/address/verify` | USPS verification + standardization | sync | batched |
| `/address/autocomplete` | Typeahead | sync | `take` up to 10 |
| `/address/geocode` | Address → lat/lng | sync | batched |
| `/address/reverse-geocode` | lat/lng → address | sync | 1 per request |

Note on paths: BatchData uses the `/sync` and `/async` suffix pattern on property endpoints but **not** on skip-trace — the bare `/property/skip-trace` is sync, `/property/skip-trace/async` is async. Keep this quirk in the client constants file.

---

## 6. Property Search — Request & Filter Reference

### 6.1 Endpoint
`POST https://api.batchdata.com/api/v1/property/search/sync`

### 6.2 Request body shape

```jsonc
{
  "searchCriteria": {
    "query": "Jacksonville, FL",                 // free-text location
    "quickLists": [                               // distress presets — see §6.3
      "preforeclosure",
      "high-equity",
      "absentee-owner"
    ],
    "address": {
      "zip":    ["32207", "32204"],               // array OR single string
      "city":   "Jacksonville",
      "state":  "FL",
      "county": "Duval",
      "geoLocationBoundingBox": {                 // optional
        "nwGeoPoint": { "latitude": "30.45", "longitude": "-81.70" },
        "seGeoPoint": { "latitude": "30.25", "longitude": "-81.55" }
      },
      "geoLocationDistance": {                    // optional radius
        "geoPoint": { "latitude": 30.332, "longitude": -81.656 },
        "distanceKilometers": 10
      }
    },
    "general": {
      "propertyTypeDetail": { "equals": "Single Family" },
      "bedrooms":  { "min": 2, "max": 5 },
      "bathrooms": { "min": 1 },
      "buildingSize": { "min": 800, "max": 3500 },// sqft
      "lotSize":     { "min": 2000 },
      "yearBuilt":   { "min": 1960, "max": 2015 }
    },
    "valuation": {
      "estimatedValue":  { "min": 100000, "max": 400000 },
      "equityPercent":   { "min": 40 },
      "equity":          { "min": 50000 },
      "ltv":             { "max": 60 }
    },
    "intel": {
      "lastSoldDate":  { "minDate": "2010-01-01", "maxDate": "2024-12-31" },
      "lastSoldPrice": { "min": 50000, "max": 300000 },
      "ownerOccupied": false,
      "absenteeOwner": true,
      "yearsOwned":    { "min": 10 }
    }
  },
  "options": {
    "skip": 0,
    "take": 50,
    "skipTrace": false            // true to include owner contact in-line (2 billable events per record!)
  }
}
```

All filter groups (`general`, `valuation`, `intel`, `address`) are optional — combine only what you need. Most fields accept a `{ min, max }` object; booleans are plain booleans; enums use `{ equals: "…" }` or `{ in: ["…"] }`. **[NEEDS VERIFICATION FROM PORTAL]**: exhaustive enum values for `propertyTypeDetail`.

### 6.3 `quickLists` values (distress indicators)

These are the high-value presets that wrap multiple underlying filters. Confirmed in BatchData marketing pages (`/smart-search`, `/pre-foreclosure-data`, `/faq`) and the BatchLeads help center. **Exact string casing [NEEDS VERIFICATION FROM PORTAL]** — BatchData's docs use kebab-case in UI but some API fields are camelCase. Build the client with a `QUICK_LISTS` constant so we can correct without grepping.

| FlipOps distress chip | Likely `quickLists` value(s) | Maps to Property field |
|---|---|---|
| Pre-foreclosure | `preforeclosure` | `preForeclosure` |
| Foreclosure (auction) | `foreclosure` or `auction` | `foreclosure` |
| Tax delinquent | `tax-delinquent` / `tax-default` | `taxDelinquent` |
| Tax lien | `tax-lien` | (set `taxDelinquent` + keep in metadata) |
| Vacant | `vacant` | `vacant` |
| Absentee owner | `absentee-owner` | `absenteeOwner` |
| Out-of-state owner | `out-of-state-owner` | (set `absenteeOwner` + metadata flag) |
| Inherited | `inherited` | (metadata flag — no column today) |
| Bankruptcy | `bankruptcy` | `bankruptcy` |
| High equity (50 %+) | `high-equity` | (compute from `equityPercent`) |
| Free & clear (no mortgage) | `free-and-clear` | (metadata flag) |
| Code violation | `code-violation` / `violation` | (metadata flag) |
| Senior owner (65+) | `senior-owner` | (metadata flag) |
| Long-term owner | `long-term-owner` | (metadata flag — compute from `yearsOwned`) |
| Recent divorce | `divorce` | (metadata flag) |

Recommend extending `Property` with **two additional columns** to capture what today's schema cannot:
- `inherited Boolean @default(false)`
- `codeViolation Boolean @default(false)`

Everything else can ride in `Property.metadata` (JSON) for now.

### 6.4 Response shape (property search)

```jsonc
{
  "status": { "code": 200, "text": "OK" },
  "results": {
    "properties": [
      {
        "_id": "p_abc123",
        "address": {
          "houseNumber": "1234",
          "street": "1234 Oak St",
          "city": "Jacksonville",
          "county": "Duval",
          "state": "FL",
          "zip": "32207",
          "zipPlus4": "1234",
          "latitude": 30.3123,
          "longitude": -81.6543,
          "formattedStreet": "Oak St",
          "streetNoUnit": "1234 Oak St",
          "hash": "ab12…",
          "countyFipsCode": "12031"
        },
        "apn": "123456-7890",
        "owner": {
          "name": { "first": "Jane", "last": "Smith", "full": "Jane Smith" },
          "mailingAddress": { "...same shape as address..." }
        },
        "general": {
          "propertyType": "Residential",
          "propertyTypeDetail": "Single Family",
          "bedrooms": 3,
          "bathrooms": 2,
          "buildingSize": 1450,
          "lotSize": 7500,
          "yearBuilt": 1978
        },
        "valuation": {
          "estimatedValue": 245000,
          "equity": 132000,
          "equityPercent": 53.8,
          "ltv": 46.2
        },
        "intel": {
          "lastSoldDate":  "2011-05-02",
          "lastSoldPrice": 112000,
          "ownerOccupied": false,
          "absenteeOwner": true,
          "vacant":        false,
          "preforeclosure": true,
          "auction":        false,
          "taxDelinquent":  false,
          "bankruptcy":     false,
          "yearsOwned":     13
        },
        "assessment": {
          "assessedValue": 178000,
          "taxAmount":     2900,
          "taxYear":       2024
        },
        "uspsDeliverable": true
      }
    ],
    "meta": {
      "apiVersion": "2.10.2",
      "performance": { "totalRequestTime": 812 },
      "results":   {
        "requestCount": 1,
        "totalResults": 1284,        // total matches for the query
        "returnedCount": 50,         // matches in this page
        "skip": 0,
        "take": 50
      },
      "requestId": "req_…"
    }
  }
}
```

> **Field names marked italic in the schema-less parts [NEEDS VERIFICATION FROM PORTAL].** The *shape* (nested `address`/`owner`/`general`/`valuation`/`intel`) is confirmed by the skip-trace sample (§7.3) because skip-trace embeds the same `property` sub-object.

### 6.5 Pagination
- Send `options.skip` + `options.take`. Max `take` is typically 50–100 depending on plan. **[NEEDS VERIFICATION FROM PORTAL]**.
- Per BatchData support (`help.batchservice.com/en/articles/9891628`), **billing is per returned record, not per match** — so cap `take` to what the UI needs.
- For bulk list pulls, prefer `/property/search/async` which handles the cursor internally.

---

## 7. Skip Trace — Request & Response Reference

### 7.1 Endpoint
`POST https://api.batchdata.com/api/v1/property/skip-trace`

### 7.2 Request body

```json
{
  "requests": [
    {
      "propertyAddress": {
        "street": "1011 Rosegold St",
        "city":   "Franklin Square",
        "state":  "NY",
        "zip":    "11010"
      },
      "requestId": "flipops_property_abc123"
    }
  ]
}
```

- `requests` is an array. Up to **100 addresses per call**.
- `requestId` (optional but strongly recommended) — we pass `Property.id` so we can correlate async callbacks and dedup.
- No owner name required. Address alone is the lookup key.

### 7.3 Response body (verified against mock)

```json
{
  "status": { "code": 200, "text": "OK" },
  "results": {
    "persons": [
      {
        "_id": "tOdljN72SozLw",
        "name": { "first": "john", "last": "dow", "full": "john dow" },
        "emails": [ { "email": "john@example.net" } ],
        "phoneNumbers": [
          { "number": "123-123-1234", "carrier": "Verizon", "type": "Mobile",    "tested": true, "reachable": true,  "score": 100 },
          { "number": "987-654-3210", "carrier": "AT&T",    "type": "Land Line", "tested": true, "reachable": false, "score": 85 }
        ],
        "mailingAddress": { "...address shape..." },
        "bankruptcy": {},
        "death":      {},
        "dnc":        {},                 // populated if DNC-listed; see §16
        "litigator":  false,              // TCPA-litigator flag
        "involuntaryLien": [],
        "propertyAddress": { "...address shape..." },
        "property": {
          "address":        { "...address shape..." },
          "owner":          { "name": { "first": "john", "last": "doe" }, "mailingAddress": { "..." } },
          "equity":         171469,
          "equityPercent":  30.2,
          "absenteeOwner":  true,
          "vacant":         false,
          "uspsDeliverable":true
        },
        "meta": { "matched": true, "error": false }
      }
    ],
    "meta": {
      "apiVersion": "2.10.2",
      "performance": { "totalRequestTime": 948, "startTime": "…", "endTime": "…" },
      "results":   { "requestCount": 1, "matchCount": 1, "noMatchCount": 0, "errorCount": 0 },
      "requestId": "1gKSoy00kQLgmyQ"
    }
  }
}
```

### 7.4 Key fields & phone-number scoring

- `phoneNumbers[].type` — `"Mobile"`, `"Land Line"`, or `"Voip"`. **Use `Mobile` for SMS / Telnyx A2P**; send voice-only to landlines.
- `phoneNumbers[].score` — integer 0–100, BatchData's confidence that this number belongs to the subject today.
- `phoneNumbers[].reachable` — boolean; result of carrier lookup. If `false`, skip.
- `phoneNumbers[].tested` — boolean; was the number live-pinged? Prefer `tested && reachable`.
- `phoneNumbers[].carrier` — string; useful for spam-flag heuristics.
- `emails[].email` — deliverable-checked, per BatchData docs (~89 % deliverability).
- `dnc` — object populated when the number is on the federal/state DNC registries. Treat any non-empty `dnc` as "do not dial for marketing." See [§16](#16-tcpa--dnc-compliance).
- `litigator` — boolean. **If `true`, do not contact under any circumstances.** These are serial TCPA plaintiffs.

### 7.5 Right-party contact (RPC) rate

BatchData publishes 76 % RPC, 89 % email deliverability, 30–55 % email match rate. This is ~3× industry average and is what we market in our pricing comparison. Expect lower on LLC/trust-owned properties — BatchData's "entity resolution" feature tries to pierce corporate ownership but is not guaranteed.

### 7.6 Cost semantics
- **Billed per successful match** (non-empty `persons[i]` with `meta.matched: true`). Empty matches are typically free. **[NEEDS VERIFICATION FROM PORTAL]**.
- CLAUDE.md's documented price of `$0.20/record` applies to this endpoint.
- If `options.skipTrace: true` is added to `/property/search/sync` the server returns contacts in-line but **each record is billed as both a search result AND a skip trace** — cheaper to do two calls only when needed.

---

## 8. Property Lookup — Single-Address Enrichment

### 8.1 Endpoint
`POST https://api.batchdata.com/api/v1/property/lookup/sync`

Use this when the user drops a pin or pastes an address on the Underwriting page and we need the full 700+ attribute payload (comps, mortgage history, tax history, hazard, assessor).

### 8.2 Request — by address

```json
{
  "requests": [
    {
      "address": {
        "street": "1234 Oak St",
        "city":   "Jacksonville",
        "state":  "FL",
        "zip":    "32207"
      }
    }
  ],
  "options": { "skipTrace": false }
}
```

### 8.3 Request — by APN

```json
{
  "requests": [
    {
      "address": { "county": "Duval", "state": "FL" },
      "apn": "123456-7890"
    }
  ]
}
```

### 8.4 Response

Same envelope as property search but `properties[0]` contains the full attribute set (adds `sale_history[]`, `mortgage_history[]`, `assessment_history[]`, `hoa`, `floodZone`, `propertyTax`, etc.). **[NEEDS VERIFICATION FROM PORTAL]** for exact nested keys — we will validate with Zod and surface unknown keys as metadata.

---

## 9. Async Endpoints & Webhooks

### 9.1 When to use async
- Property search with expected > 5,000 results (bulk list pulls).
- Skip tracing > ~500 addresses in one batch (faster than paginating sync).
- Scheduled nightly jobs where we do not need to hold an HTTP connection open.

### 9.2 Async request

```
POST /property/search/async
POST /property/skip-trace/async
POST /property/lookup/async
```

Body is identical to the sync variant plus:

```jsonc
{
  "callback": {
    "url":    "https://app.flipops.com/api/webhooks/batchdata",
    "method": "POST",
    "headers": { "X-FlipOps-Source": "batchdata-async" }  // optional
  },
  "searchCriteria": { ... },
  "options": { ... }
}
```

Response is `202 Accepted`:

```json
{
  "status": { "code": 202, "text": "Accepted" },
  "results": { "jobId": "job_abc123", "estimatedCompletionSeconds": 120 }
}
```

### 9.3 Webhook payload (to our /api/webhooks/batchdata)

Expected payload (pattern inferred from BatchData GoHighLevel integration guide — **[NEEDS VERIFICATION FROM PORTAL]**):

```jsonc
{
  "jobId":     "job_abc123",
  "event":     "property.search.completed",     // or skip-trace.completed / failed
  "status":    { "code": 200, "text": "OK" },
  "requestId": "req_…",
  "results":   { /* same shape as sync response */ }
}
```

With headers:

```
X-BatchData-Signature: t=1700000000,v1=<hex_hmac_sha256>
X-BatchData-Event: property.search.completed
```

### 9.4 Signature verification

```ts
// app/api/webhooks/batchdata/route.ts
import crypto from "node:crypto";

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  // Header format: t=<unix_seconds>,v1=<hex>
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const { t, v1 } = parts as { t: string; v1: string };
  if (!t || !v1) return false;

  // Reject if timestamp > 5 min old (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

### 9.5 Webhook handler pseudocode

```ts
// app/api/webhooks/batchdata/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/batchdata/webhook";
import { upsertSearchResults, upsertSkipTraceResults } from "@/lib/batchdata/persist";

const PayloadSchema = z.object({
  jobId: z.string(),
  event: z.enum([
    "property.search.completed",
    "property.search.failed",
    "property.skip-trace.completed",
    "property.skip-trace.failed",
    "property.lookup.completed",
  ]),
  status: z.object({ code: z.number(), text: z.string() }),
  requestId: z.string().optional(),
  results: z.any(),
});

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-batchdata-signature");
  if (!sig || !verifySignature(raw, sig, process.env.BATCHDATA_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const parsed = PayloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { jobId, event, results } = parsed.data;

  // Idempotency: jobId UNIQUE on BatchDataRun
  const run = await prisma.batchDataRun.findUnique({ where: { jobId } });
  if (run?.completedAt) return NextResponse.json({ ok: true, dedup: true });

  if (event === "property.search.completed")     await upsertSearchResults(jobId, results);
  if (event === "property.skip-trace.completed") await upsertSkipTraceResults(jobId, results);

  await prisma.batchDataRun.update({
    where: { jobId },
    data:  { completedAt: new Date(), resultCount: results?.meta?.results?.returnedCount ?? 0 },
  });

  return NextResponse.json({ ok: true });
}
```

### 9.6 Change-monitoring webhook (ownership / new listings)

BatchData publishes a "Smart Monitoring" product (`/smart-monitoring`) which pushes ownership-change, new-listing, and new-distress events for a saved list. **Confirm availability on our plan tier before relying on it.** Phase 5 feature.

---

## 10. Database Schema Additions

Add the following to `prisma/schema.prisma`. All are additive (no destructive migration).

### 10.1 `BatchDataQuery` — saved searches

```prisma
model BatchDataQuery {
  id          String   @id @default(cuid())
  userId      String   // multi-tenant
  name        String   // "Jacksonville preforeclosure 100-300k"
  filters     Json     // full searchCriteria + options payload we POST
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  enabled     Boolean  @default(true)
  schedule    String?  // cron expression, null = manual
  resultCount Int      @default(0) // results on last run
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  runs        BatchDataRun[]

  @@index([userId, enabled])
  @@index([nextRunAt])
}
```

### 10.2 `BatchDataRun` — one row per execution (sync or async)

```prisma
model BatchDataRun {
  id            String   @id @default(cuid())
  queryId       String?  // null for one-off interactive searches
  userId        String
  kind          String   // "search" | "skip-trace" | "lookup"
  mode          String   // "sync" | "async"
  jobId         String?  @unique  // BatchData's jobId (async)
  requestBody   Json
  responseMeta  Json?    // results.meta only — keep the full payload in S3/R2 if we need it later
  resultCount   Int      @default(0)
  matchCount    Int      @default(0)
  costCents     Int      @default(0) // computed locally from plan rate card
  status        String   @default("pending") // pending|completed|failed
  errorMessage  String?
  startedAt     DateTime @default(now())
  completedAt   DateTime?

  query         BatchDataQuery? @relation(fields: [queryId], references: [id], onDelete: SetNull)
  skipTraces    SkipTraceResult[]

  @@index([userId, kind, startedAt])
  @@index([queryId, startedAt])
}
```

### 10.3 `SkipTraceResult` — one row per skip-trace attempt per property

Raw payload is stored for audit + re-use (re-attempting within 90 days should NOT re-bill if we have a recent row).

```prisma
model SkipTraceResult {
  id            String   @id @default(cuid())
  userId        String
  propertyId    String
  runId         String?  // BatchDataRun that produced this
  matched       Boolean
  ownerName     String?
  phoneJson     Json?    // full phoneNumbers[] from BatchData (type/score/dnc/etc.)
  emailJson     Json?    // full emails[]
  dncFlags      Json?    // populated `dnc` object
  litigator     Boolean  @default(false)
  rawResponse   Json     // full person record for audit
  batchRequestId String? // results.meta.requestId
  createdAt     DateTime @default(now())

  property      Property      @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  run           BatchDataRun? @relation(fields: [runId], references: [id], onDelete: SetNull)

  @@index([propertyId, createdAt])
  @@index([userId, createdAt])
}
```

### 10.4 `BatchDataApiLog` — rate-limit / cost observability (append-only)

```prisma
model BatchDataApiLog {
  id           String   @id @default(cuid())
  userId       String?
  endpoint     String   // "/property/search/sync"
  httpStatus   Int
  durationMs   Int
  requestId    String?  // BatchData's results.meta.requestId
  recordCount  Int      @default(0)
  costCents    Int      @default(0)
  createdAt    DateTime @default(now())

  @@index([endpoint, createdAt])
  @@index([userId, createdAt])
}
```

### 10.5 Additions to existing `Property` model

```prisma
model Property {
  // …existing fields…
  inherited     Boolean  @default(false)
  codeViolation Boolean  @default(false)
  // existing: enriched, dataSource, sourceId, phoneNumbers, emails — leave as-is
}
```

Convention:
- `dataSource = "batchdata"` on rows created by a BatchData search.
- `sourceId = <BatchData _id>` for dedup.
- `enriched = true` once skip-trace has succeeded at least once.

### 10.6 Migration command

```bash
npx prisma migrate dev --name add_batchdata_integration
```

---

## 11. Internal API Routes on FlipOps

All routes live under `app/api/batchdata/` and follow the project pattern (Clerk auth → Zod validation → Prisma singleton → NextResponse).

### 11.1 `POST /api/batchdata/search`

Runs a one-off property search synchronously. Writes matches to `Property`, logs the run.

**Request body:**
```jsonc
{
  "filters": { /* searchCriteria (see §6.2) */ },
  "options": { "skip": 0, "take": 50, "skipTrace": false },
  "saveAs":  { "name": "Jacksonville PreFC" }   // optional — also saves as BatchDataQuery
}
```

**Response:**
```jsonc
{
  "runId": "bd_run_…",
  "total": 1284,
  "returned": 50,
  "newProperties": 37,       // rows created this run
  "existingProperties": 13,  // rows we already had (dedup)
  "costCents": 200,
  "properties": [ /* Property rows as rendered on the Leads page */ ]
}
```

### 11.2 `POST /api/batchdata/skip-trace`

**Request body:**
```jsonc
{
  "propertyIds": ["cuid1", "cuid2", ...],   // up to 100
  "force": false                            // if true, skip the 90-day cache check
}
```

Behaviour:
1. For each propertyId, check `SkipTraceResult` — if a match exists in the last **90 days**, reuse it (no new API call).
2. Remaining IDs are batched ≤100 and sent to `/property/skip-trace`.
3. For each `results.persons[i]`, update `Property.ownerName`, merge phone/email JSON arrays (prefer `score` desc, dedup by `number`/`email`), set `enriched=true`, write `SkipTraceResult`.
4. Respect DNC + litigator flags — we DO NOT delete numbers, but we **tag** them in metadata so the Telnyx dialer / SMS campaign code can honor them.

**Response:**
```jsonc
{
  "runId": "bd_run_…",
  "requested": 10,
  "cached":    3,
  "fetched":   7,
  "matched":   6,
  "noMatch":   1,
  "costCents": 140,
  "results": [ /* per-property outcome with counts */ ]
}
```

### 11.3 `GET /api/batchdata/query` — list saved searches

Returns `BatchDataQuery[]` for the current user.

### 11.4 `POST /api/batchdata/query` — save a search

Body: `{ name, filters, schedule? }`. Creates a `BatchDataQuery` row. If `schedule` is set, enroll in the nightly cron.

### 11.5 `POST /api/batchdata/query/:id/run`

Manually trigger a saved query. Returns same shape as `/api/batchdata/search`.

### 11.6 `DELETE /api/batchdata/query/:id`

Soft-delete (set `enabled=false`) or hard-delete; match pattern used by existing query-type endpoints.

### 11.7 `POST /api/batchdata/lookup`

One-address enrichment for the Underwriting page.

```jsonc
{
  "address": { "street": "…", "city": "…", "state": "…", "zip": "…" },
  "skipTrace": false
}
```

Returns the full property payload + optionally creates/updates a `Property` row.

### 11.8 `POST /api/webhooks/batchdata`

See [§9.5](#95-webhook-handler-pseudocode). HMAC-verified receiver for async callbacks.

### 11.9 Auth matrix

| Route | Auth |
|---|---|
| `/api/batchdata/*` (non-webhook) | Clerk (userId required) |
| `/api/webhooks/batchdata` | HMAC signature (no Clerk) |
| `cron/discovery/batchdata-pull` | `FO_API_KEY` header (internal) |

---

## 12. Client Library (`lib/batchdata/`)

Restructure the current single-file `lib/batchdata.ts` into a folder so the skip-trace helper, search helper, and types can coexist.

```
lib/batchdata/
  index.ts              re-exports
  client.ts             fetch wrapper with auth + retry + rate-limit
  types.ts              Zod schemas for every request/response
  search.ts             searchProperties(filters, options)
  skip-trace.ts         skipTraceProperties([{id, address}, …])
  lookup.ts             lookupProperty(address | apn)
  address.ts            verify / geocode helpers
  quick-lists.ts        QUICK_LISTS constant + mappers to Property flags
  persist.ts            upsertSearchResults, upsertSkipTraceResults (used by routes + webhook)
  cost.ts               estimateCost(kind, count) → cents
  webhook.ts            verifySignature()
```

### 12.1 Core client — `lib/batchdata/client.ts`

```ts
import pRetry, { AbortError } from "p-retry";
import { RateLimiter } from "limiter";

const BASE = process.env.BATCHDATA_BASE_URL ?? "https://api.batchdata.com/api/v1";
const KEY  = process.env.BATCHDATA_API_KEY;
const RPS  = Number(process.env.BATCHDATA_MAX_RPS ?? 5);

const limiter = new RateLimiter({ tokensPerInterval: RPS, interval: "second", fireImmediately: true });

export class BatchDataError extends Error {
  constructor(public status: number, public body: unknown, msg: string) { super(msg); }
}

export async function batchdataPost<TResp>(path: string, body: unknown): Promise<TResp> {
  if (!KEY) throw new Error("BATCHDATA_API_KEY not configured");
  await limiter.removeTokens(1);

  return pRetry(async () => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 500 || res.status === 429) {
      throw new Error(`BatchData ${res.status}`);   // retryable
    }
    if (!res.ok) {
      const errBody = await res.text();
      throw new AbortError(new BatchDataError(res.status, errBody, `BatchData ${res.status}: ${errBody}`));
    }
    return res.json() as Promise<TResp>;
  }, { retries: 5, minTimeout: 250, factor: 2, maxTimeout: 4000 });
}
```

### 12.2 Refactor of the existing `lib/batchdata.ts`

The current file (in repo) defines `skipTraceProperty()` and uses the correct base URL + auth. Port it to `lib/batchdata/skip-trace.ts`, keep the existing exported functions as thin wrappers, and **re-export from `lib/batchdata/index.ts`** so existing imports (`import { skipTraceProperty } from "@/lib/batchdata"`) keep working during the transition.

---

## 13. UI Surfaces (Leads page)

Builds on the existing redesigned Leads page (`app/app/leads/page.tsx`).

### 13.1 Search UI (new — Phase 1)

Add a sticky top toolbar above the stats cards:

```
┌────────────────────────────────────────────────────────────────────┐
│ [ZIP or City,State input]  [Run Search ▸]  [Save as…]  [⚙ Filters] │
└────────────────────────────────────────────────────────────────────┘
┌─ Distress chips ───────────────────────────────────────────────────┐
│ [Pre-FC] [Tax Delinq] [Vacant] [Absentee] [High Equity] [+ more ▸] │
└────────────────────────────────────────────────────────────────────┘
┌─ Results split view ───────────────────────────────────────────────┐
│ Mapbox map (pins)           │  List (existing table)               │
└────────────────────────────────────────────────────────────────────┘
```

Interactions:
- Each chip toggles a key in a `quickLists` array.
- "⚙ Filters" opens a sheet with numeric ranges (price, equity %, year built, beds, baths, sqft, last-sold date).
- Submit hits `POST /api/batchdata/search`, writes to `Property`, then refetches the existing leads list.
- Map uses Mapbox (already added to project deps). Pins cluster at low zoom.

### 13.2 Skip-trace action (Phase 2)

- Row action dropdown → "Skip Trace" → calls `POST /api/batchdata/skip-trace` with `{ propertyIds: [id] }`.
- Bulk toolbar (already exists) → "Skip Trace Selected" → up to 100 IDs at once.
- After success, show a toast with match/no-match counts and the refreshed row displays `enriched=true` badge + phone/email icons.

### 13.3 Save-search UI (Phase 4)

- "Save as…" button after a search → modal with name + optional schedule (`none`, `daily 7am`, `weekly Mon 7am`).
- New left-side drawer "Saved Searches" shows `BatchDataQuery` rows with last-run timestamp and result count. Clicking re-runs the query.

### 13.4 Underwriting page (Phase 2+)

- Add "Enrich with BatchData" button on the Property Hero Card → `POST /api/batchdata/lookup` → populates missing `Property` fields (beds, baths, year built, assessment history, APN).

---

## 14. Phased Build Plan

### Phase 1 — Manual search + scoring (Week 1)
- [ ] Prisma migration: `BatchDataQuery`, `BatchDataRun`, `BatchDataApiLog` (skip `SkipTraceResult` until Phase 2).
- [ ] `lib/batchdata/` folder restructure; port existing skip-trace helper.
- [ ] `POST /api/batchdata/search` — sync only; no saved search support.
- [ ] Leads page toolbar + distress chips (frontend).
- [ ] Wire Mapbox pins.
- [ ] Unit tests for `quickLists` → `Property` flag mapping.
- [ ] E2E test against the Stoplight mock URL (no cost).
- **Exit criterion:** a new user can search "Jacksonville preforeclosure" and see 50 scored leads on the map and list within 5 s.

### Phase 2 — Skip trace single + bulk (Week 2)
- [ ] Prisma migration: `SkipTraceResult`.
- [ ] `POST /api/batchdata/skip-trace` with 90-day cache check.
- [ ] "Skip Trace" row action + bulk action on Leads page.
- [ ] DNC/litigator badges on contact chips.
- [ ] Toast summarising cost + match count.
- **Exit criterion:** bulk-trace 25 properties, see phones/emails appear, DNC numbers visibly marked, cost logged.

### Phase 3 — Property Lookup + Underwriting enrichment (Week 3)
- [ ] `POST /api/batchdata/lookup`.
- [ ] "Enrich" button on Underwriting Property Hero Card.
- [ ] Merge assessment/mortgage history into Underwriting seed data.
- **Exit criterion:** pasting an address on Underwriting fills all 700+ data points without manual entry.

### Phase 4 — Saved searches + cron (Week 4)
- [ ] `POST /api/batchdata/query` + `GET` + `POST /:id/run` routes.
- [ ] `cron/discovery/batchdata-pull.ts` — hourly worker that picks up `BatchDataQuery` rows whose `nextRunAt <= now`, runs them, diffs vs existing `Property` rows, writes only new matches.
- [ ] Daily digest email summarising new leads per saved search.
- [ ] Saved-searches drawer on Leads page.
- **Exit criterion:** a user saves "Jax PreFC 100-300k", the nightly cron runs at 7 am, and the user gets a Slack + email digest with new matches only.

### Phase 5 — Async + change monitoring (Week 5+)
- [ ] `POST /api/webhooks/batchdata` with HMAC.
- [ ] Switch large saved queries (> 500 expected results) to `/property/search/async`.
- [ ] Subscribe to BatchData Smart Monitoring events (ownership change, new distress) — requires plan upgrade.
- [ ] Auto-skip-trace: when `Property.score >= 70` (existing threshold), auto-enqueue a skip-trace within 24 h (extends the existing weekly skip-trace cron already documented in `CLAUDE.md`).
- **Exit criterion:** a saved query with 10,000 expected matches completes via webhook without holding an HTTP connection; new-owner events flow into Property metadata in near-real-time.

---

## 15. Cost Model

### 15.1 Plan pricing (standalone API, per BatchData public pricing page as of April 2026)

**Property Data API (search + lookup):**
| Tier | Monthly | Records | Effective $/record |
|---|---|---|---|
| Growth | $1,000/mo | 100,000 | $0.010 |
| Professional | $2,500/mo | 300,000 | $0.0083 |
| Scale | $5,000/mo | 750,000 | $0.0067 |
| Enterprise | custom | custom | lower |

**Skip Tracing API:**
| Tier | Monthly | Records | Effective $/record |
|---|---|---|---|
| Growth | $2,000/mo | 100,000 | $0.020 |
| Professional | $5,000/mo | 300,000 | $0.0167 |
| Scale | $10,000/mo | 750,000 | $0.0133 |
| Enterprise 3M | $20,000/mo | 3,000,000 | $0.0067 |

**Pay-as-you-go** option exists for skip tracing (the FAQ confirms) — no subscription, billed per record. Public pages don't list the PAYG rate, but the existing CLAUDE.md and vendor-side marketing reference **$0.20/record** for skip tracing on small volumes. **[NEEDS VERIFICATION FROM PORTAL]** whether that rate is PAYG-only or a legacy/BatchLeads UI price.

### 15.2 FlipOps target volume (1,000 leads + 500 skip traces / month)

**Option A — cheapest on public pricing:** stay on pay-as-you-go skip trace + no Property Data subscription.
- Property Data: can't — the Growth plan is $1,000 minimum. **Call sales for a "starter" plan or use BatchLeads UI CSV exports feeding our ingest route**. See §18.
- Skip trace (PAYG at $0.20): 500 × $0.20 = **$100/month**.

**Option B — growth plans:**
- Property Data Growth: $1,000/mo (90× headroom on our 1,000 target — we'd underuse it).
- Skip Trace Growth: $2,000/mo (200× headroom — massively underuse it).
- Total: **$3,000/mo**.

**Option C — negotiated bootstrap pricing (recommended):**
- Talk to BatchData sales about a "bootstrap" SKU. Vendors in this segment routinely offer $199–499/mo starter tiers for seed-stage startups. Target: **$500–750/mo all-in** at our volume.

### 15.3 Cost telemetry in FlipOps

Track cost per run in `BatchDataRun.costCents` using a rate card constant:

```ts
// lib/batchdata/cost.ts
export const RATE_CARD_CENTS = {
  search:    1,    // $0.01/record — plan average; override per env
  lookup:    1,
  skipTrace: 20,   // $0.20/record at PAYG; override when on subscription
};
```

Emit daily cost totals to the Analytics dashboard (`/api/analytics` → new `data_cost` widget).

### 15.4 Budget guardrail
`BATCHDATA_DAILY_BUDGET_CENTS` env var; the cron checks `SELECT SUM(costCents) FROM BatchDataRun WHERE startedAt >= CURRENT_DATE` before each run and halts if over.

---

## 16. TCPA / DNC Compliance

**Why this matters.** FlipOps feeds BatchData phones into the Telnyx dialer and SMS campaigns. Calling a DNC-listed consumer carries statutory damages of up to **$500/call** or **$1,500/call** (willful). Calling a TCPA litigator is near-guaranteed litigation.

### 16.1 What BatchData gives us

Per BatchData's skip-trace marketing + the verified response shape:
- `persons[i].dnc` — populated object when the person's number is on the national DNC registry.
- `persons[i].litigator` — boolean; serial TCPA plaintiff indicator ("Litigator Scrub").
- `persons[i].phoneNumbers[j].type` — `Mobile` / `Land Line` / `Voip`. **Mobile numbers require prior express written consent for SMS marketing**; landlines are covered by TCPA voice rules.
- `persons[i].phoneNumbers[j].carrier` — useful for caller-ID-spoofing detection.

### 16.2 What FlipOps must do

1. **Never delete numbers** — keep the full array on `SkipTraceResult.phoneJson`. Delete only on user request (subject access / deletion request).
2. **Tag at storage time.** When merging into `Property.phoneNumbers`, also write a structured `Property.metadata.phoneFlags`:
   ```json
   { "phoneFlags": { "+17135551234": { "dnc": true, "litigator": false, "type": "Mobile", "score": 92 } } }
   ```
3. **Gate outreach at the dialer layer.** Before Telnyx sends an outbound call or SMS:
   ```ts
   if (phoneFlags[number]?.litigator) throw new Error("Litigator - do not contact");
   if (phoneFlags[number]?.dnc && !hasPriorConsent(propertyId, number)) { skip(); }
   ```
4. **Consent capture.** Any manual reply from the consumer ("text me at…", email opt-in form, voicemail drop-back) creates a `ConsentRecord` row that overrides the DNC flag for that specific number. **[Future work — not in Phase 1.]**
5. **Quiet hours.** Telnyx dialer must honour 8 am – 9 pm local time per property state. Use the property's state + a timezone library (already `America/New_York` default on User).
6. **Stop-word handling.** Any inbound SMS containing `STOP`, `UNSUBSCRIBE`, `QUIT` sets a per-number `stopped=true` flag and suppresses all future outreach to that number (globally, across users). This is handled by the SMS/Telnyx layer but wiring starts here.
7. **Audit log.** Every "contact despite DNC?" decision goes into the existing `Event` audit table.

### 16.3 What BatchData does NOT give us

- State-specific DNC registries (some states maintain their own — TX, FL, PA, etc.). BatchData scrubs against the **national** registry only. For production we should layer a state-DNC scrub (e.g., RealPhoneValidation) once volume justifies.
- Reassigned-number database lookups (RND) — required for TCPA safe harbor on phone calls to "old" cellular numbers. BatchData does not offer RND; add Twilio Lookup or similar before voice campaigns scale.

---

## 17. Error Handling, Retries, Rate-Limit Strategy

### 17.1 Retry policy
Implemented in `lib/batchdata/client.ts` via `p-retry`:
- Retry on `5xx` and `429`.
- Exponential backoff: 250 ms → 500 ms → 1 s → 2 s → 4 s.
- Max 5 attempts.
- Abort immediately on `4xx` (except `429`) — these are client bugs.

### 17.2 Rate-limit strategy
- Client-side token bucket at 5 rps (env-configurable).
- Queue requests within a process; if > 50 queued, shed load with a 503 from our route.
- For bulk jobs, prefer the async endpoints over paginated sync loops.
- Circuit breaker: if 3 consecutive requests fail with 5xx, open the breaker for 60 s, return cached / stale Property rows.

### 17.3 Partial success
BatchData returns `200 OK` with per-record errors:

```json
"meta": { "results": { "matchCount": 18, "noMatchCount": 2, "errorCount": 5 } }
```

- `errorCount > 0` → log each failing record to `BatchDataApiLog` with its `meta.errorMessage`; do not mark the whole run as failed.
- `noMatch` is expected at ~5–10 % on skip trace. Write a `SkipTraceResult` row with `matched=false` so we don't retry within 90 days.

### 17.4 Idempotency
- Search: request dedup key = hash of `(userId, filters, date)`. Reruns within 1 hr reuse the last `BatchDataRun`.
- Skip trace: per-property cache window of 90 days via `SkipTraceResult.createdAt`.
- Webhook: `BatchDataRun.jobId` is `@unique` → duplicate deliveries are no-ops.

---

## 18. Data Quality Notes & Gotchas

### 18.1 Address normalization
- Always call `/address/verify` OR pass already-USPS-normalized addresses. BatchData's match rate drops significantly on non-standardized inputs (e.g., "1234 Oak Street NE" vs "1234 Oak St NE").
- The skip-trace response echoes a normalized `propertyAddress` — prefer this over the address we sent when writing back to `Property`.
- `propertyAddress.hash` is a stable dedup key — use it as a secondary `Property.metadata.bdHash` for cross-search dedup.

### 18.2 Duplicates across searches
- Two different saved queries can return the same property. Dedup on (`dataSource=batchdata`, `sourceId=_id`) at upsert time.
- A property matched by BatchData and ATTOM on the same user should NOT create two rows — dedup across `dataSource` using a normalized `(address, city, state, zip)` tuple. Add a composite unique index `@@unique([userId, address, city, state, zip])` on `Property` **if not already present**. (Check before migrating — breaking it retroactively will fail the migration.)

### 18.3 Bulk uploads (CSV)
- BatchData's UI supports CSV bulk skip trace. For Phase 1 we skip this — users will use our Leads page.
- If a customer has an existing CSV of addresses, we can accept it via `POST /api/properties/ingest` (existing endpoint) and then fire `/api/batchdata/skip-trace` on the resulting IDs.

### 18.4 Mock vs prod drift
- The Stoplight mock server returns **static, obviously-fake data** (owner "john dow", phone "123123123"). Don't let a dev accidentally hit mock in prod.
- Feature flag: if `BATCHDATA_BASE_URL` is the stoplight URL, show a **"MOCK DATA — not real"** banner on the Leads page.

### 18.5 Phone scoring + picking the best number
Our merge strategy into `Property.phoneNumbers`:
1. Drop any `litigator: true` entries from the primary array (keep raw in `SkipTraceResult`).
2. Prefer `type = "Mobile"` with `score >= 80` and `reachable = true`.
3. Sort by `score` desc, cap at **5** numbers per property (more is noise in the UI).
4. Never overwrite an existing, already-dialed number — merge by `number` dedup.

### 18.6 Email match rate is lower than phones
30–55 % email match vs ~75 % phone match. Expect some properties with phones but no email. Don't gate outreach on email presence.

### 18.7 LLC / trust properties
- Entity-owned properties have lower RPC. BatchData's "entity resolution" tries to find the human behind the LLC; when successful, `owner.name` is the person, not the LLC, and `meta.matched=true`.
- When unmatched, the `owner.name` may still be the LLC string (e.g., "ACME HOLDINGS LLC"). Keep it — useful for manual research — but don't try to SMS an LLC.

### 18.8 Data freshness
- BatchData markets daily refresh ("real time" for some fields).
- Assume `intel.lastSoldDate` and foreclosure flags can be up to 7 days stale.
- Our nightly cron re-running saved searches will naturally catch changes within 24 h.

### 18.9 Name merge
BatchData sometimes returns `name.first/last` only (no `full`). Our existing `lib/batchdata.ts` already handles this. Port the logic as-is.

---

## 19. Migration Path to Cotality

When we move to Cotality (enterprise-scale MLS + property data), minimize rework:

1. **Isolate the vendor SDK.** All BatchData-specific shapes live in `lib/batchdata/`. Persistence (`upsertSearchResults`) maps vendor → canonical `Property`. Cotality gets its own `lib/cotality/` with the same `upsertSearchResults` interface.
2. **`dataSource` column already exists.** New rows get `dataSource = "cotality"`, old rows stay `dataSource = "batchdata"`. Leads page filters by source in a dropdown.
3. **`BatchDataQuery` model is vendor-specific — generalize it early.** Rename to `SavedSearch` with a `vendor` discriminator column before Phase 4 ships so Cotality saved searches land in the same table.
4. **Skip-trace contract interface.** Define a shared `SkipTraceProvider` interface (`traceOne(address) → Result`); both BatchData and Cotality implement it. Router picks the provider per user/plan.
5. **Double-run window.** During migration, run both sources on the same saved searches for 2 weeks; compare match counts and distress recall; cut over per-user.

---

## 20. Open Questions / NEEDS VERIFICATION

These require a developer with login access to `developer.batchdata.com` OR a support-ticket reply from BatchData. Ship Phase 1 with conservative defaults; correct as answers come in.

1. **Exhaustive `quickLists` values** — confirm the full canonical list and casing. Marketing pages confirm existence, API reference confirms schema. § 6.3.
2. **Max `take` per `/property/search/sync`** — community sources say 50–100; docs not indexable. § 6.5.
3. **Billing semantics for `noMatch` on skip trace** — confirmed "billed per match" in marketing, want it in writing from support. § 7.6.
4. **Webhook signature format** — is it `t=…,v1=…` HMAC-SHA256 like Stripe, or different? § 9.4.
5. **Async job status endpoint** — is there a `GET /jobs/:jobId` poll fallback if the webhook is missed? Most vendors provide one. § 9.
6. **Change-monitoring ("Smart Monitoring") plan availability** — what tier unlocks ownership-change pushes? § 9.6.
7. **Pay-as-you-go rate card** — public page says PAYG exists for skip trace; what's the live per-record rate? § 15.2.
8. **Full `propertyTypeDetail` enum values.** § 6.2.
9. **Does Property Search return `totalResults` or `totalCount`?** Older code (the MCP server) handles both — confirm the canonical field. § 6.4.
10. **RPC / match-rate SLA** — any contractual guarantee, or is 76 % just a marketing number? Matters for SLA credits if we resell skip trace to our customers.

---

## Appendix A — Example Payloads (curl)

### A.1 Skip trace (verified against mock)

```bash
curl -X POST "https://api.batchdata.com/api/v1/property/skip-trace" \
  -H "Authorization: Bearer $BATCHDATA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "propertyAddress": {
          "street": "1011 Rosegold St",
          "city":   "Franklin Square",
          "state":  "NY",
          "zip":    "11010"
        },
        "requestId": "flipops_prop_abc123"
      }
    ]
  }'
```

### A.2 Property search — Jacksonville preforeclosure, high equity

```bash
curl -X POST "https://api.batchdata.com/api/v1/property/search/sync" \
  -H "Authorization: Bearer $BATCHDATA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchCriteria": {
      "quickLists": ["preforeclosure", "high-equity"],
      "address": { "city": "Jacksonville", "state": "FL" },
      "valuation": { "estimatedValue": { "min": 100000, "max": 400000 } },
      "general":   { "propertyTypeDetail": { "equals": "Single Family" } }
    },
    "options": { "skip": 0, "take": 50 }
  }'
```

### A.3 Property lookup by APN

```bash
curl -X POST "https://api.batchdata.com/api/v1/property/lookup/sync" \
  -H "Authorization: Bearer $BATCHDATA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [ { "address": { "county": "Duval", "state": "FL" }, "apn": "123456-7890" } ]
  }'
```

### A.4 Address verify

```bash
curl -X POST "https://api.batchdata.com/api/v1/address/verify" \
  -H "Authorization: Bearer $BATCHDATA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [ { "street": "1234 Oak St", "city": "Jacksonville", "state": "FL", "zip": "32207" } ]
  }'
```

---

## Appendix B — Sources

- In-repo: `flipops-site/lib/batchdata.ts` (production code, real API URL + auth).
- GitHub: `zellerhaus/batchdata-mcp-real-estate/batchdata_mcp_server.ts` (main branch) — endpoint paths, searchCriteria shapes, env var names, rate-limit notes.
- GitHub: `analyticsariel/projects/skip_tracing/batchdata_skip_tracing_mock_data.ipynb` — full request + response JSON verified against Stoplight mock.
- BatchData marketing pages: `batchdata.io` (home, /api-solutions, /skip-tracing, /property-search, /smart-search, /smart-monitoring, /pricing, /faq, /pre-foreclosure-data).
- BatchData blog: `/blog/real-estate-api-documentation-examples`, `/blog/batch-skip-tracing-how-it-works`, `/blog/automate-gohighlevel-property-data-enrichment-batchdata-api`, `/blog/best-real-estate-data-apis-2026-complete-comparison-guide`.
- BatchService help center: `help.batchservice.com/en/articles/9891628-retrieving-paginated-results`.
- BatchData developer portal: `developer.batchdata.com/docs/batchdata/…` — endpoint reference URLs (pages exist and are linkable, but are JS-rendered; full content requires browser-based extraction). Primary URL list:
  - `/operations/create-a-property-search`
  - `/operations/create-a-property-lookup-all-attribute`
  - `/operations/create-a-property-lookup-async`
  - `/operations/create-a-property-skip-trace`
  - `/operations/create-a-property-skip-trace-async`
