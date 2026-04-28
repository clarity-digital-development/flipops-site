# Scraper Implementation Notes (Phase 2A)

**Status:** Infrastructure scaffolded; one reference county wired (FL-Duval). Other counties follow the same pattern.

**Why this exists:** Per [COTALITY-SUBSTITUTION-STRATEGY.md](./COTALITY-SUBSTITUTION-STRATEGY.md), BatchData PAYG at $0.30/call doesn't survive a map-first UX where users see hundreds of properties per viewport. We own the data going forward and use BatchData/ATTOM only as fallback for unscraped markets.

---

## Architecture

```
lib/scrapers/
  base/
    types.ts            # ScrapedProperty, ScrapeResult, ScraperConfig, etc.
    http-client.ts      # politeFetch with per-host rate limiting + retry
    county-scraper.ts   # abstract base — registry, audit log, persistence
  vendors/
    iasworld.ts         # Tyler Tech iasWorld parser (~400 counties)
    # patriot.ts        # Patriot Properties (~150 counties) — TODO
    # vision.ts         # Vision Government Solutions (~80) — TODO
    # manatron.ts       # Manatron (~200) — TODO
  counties/
    fl-duval.ts         # concrete county example (FIPS 12031)
    # fl-orange.ts      # add as users onboard markets
    # ...
lib/data-sources/
  index.ts              # facade: resolveField, refreshCounty, listScrapeableCounties
app/api/scrapers/test/
  route.ts              # admin endpoint to trigger a scrape manually
prisma/schema.prisma
  PropertyDataPoint     # per-field provenance
  CountyScraper         # registry of scrape-capable counties
  ScrapeJob             # audit log of scrape runs
```

## Three new Prisma models

After the schema changes are applied:

```bash
npm run prisma:generate
npm run prisma:migrate    # creates the migration; commit it
```

- **PropertyDataPoint** — every individual datum we know about a property, with source + freshness. Lets the UI show "Source: Duval Tax Office (scraped 2h ago)" badges and lets the data-sources facade choose freshest-available.
- **CountyScraper** — registry of counties we know how to scrape. Cron worker iterates this table.
- **ScrapeJob** — append-only audit log of every scrape attempt with status, duration, error message, records scraped/upserted.

## Adding a new county

1. **Identify the county's assessor platform.** Check the URL of their public property search:
   - `*Datalets.aspx*` → iasWorld (Tyler Tech) → extend `IasworldScraper`
   - `*Patriotproperties.com*` → extend `PatriotScraper` (TODO)
   - Custom site → extend `CountyScraper` directly and write the parser

2. **Copy `lib/scrapers/counties/fl-duval.ts`** and update:
   - FIPS code (the canonical 5-digit county identifier — e.g. `12031` for Duval FL)
   - State + county name
   - Endpoint URLs (search, parcel, tax bill, delinquency list)
   - `parserModule` (the import path)

3. **Override parsers if needed.** Most iasWorld counties stick close to the default so subclassing typically only requires the config above. If a county's HTML is unusual, override `parseParcelHtml()` or `parseDelinquencyRow()`.

4. **Register in the data-sources factory map** (`lib/data-sources/index.ts → SCRAPER_FACTORIES`):
   ```ts
   "12095": buildOrangeFlScraper,
   ```

5. **Test the scraper** via `POST /api/scrapers/test` with `{ countyFips, category }`.

6. **Schedule the cron** when ready (separate cron worker config; not yet wired).

## Politeness + legal posture

- `politeFetch` rate-limits per host (default 1.5s gap, configurable per county). One in-flight request per host at a time.
- User-Agent: `FlipOps-PublicRecordsBot/1.0 (+https://flipops.io/scraping; ops@flipops.io)` — public contact for county IT teams.
- Retry on transient failures (408/429/5xx) with exponential backoff capped at 16s.
- We do NOT bypass paywalls, login walls, captcha, or robots.txt disallows. Scraping is restricted to publicly accessible records.
- Legal basis: hiQ Labs v. LinkedIn (2022) + Van Buren v. United States (2021) — public records scraping is not a CFAA violation when done politely and without authentication bypass.

## What's NOT in this scaffold yet (intentionally)

These are deferred until the basic flow is validated with one real county:

- **Residential proxy rotation** (Bright Data / Smartproxy / Oxylabs). Hooks are in place via `proxyUrl` config but pass-through. Add when a county starts blocking us by IP.
- **PDF OCR** for recorder-filed documents (mechanics liens, HOA liens). Will add `tesseract.js` or AWS Textract pipeline in Phase 3.
- **Cron wiring** to refresh counties on schedule. The `lib/cron/` infrastructure already exists; need to add `lib/cron/scrape/` jobs that walk the `CountyScraper` registry.
- **Vendor parsers beyond iasWorld** (Patriot, Vision, Manatron). Each unlocks 80–200 counties at once.
- **UI provenance badges** on Leads page property detail (per-field source pill). Easy add once data starts flowing.
- **Settings → Data Sources admin view** showing scraper health, error rates, last refresh per county.

## Test the reference scraper

After running `prisma generate` + migrate:

```bash
# 1. Authenticated to /app — Clerk session active
# 2. POST to the test endpoint
curl -X POST http://localhost:3007/api/scrapers/test \
  -H "Content-Type: application/json" \
  --cookie "$(cat ~/.flipops-cookie)" \
  -d '{ "countyFips": "12031", "category": "tax_delinquency" }'

# Expected response: { ok: true, message: "Scraped N records...", recordsScraped: N }
# (N may be 0 on first run if Duval's URL pattern needs adjustment.)
```

## Realistic engineering effort to scale

| Milestone | Counties covered | Engineering effort | Cumulative time |
|---|---|---|---|
| Phase 2A (now) | 1 (FL-Duval) | Done | — |
| Phase 2B | iasWorld vendor parser tested across 10 counties | 1 week | 1 week |
| Phase 2C | Patriot + Vision + Manatron vendor parsers | 2-3 weeks | 4 weeks |
| Phase 3 | 50 most-requested counties active | 4-6 weeks | 10 weeks |
| Phase 4 | Foreclosure court records + lien PDF OCR | 4-6 weeks | 16 weeks |
| Phase 5 | 100 counties, ~60% US population | ongoing | — |

Most of the Phase 2 work is HTML adaptation per county, not architecture. The architecture lands today.

## What this saves us

At a target user base of 100 active investors in 5 markets:

| Year-1 data cost (BatchData PAYG) | Year-1 data cost (scrapers) |
|---|---|
| ~$54k–$108k (cost scales with usage) | ~$2,400 proxy infra + ~$200/mo vendor APIs for fallback ≈ $5k |

That's a 90%+ reduction. Per-user marginal data cost approaches zero, which is what makes the SaaS unit economics work.
