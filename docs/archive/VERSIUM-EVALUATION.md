# Versium REACH — Vendor Evaluation for FlipOps

**Status:** Research complete — recommendation below
**Author:** FlipOps engineering
**Date:** 2026-04-20
**Incumbent candidate:** BatchData (see `BATCHDATA-INTEGRATION-SPEC.md`)
**Question answered:** Is Versium REACH a viable bootstrap alternative to BatchData for the beta phase (1,000 leads/mo + 500 skip traces/mo, target spend $200–500/mo)?

> **Doc-access note.** Versium's developer portal (`api-documentation.versium.com`) is a ReadMe.io site that renders with JavaScript. `WebFetch` returns shell HTML for many reference pages. Findings below combine: (a) the public Versium API landscape page which does render usefully, (b) the Versium pricing page, (c) Versium marketing pages for the Real Estate vertical, (d) the published Node SDK on npm (`@versium/reach-api-sdk-node`), (e) third-party reviews (REtipster, G2, prospeo, Datarade), and (f) the BatchData spec already in this repo for head-to-head comparison.

---

## 1. API Inventory

Versium REACH exposes a small, consistent set of **append** endpoints — all `POST`, all at `https://api.versium.com/v2/...`, all auth via `x-versium-api-Key` header.

| Purpose | Path | Notes |
|---|---|---|
| Contact Append (skip trace) | `POST /v2/contact` | Name + address → email, phone (incl. `phone_mobile`), postal |
| Demographic Append | `POST /v2/demographic` | Rich consumer attributes (income, net worth, FICO bucket, lifestyle, ~400 attributes) |
| Online Audience Append (B2B / B2C) | `POST /v2/onlineaudience` | Hashed + alt emails/phones for ad platform matching |
| Firmographic Append | `POST /v2/firmographic` | Business details from domain / business name / phone |
| C2B Append | `POST /v2/c2b` | Consumer email → employer, job title |
| IP-to-Domain | `POST /v2/iptodomain` | IPv4 → business |
| HEM-to-Business-Domain | `POST /v2/hemtobusinessdomain` | Hashed email → business domain |
| Bulk Upload API | separate async endpoint (file-based) | Large-list append via REACH platform, not per-record |

**What is NOT in the endpoint list (important):**

- No property search endpoint. No ability to query "give me all absentee-owner properties in ZIP 32210."
- No pre-foreclosure / tax-delinquent / vacancy / auction feed.
- No MLS or ATTOM-style sale-history endpoint.
- No equity / LTV filter endpoint.
- No litigator-scrub or DNC-scrub endpoint. Their public docs and marketing do not describe a TCPA litigator flag or an internal DNC check. Versium is not a compliance vendor.

---

## 2. Skip-Trace Capabilities (Contact Append)

**Input shape.** `POST /v2/contact` accepts name + postal address as the canonical shape for real-estate use (also supports email or phone as starting points for other flows). For FlipOps this is the right fit — our upstream property providers (REAPI / ATTOM) give us owner name + mailing address and we need phone + email.

**Output.** Up to 5 email addresses and 5 phone numbers per record, postal address. The `phone_mobile` output type is explicitly callable, so mobile-vs-landline differentiation exists at the request level. Demographic flags (age bracket, income, net worth, home value, ownership status) can be added by also calling `/v2/demographic`.

**Hit rate.** Versium marketing claims "~99%" and one published case showed Facebook match rate going from 45% → 86% after append. Third-party reviews are more measured: REtipster calls match rates "solid" without publishing a figure. **Treat anything above ~60% phone hit on distressed-owner lists as the realistic expectation until proven otherwise** — that is roughly on par with what BatchData delivers (their "76% right-party contact" number is similar-in-kind).

**What is missing vs BatchData skip-trace response.**

- No explicit **DNC flag**.
- No explicit **TCPA-litigator flag**.
- No **relatives / associates** section.
- No **deceased** flag exposed in public docs.
- No documented **line-type** certification (mobile/landline/VoIP) on the response beyond the `phone_mobile` request-type distinction.

Data sourcing is described as "proprietary B2B2C identity graph, 2B+ contact points." Versium does not name Acxiom/Experian/Infutor the way compliance-focused vendors do.

---

## 3. Property-Data Capabilities — The Disqualifier

**Versium does not have a property search API.** This is the single most important finding.

Their "Real Estate Prospecting Data" product is an **audience builder** inside the REACH web UI (not the API) that lets you filter homeowner records by:

- Length of residence
- Home ownership status (owner / renter / probable owner)
- Home value bucket, estimated income, net worth
- Mortgage purchase amount, loan type, purchase date (API-exposed as a demographic attribute)

These are **consumer-list filters**, not **distress-property filters**. You cannot:

- Pull a list of pre-foreclosures in a ZIP.
- Filter by tax delinquency.
- Filter by vacancy (no USPS vacancy feed exposed).
- Filter by absentee ownership (not published; "owner" vs "renter" is the only ownership flag).
- Filter by equity percentage or last sale date.
- Filter by code violations / liens / auction status.

The retipster review is unambiguous: *"Versium is append-only — it doesn't pull property lists by distress filters. You upload your own list from DataTree, PropStream, or PropertyRadar, and Versium enriches it."*

**Conclusion for §3.** Versium is **not comparable** to BatchData's Quick Lists. It is comparable to BatchData's skip-trace module only.

---

## 4. Pricing

Versium is priced per **Match Credit** (only successful matches consume credit).

| Tier | Cost | Annual Volume | Per-match | API access |
|---|---|---|---|---|
| Pay-As-You-Go | $125 min/file | <20,000 credits | $0.05–$0.075 | ❌ |
| Credit Packages | from $250 | 20,000+ | $0.033–$0.05 | ✅ |
| Subscription | custom (quote) | 90,000+ | from <$0.02 | ✅ |
| Highest published subscription | $7,200/yr | 450,000 credits | $0.016 | ✅ |
| Lowest subscription line | $3,600/yr | 210,000 credits | $0.017 | ✅ |

Free trial: **5 free downloads** through the REACH web app. No sandbox key is publicly advertised for raw API calls — you need to sign up for a credit package to get a production `x-versium-api-Key`.

### Cost projection for our beta volume

Target: 1,000 leads/mo (hypothetical property append) + 500 skip traces/mo.

- Skip-trace only: 500 × $0.05 ≈ **$25/mo** (Credit Package tier) or <$10/mo at subscription price.
- Add a demographic append pass on all 1,000 leads: 1,000 × $0.05 = **$50/mo**.
- Combined beta burn: **~$60–90/mo** of credit consumption, against a $250 credit pack.

A $250 package covers roughly **3 months** of our beta volume. Subscription ($3,600/yr = $300/mo) becomes worth it only past ~6,000 successful matches/mo. **Versium is dramatically cheaper than BatchData's $2K/mo skip-trace minimum and $1K/mo property-data minimum at our volume.**

---

## 5. Auth + Rate Limits

- **API key header:** `x-versium-api-Key: <key>` (case-sensitive).
- **Transport:** HTTPS required; HTTP fails.
- **Rate limit:** **20 queries per second** account-wide. Versium actively encourages parallelization up to that ceiling. Higher limits via account rep.
- **No published uptime SLA** on the developer portal; enterprise tier likely has one in the MSA.
- **Key management:** self-serve via REACH account dashboard (`Manage your API Key and Usage` doc page exists).

20 QPS is plenty for our beta. For comparison, BatchData's published async burst allowances are similar order of magnitude.

---

## 6. Data Quality Signals

- **Identity graph:** Versium markets a proprietary B2B2C graph with 2B+ contact points, homeowner-specific claim of ~400 attributes/contact.
- **Sources:** Not disclosed at the Acxiom/Infutor level of specificity. This is a real gap vs enterprise-grade vendors and is worth noting for any future due-diligence conversation with Cotality.
- **Refresh cadence:** Not published.
- **Coverage:** US-only (explicitly marketed as US-specific).
- **Third-party reviews:** G2 and SourceForge listings exist; pricing reviews on Prospeo and Datarade match the tier table above. No red flags on accuracy; several reviews praise ROI for high-volume users specifically.

---

## 7. Developer Experience

Solid for our purposes:

- **Node SDK:** `@versium/reach-api-sdk-node` on npm — TypeScript-friendly, Node 16+. Sample code in README shows async iteration over results, filtering failed queries, and checking match success. This is meaningfully better DX than BatchData, which we integrate via hand-rolled fetch.
- **Python SDK:** `VersiumAnalytics/reach-api-python-sdk` on GitHub.
- **Docs:** ReadMe.io reference, which is JS-rendered but complete once in a browser. Covers each endpoint with request/response examples.
- **Async / webhook:** Bulk Upload API exists for async jobs. Not a per-request webhook callback model like BatchData's `/property/search/async` — instead, you upload a file and poll/download results.
- **Interactive "Try It" playground** via ReadMe works with a valid key.

---

## 8. TCPA / DNC Compliance

**This is a weak spot.** Unlike BatchData, which markets DNC-awareness and litigator flagging as a feature, **Versium's public docs do not describe:**

- DNC scrubbing on returned phones.
- TCPA-litigator flagging.
- Consent / opt-out history per record.
- Wireless/VoIP/landline certification (beyond the `phone_mobile` request-type split).

If we use Versium for skip-trace, **DNC scrub must be done downstream** (e.g., a dedicated DNC.com Litigator Scrub pass or the dialer's built-in scrubbing) before any outbound text or call. This adds a compliance hop that BatchData arguably bundles. Budget one more vendor line ($~50–100/mo at beta volume) if we go this route.

---

## 9. Head-to-Head vs BatchData

| Dimension | BatchData | Versium | Winner |
|---|---|---|---|
| Property search by distress (pre-FC, tax-delinquent, vacant, absentee) | ✅ Quick Lists, ZIP+filter | ❌ none | **BatchData** |
| Skip-trace phone (name+address → phone) | ✅ | ✅ `phone_mobile` explicit | tie |
| Skip-trace email | ✅ | ✅ up to 5 emails | tie |
| Relatives / associates | ✅ | ❌ not exposed | BatchData |
| DNC scrub | ✅ bundled awareness | ❌ not documented | BatchData |
| TCPA litigator flag | ✅ | ❌ not documented | BatchData |
| Pricing model at beta | **PAYG $0.30/call** (no monthly minimum — $2K only kicks in on subscription plans) | $125 one-time floor; $250 credit pack | tie |
| Cost for 1,000 property + 500 skip traces/mo (beta PAYG) | **~$450/mo** | ~$25–30/mo skip-trace only; property search unavailable | Depends — see verdict |
| Free trial / sandbox | Stoplight mock server | 5 free downloads + self-serve key | tie |
| API auth / DX | API key, hand-rolled | `x-versium-api-Key`, **official Node SDK** | **Versium** |
| Real-estate-specific features | ✅ full vertical product | partial (homeowner attrs only; no distress feed) | BatchData |
| US coverage | ✅ | ✅ | tie |
| Rate limit | similar | 20 q/s documented | tie |
| Async / bulk | async property/skip endpoints + webhooks | Bulk Upload API (file-based) | BatchData (tighter real-time API) |

---

## 10. Verdict — **Stick with BatchData PAYG. Skip Versium for beta.**

**Critical correction to earlier analysis:** BatchData on pay-as-you-go is **$0.30 per call** (both property data and skip trace). The $2K/mo "minimum" only applies if you choose a subscription plan. FlipOps is PAYG at beta, so the actual BatchData cost is:

| Line item | Volume | Rate | Cost |
|---|---|---|---|
| Property data calls | 1,000/mo | $0.30 | $300 |
| Skip-trace calls | 500/mo | $0.30 | $150 |
| **BatchData PAYG total** |  |  | **$450/mo** |

Now the dual-vendor split costs:

| Line item | Volume | Rate | Cost |
|---|---|---|---|
| Property data (BatchData — irreplaceable) | 1,000/mo | $0.30 | $300 |
| Skip trace (Versium) | 500/mo | ~$0.05 | $25 |
| DNC.com scrub (to replace missing DNC + litigator flag) | per lookup | — | ~$75 |
| **Dual-vendor total** |  |  | **~$400/mo** |

**Delta after DNC.com add-back: ~$50/mo savings.** Not worth the complexity.

**Why BatchData-only wins at PAYG beta volume:**
- One API integration, one contract, one billing relationship
- DNC scrub + TCPA-litigator flag included (Versium has neither — must add DNC.com)
- Relatives/associates data included (Versium lacks)
- Single normalized response shape for the `SkipTraceResult` model
- Cleaner migration path to Cotality later (one vendor swap, not two)
- Operational simplicity > $50/mo during beta

**When Versium becomes worth revisiting:**
- Skip-trace volume climbs above ~3,000/mo (where $0.30 × 3,000 = $900/mo starts to hurt)
- OR we outgrow PAYG and BatchData insists on subscription commit
- OR we find the Node SDK DX meaningfully better in testing (which is a real Versium advantage)

**Do NOT:**
- Replace BatchData with Versium for beta (property search is fully absent; dual-vendor overhead eats the savings)
- Optimize prematurely — at $450/mo total data spend, vendor consolidation is worth more than $50/mo

---

## 11. If we ever adopt Versium later (reference only, not for beta)

1. **Sign up.** Create a REACH account at `https://reach.versium.com/` (linked from versium.com). The 5 free downloads unlock immediately for validation.
2. **Acquire API key.** Account dashboard → API Key section. The key format is a UUID-style string, passed as `x-versium-api-Key: <key>` header. No separate "sandbox key" — same key, development vs prod handled by your own env.
3. **POC endpoints to hit first:**
   - `POST https://api.versium.com/v2/contact` with `{first: ..., last: ..., address: ..., city: ..., state: ..., zip: ..., output_types: ["email", "phone", "phone_mobile"]}` — validate a known-good owner.
   - `POST https://api.versium.com/v2/demographic` on same input to see what distressed-owner signal we can get (income bracket, home value bucket, LoR).
4. **Integration touch points in FlipOps:**
   - **New env var:** `VERSIUM_API_KEY` in `.env` and Railway. Add to `env.sample`.
   - **New client library:** `flipops-site/lib/versium/client.ts` — mirror the structure of `lib/batchdata.ts`. Consider wrapping `@versium/reach-api-sdk-node` rather than hand-rolling fetch (this is a significant DX win over BatchData).
   - **Skip-trace cron:** `lib/cron/discovery/` — the existing weekly BatchData skip-trace job (documented in `CLAUDE.md` as "Weekly Sunday 7:00 AM") should be forked: properties with score ≥70 route to Versium for append; BatchData retained only for the property-pull half of the job. Add a vendor-selection switch.
   - **Prisma schema:** Add `vendor` column to `SkipTraceResult` (enum: `BATCHDATA | VERSIUM`) plus a `VersiumApiLog` model matching the shape of `BatchDataApiLog` already described in the BatchData spec. Migration only, no data backfill needed.
   - **API route:** `app/api/skip-trace/route.ts` — add `?vendor=versium` query param, default remains `batchdata` until validated.
   - **UI surface:** Leads page skip-trace button — no UI change initially; vendor is server-selected. Later, an admin toggle in Settings → Integrations.
   - **DNC compliance hop:** before any Versium-sourced phone is handed to the dialer, run it through DNC.com's Litigator Scrub API (or rely on the dialer's own scrub — confirm with Telnyx/CallTools integration owner). Add a `dncScrubbedAt` timestamp on `SkipTraceResult`.
5. **Validation plan before production cutover:**
   - Run 50 known-distressed properties through both BatchData and Versium.
   - Compare phone hit rate, email hit rate, and right-party contact rate on a 100-call outbound test.
   - If Versium is within 10% of BatchData's RPC rate, commit to the split architecture and resize the BatchData contract to property-only.

---

## Sources

- Versium REACH API reference — https://api-documentation.versium.com/reference/welcome
- Versium API landscape (endpoint list) — https://api-documentation.versium.com/docs/the-versium-api-landscape
- Versium authentication — https://api-documentation.versium.com/reference/authentication
- Versium rate limits — https://api-documentation.versium.com/reference/api-rate-limit
- Versium pricing — https://versium.com/pricing/
- Versium real-estate prospecting — https://versium.com/real-estate-prospecting-data/
- Versium blog — skip tracing for real estate investors — https://versium.com/blog/how-to-use-skip-tracing-for-real-estate-investors
- Node SDK — https://www.npmjs.com/package/@versium/reach-api-sdk-node
- Python SDK — https://github.com/VersiumAnalytics/reach-api-python-sdk
- REtipster independent review — https://retipster.com/versium-review/
- G2 reviews — https://www.g2.com/products/versium-reach/reviews
- BatchData comparison baseline — internal `docs/development/BATCHDATA-INTEGRATION-SPEC.md`
