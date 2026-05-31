/* eslint-disable no-console */
/**
 * Probe — does floridapublicnotices.com's archived-notices POST endpoint
 * accept a date-window filter param, and if so, what's the exact key + format?
 *
 * Background:
 *   The Palm Beach tax-delinquent scraper at
 *   lib/scrapers/vendors/palm-beach-tax-delinquent.ts currently fetches
 *   ALL ~2,600 PCN-bearing notices every run and client-side filters to
 *   tax-deed applications. For an incremental-by-date daily run, we want
 *   the server to pre-filter by date.
 *
 *   The scraper file's doc comment speculates:
 *     "the API likely accepts dateFrom/dateTo"
 *   This probe disproves that and reveals the real key names.
 *
 * Method:
 *   Use the same hard-coded county "50" (Palm Beach) + keyword "PCN" the
 *   scraper uses. Post 6 candidate payload variants and compare totalCount:
 *     - baseline (no date) — expect ~2,600
 *     - the actual UI keys (`date-range--start-date` / `date-range--end-date`)
 *       with both ISO and US date formats
 *     - common naïve guesses (`dateFrom/dateTo`, `startDate/endDate`)
 *
 *   Server echoes the accepted query in the response under `.query`, so we
 *   can tell which keys it actually parsed.
 *
 * Findings as of 2026-05-30 (run inside browser context against live API,
 * results reproduced here for posterity):
 *
 *   | Payload variant                                          | totalCount | Filter applied? |
 *   |----------------------------------------------------------|-----------:|:----------------|
 *   | baseline                                                 |       2630 | — (no filter)   |
 *   | date-range--start-date / -end-date  (ISO YYYY-MM-DD)     |          1 | YES             |
 *   | date-range--start-date / -end-date  (MM/DD/YYYY)         |          0 | YES (zero match)|
 *   | dateFrom / dateTo                                        |       2630 | NO (ignored)    |
 *   | startDate / endDate                                      |       2630 | NO (ignored)    |
 *
 *   Verdict: server accepts `date-range--start-date` and
 *   `date-range--end-date` (kebab-case, DOUBLE hyphen) with ISO
 *   `YYYY-MM-DD` strings. US `MM/DD/YYYY` is accepted as a key but the
 *   server can't parse the value (returns 0). Other camelCase guesses are
 *   silently dropped.
 *
 *   The UI form ID prefix on those <input> elements is literally
 *   "mspn--Search-SearchBar--date-range-start-date" — the JSON key is the
 *   internal control-name minus that prefix.
 *
 *   Run this probe yourself with:
 *     npx tsx scripts/probe-fpn-date-params.ts
 */

const URL = "https://floridapublicnotices.com/search/archived-notices";

interface Variant {
  label: string;
  body: Record<string, unknown>;
}

interface ProbeResult {
  label: string;
  status?: number;
  totalCount?: number;
  firstDate?: string | null;
  firstId?: number | null;
  echoedQuery?: unknown;
  error?: string;
}

const VARIANTS: Variant[] = [
  {
    label: "baseline (no date) — same payload current scraper sends",
    body: { counties: ["50"], keywords: "PCN", offset: 0, limit: 50 },
  },
  {
    label: "REAL KEYS: date-range--start-date / -end-date  (ISO YYYY-MM-DD)",
    body: {
      counties: ["50"],
      keywords: "PCN",
      "date-range--start-date": "2026-04-01",
      "date-range--end-date": "2026-04-15",
      offset: 0,
      limit: 50,
    },
  },
  {
    label: "REAL KEYS narrow 1-day window  (ISO)",
    body: {
      counties: ["50"],
      keywords: "PCN",
      "date-range--start-date": "2026-04-01",
      "date-range--end-date": "2026-04-02",
      offset: 0,
      limit: 50,
    },
  },
  {
    label: "guess: dateFrom / dateTo (ISO)",
    body: {
      counties: ["50"],
      keywords: "PCN",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-15",
      offset: 0,
      limit: 50,
    },
  },
  {
    label: "guess: startDate / endDate (ISO)",
    body: {
      counties: ["50"],
      keywords: "PCN",
      startDate: "2026-04-01",
      endDate: "2026-04-15",
      offset: 0,
      limit: 50,
    },
  },
  {
    label: "REAL KEYS with MM/DD/YYYY date format (server can't parse)",
    body: {
      counties: ["50"],
      keywords: "PCN",
      "date-range--start-date": "04/01/2026",
      "date-range--end-date": "04/15/2026",
      offset: 0,
      limit: 50,
    },
  },
];

async function probe(v: Variant): Promise<ProbeResult> {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: "https://floridapublicnotices.com",
        Referer: "https://floridapublicnotices.com/search/archived-notices",
      },
      body: JSON.stringify(v.body),
    });
    const j = (await res.json()) as {
      totalCount?: number;
      _embedded?: { notices?: Array<{ id?: number; date?: string }> };
      query?: unknown;
    };
    return {
      label: v.label,
      status: res.status,
      totalCount: j.totalCount,
      firstDate: j._embedded?.notices?.[0]?.date ?? null,
      firstId: j._embedded?.notices?.[0]?.id ?? null,
      echoedQuery: j.query,
    };
  } catch (e) {
    return { label: v.label, error: (e as Error).message };
  }
}

async function main() {
  console.log("=== FPN date-window probe (Palm Beach county 50, keyword 'PCN') ===\n");
  console.log("URL:", URL, "\n");

  const results: ProbeResult[] = [];
  for (const v of VARIANTS) {
    process.stdout.write(`Trying: ${v.label} ... `);
    const r = await probe(v);
    if (r.error) {
      console.log(`ERROR: ${r.error}`);
    } else {
      console.log(`HTTP ${r.status} | totalCount=${r.totalCount} | firstDate=${r.firstDate}`);
    }
    results.push(r);
    // polite gap between probes
    await new Promise((f) => setTimeout(f, 800));
  }

  console.log("\n=== Summary ===");
  const baseline = results[0]?.totalCount ?? -1;
  for (const r of results) {
    const filtered = r.totalCount !== undefined && r.totalCount !== baseline;
    const verdict = filtered
      ? r.totalCount === 0
        ? "ACCEPTED key but date format rejected (0 results)"
        : "FILTER APPLIED"
      : "key IGNORED (matched baseline)";
    console.log(`  ${r.totalCount?.toString().padStart(5)}  ${verdict}  ${r.label}`);
  }

  console.log("\n=== Echoed queries (server tells us what it parsed) ===");
  for (const r of results) {
    console.log(`  ${r.label}\n    → ${JSON.stringify(r.echoedQuery)}`);
  }

  console.log(
    "\nConclusion: pass `date-range--start-date` and `date-range--end-date` " +
      "as ISO YYYY-MM-DD strings in the existing JSON POST body. The current " +
      "scraper's payload is otherwise correct.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
