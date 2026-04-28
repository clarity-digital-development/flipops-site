# Scraper Coverage by County — National Reality

**Question:** Can we scrape all 3,100 US counties cleanly?
**Honest answer:** No. ~60-70% are clean, the rest require progressively more workarounds, and a small minority (~3-5%) require paid subscriptions that we either pass through or skip.

This doc lays out the tier system, examples per tier, mitigation strategies, and how it changes the operational math.

---

## The 6-tier access model

We classify every county into one of six access tiers. The `CountyScraper` table has `accessTier` (1-6), `needsPlaywright`, `needsCaptcha`, `needsLogin`, and `monthlyCostUsd` columns to track this.

### Tier 1 — Open public access (~50-60% of counties)
**What it looks like:** Free public search form. No login. No captcha. Static HTML server-rendered.
**What it takes:** `politeFetch` + `cheerio`. Exactly what we've already built.
**Engineering cost:** Hours per county once the vendor parser is in place.
**Examples:**
- Duval, FL (Jacksonville) — already wired as our reference
- Most Florida counties (Sunshine Law mandates open records)
- Harris, TX (Houston)
- Maricopa, AZ (Phoenix)
- Cook, IL (Chicago)
- Miami-Dade, FL
- Most counties on Tyler Tech iasWorld, Patriot Properties, Vision Government Solutions, Manatron

### Tier 2 — JS-rendered, needs headless browser (~15-20%)
**What it looks like:** React/Vue/Angular SPA. The HTML response is empty until JS runs.
**What it takes:** Playwright or Puppeteer to render the page before parsing. ~2-3× the per-request CPU cost.
**Engineering cost:** +1 day per new site type to wire the rendering wrapper.
**Examples:**
- LA County Assessor (parts of the site)
- Some California county recorders that moved to modern web stacks
- A growing number of newer county sites built in the last ~3 years
**Mitigation in our infra:** Add `lib/scrapers/base/browser-client.ts` that mirrors `politeFetch` but uses Playwright. Set `needsPlaywright: true` on the `CountyScraper` row.

### Tier 3 — Captcha-gated (~10%)
**What it looks like:** Cloudflare challenge, reCAPTCHA, hCaptcha, or custom captcha on search submission.
**What it takes:** Captcha solver service. Cheap and reliable: 2Captcha (~$2 per 1,000 solves), AntiCaptcha, CapSolver.
**Engineering cost:** +1-2 days to wire the solver hook.
**Examples:**
- NYC ACRIS (NYC Department of Finance) — reCAPTCHA on advanced searches
- Some county recorder sites with bot-detection
- A few state-level lien databases
**Mitigation:** Add `lib/scrapers/base/captcha-solver.ts` with pluggable provider. Per-scraper opt-in (`needsCaptcha: true`).
**Cost impact:** Negligible — at our volume this is ~$10-30/mo total even across multiple Tier 3 counties.

### Tier 4 — Free account required (~5%)
**What it looks like:** Free registration to access search. No payment, but you must have a logged-in session.
**What it takes:** Auto-register a service account, store session cookie, refresh on expiry.
**Engineering cost:** +1-2 days per county (each has a different registration flow).
**Examples:**
- Some Pennsylvania counties (Allegheny PA among others)
- New York State Court Electronic Filing System (NYSCEF) — for foreclosure court filings
- Some Texas county subscription portals run by BIS Consultants
**Mitigation:** `sessionCookie` field on `CountyScraper` row holds the encrypted token. Auto-refresh job catches 401s and re-authenticates.
**Risk:** Once we register, we're contractually bound by their TOS. If our scraper detection is bad, they may revoke our account. Operationally annoying, not legally fatal.

### Tier 5 — Paid subscription required (~3-5%)
**What it looks like:** Pay a per-search fee or monthly subscription to access. No public free search.
**What it takes:** Sign up for the subscription, pass the cost through to FlipOps users who care about that market.
**Engineering cost:** Same as Tier 4 plus accounting for the subscription expense.
**Examples per estimate:**
- Some smaller California counties — $25-100/mo
- BIS Consultants subscription portals (used by some Texas counties) — $50-200/mo
- PACER (federal court records — needed for federal tax liens + bankruptcy) — $0.10/page, account-based, ~$50/mo at our volume
- DataTree (FNF) for mechanics lien feeds in select states — $200/mo+
**Cost impact tracking:** We populate `monthlyCostUsd` on the `CountyScraper` row so the ops dashboard knows total subscription burden.
**Decision rule:** If a Tier 5 county costs > $200/mo and has < 10 active users in that market, we don't onboard it. Pass through to BatchData PAYG instead.

### Tier 6 — Bulk-license-only (rare, <1%)
**What it looks like:** No public search at all. The county only sells records as a bulk data file (one-time or annual purchase).
**What it takes:** Buy the bulk feed, ingest periodically.
**Cost:** $1k-10k/year depending on county size.
**Examples:** A few rural counties; some old-school recorder offices.
**Decision rule:** Skip for beta. Revisit only if a meaningful user base wants that specific market.

---

## County-platform-specific notes

These are the platforms we'll likely encounter most often, what tier they typically fall into, and what to expect:

### Tyler Technologies iasWorld (~400 counties, mostly Tier 1)
- **Coverage:** Property assessment, tax bills, sale history
- **URL pattern:** `*Datalets.aspx*`, `*KeyValue=*`, `/Parcel/{id}`
- **Access:** Almost universally Tier 1 (no login). Some counties have enabled bot detection — drops to Tier 3.
- **Status:** Our reference parser already handles this.

### Patriot Properties (~150 counties, mostly Tier 1)
- **Coverage:** Property records, valuations
- **URL pattern:** `*patriotproperties.com*`, varies
- **Access:** Almost all Tier 1.
- **Status:** TODO — write parser when we onboard a Patriot-using county. Pattern is similar to iasWorld.

### Vision Government Solutions (~80 counties, Tier 1-2)
- **Coverage:** Mostly Northeast US assessment data
- **URL pattern:** `*visgov.com*`
- **Access:** Some of their newer sites are JS-rendered (Tier 2).
- **Status:** TODO.

### Manatron / Thomson Reuters (~200 counties, Tier 1-2)
- **Coverage:** Tax assessment, bills
- **Access:** Older sites are Tier 1 HTML; newer ones Tier 2 JS.
- **Status:** TODO.

### Tyler Odyssey (court records — many states)
- **Coverage:** Court filings including foreclosure NOD/NOTS, evictions
- **Access:** Varies wildly by jurisdiction. Some counties offer free public access portals (Tier 1-2). Many require attorney-of-record login or paid subscription (Tier 4-5).
- **Status:** Phase 3 — handled per court system, not per county.

### NYC ACRIS (just NYC, but huge)
- **Coverage:** All NYC deeds, mortgages, liens
- **Access:** Free public search but reCAPTCHA on advanced queries (Tier 3). Bulk download requires arrangement with NYC DOF.
- **Status:** Important target — NYC alone has ~3M parcels.

### PACER (federal courts, all states)
- **Coverage:** Federal tax liens, bankruptcies, federal foreclosure cases
- **Access:** Tier 5 — $0.10/page, account-based with quarterly fee waiver under $30
- **Cost at our volume:** ~$30-50/mo
- **Status:** Enable when we add bankruptcy/federal-lien category in Phase 3.

### MERS (Mortgage Electronic Registration Systems)
- **Coverage:** Active mortgage servicer lookup for ~70% of US mortgages
- **Access:** Free public lookup with captcha (Tier 3). Bulk access requires MERS contract.
- **Status:** Useful supplement; not primary data source.

---

## Operational math at each tier mix

Assume FlipOps onboards 50 counties total covering 60% of US population (a reasonable Year-1 footprint). Likely tier distribution at that scale:

| Tier | Estimated % of 50 counties | Eng effort each | Recurring cost each |
|---|---|---|---|
| 1 (open) | ~30 (60%) | hours | $0 |
| 2 (JS-rendered) | ~10 (20%) | 1 day setup, then hours | $0 |
| 3 (captcha) | ~5 (10%) | 1-2 days first time, then hours | <$10/mo combined |
| 4 (login) | ~3 (6%) | 1-2 days each | $0 |
| 5 (paid sub) | ~2 (4%) | 1 day plus subscription | $50-200/mo each = $100-400/mo total |

**Total Year-1 recurring cost at 50 counties: ~$100-450/mo** for subscription-tier counties + ~$200/mo proxy infra + occasional captcha solving = **roughly $300-700/mo of ops cost** at Year-1 scale.

Compare to BatchData PAYG: ~$54k-108k/year for the same coverage at user-realistic volumes. Scrapers + selective subscriptions stays under $10k/year.

---

## How we onboard a new county

This becomes the standard playbook:

1. **Identify the platform.** Look at the URL of the county's public property search.
   - `*Datalets.aspx*` → iasWorld → Tier 1, copy our reference scraper
   - `*patriotproperties.com*` → Patriot → Tier 1 (parser TODO)
   - SPA / blank HTML response → Tier 2, needs Playwright
   - Login wall → Tier 4, register service account
   - Paywall → Tier 5, evaluate subscription cost vs market value
2. **Tier the county** in `CountyScraper.accessTier` and set the appropriate flags.
3. **Wire the scraper.** For iasWorld counties, copy `lib/scrapers/counties/fl-duval.ts`. For new vendors, write a new vendor parser first.
4. **Test via `POST /api/scrapers/test`.**
5. **Schedule via cron** when validated.

For Tier 3-5 counties:
- Tier 3: enable `needsCaptcha: true` and pre-fund 2Captcha account
- Tier 4: register service account, store cookie, set `needsLogin: true`
- Tier 5: spin up subscription, set `monthlyCostUsd`, ensure billing accounting

---

## What gets skipped at beta

Counties that fall into Tier 5 with monthly cost > $200 AND have low projected user demand are deferred. We pass-through to BatchData PAYG for those few cases — that's fine because BatchData is also our fallback for any market we haven't scraped yet.

The rule: **scraper economics must beat $0.30/call BatchData at the user's expected query volume in that market.** If a county subscription costs $200/mo and we only have 3 users searching it ~50 times per month each, that's $200 vs $45 BatchData — BatchData wins. We delay onboarding that county until we have 14+ active users in the market.

---

## TL;DR

- **~60-70% of counties are pure-public scrapeable** (Tier 1-2)
- **~25-30% need workarounds** (proxy rotation, headless browser, captcha solving, account registration) — solvable, modest engineering cost
- **~3-5% require paid subscriptions** that we factor into per-county economics — accept some, skip others
- **~1% are bulk-license-only** — skip for beta, revisit if material
- Even with subscriptions for a handful of counties, total Year-1 ops cost stays at a small fraction of equivalent BatchData PAYG spend
- Architecture supports all six tiers via the `accessTier` field + per-tier mitigation hooks
