/* eslint-disable no-console */
/**
 * Empirical probe: does APN normalization lift the Foreclosure -> Parcel
 * join rate from ~51% (strict match) into the 90%+ range?
 *
 * Approach:
 *   1) Pull every Foreclosure row tagged scraper:realauction-pw-* (these
 *      are the F2.2 RealAuction PW rows that the 199-row baseline came from).
 *   2) Per row, attempt three join strategies:
 *        S0  strict equality on (countyFips, apn)
 *        S1  normalize = APN.upper().replace(/[^A-Z0-9]/g, "")
 *        S2  S1 + strip leading zeros from each maximal numeric run
 *      For S1/S2 we build an in-memory map of normalized Parcel APN -> apn
 *      per county (cheap; ~ a few hundred K rows per metro).
 *   3) Aggregate: overall + per-county hit rates. Counties that don't improve
 *      get a hypothesis (different APN system on RA vs DOR, missing parcel
 *      catalog, etc.).
 */
import { prisma } from "@/lib/prisma";

const COUNTY_NAMES: Record<string, string> = {
  "12011": "Broward",
  "12031": "Duval",
  "12057": "Hillsborough",
  "12071": "Lee",
  "12083": "Marion",
  "12086": "Miami-Dade",
  "12095": "Orange",
  "12099": "Palm Beach",
  "12103": "Pinellas",
  "12115": "Sarasota",
  "12101": "Pasco",
  "12017": "Citrus",
  "12053": "Hernando",
  "12127": "Volusia",
  "12009": "Brevard",
  "12081": "Manatee",
};

function normAlphanum(apn: string): string {
  return apn.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normStripZeros(apn: string): string {
  const cleaned = normAlphanum(apn);
  // Strip leading zeros within each maximal digit run, preserving letters.
  return cleaned.replace(/\d+/g, (run) => {
    const s = run.replace(/^0+/, "");
    return s.length === 0 ? "0" : s;
  });
}

type CountyStat = {
  countyFips: string;
  county: string;
  total: number;
  strictHits: number;
  s1Hits: number;
  s2Hits: number;
};

async function main() {
  const foreclosures = await prisma.foreclosure.findMany({
    where: { source: { startsWith: "scraper:realauction-pw-" }, apn: { not: null } },
    select: { countyFips: true, apn: true, source: true },
  });

  console.log(`Pulled ${foreclosures.length} Foreclosure rows tagged scraper:realauction-pw-*`);

  // Group foreclosures by county so we only build parcel maps for counties
  // we actually need.
  const byCounty = new Map<string, { apn: string }[]>();
  for (const f of foreclosures) {
    if (!f.apn) continue;
    if (!byCounty.has(f.countyFips)) byCounty.set(f.countyFips, []);
    byCounty.get(f.countyFips)!.push({ apn: f.apn });
  }

  const stats: CountyStat[] = [];

  for (const [fips, rows] of byCounty.entries()) {
    const parcels = await prisma.parcel.findMany({
      where: { countyFips: fips },
      select: { apn: true },
    });
    const strictSet = new Set(parcels.map((p) => p.apn));
    const s1Set = new Set(parcels.map((p) => normAlphanum(p.apn)));
    const s2Set = new Set(parcels.map((p) => normStripZeros(p.apn)));

    let strictHits = 0;
    let s1Hits = 0;
    let s2Hits = 0;
    for (const r of rows) {
      if (strictSet.has(r.apn)) strictHits++;
      if (s1Set.has(normAlphanum(r.apn))) s1Hits++;
      if (s2Set.has(normStripZeros(r.apn))) s2Hits++;
    }

    stats.push({
      countyFips: fips,
      county: COUNTY_NAMES[fips] ?? `FIPS ${fips}`,
      total: rows.length,
      strictHits,
      s1Hits,
      s2Hits,
    });
  }

  // Sort by total descending so the biggest counties show first.
  stats.sort((a, b) => b.total - a.total);

  const total = stats.reduce((s, c) => s + c.total, 0);
  const strict = stats.reduce((s, c) => s + c.strictHits, 0);
  const s1 = stats.reduce((s, c) => s + c.s1Hits, 0);
  const s2 = stats.reduce((s, c) => s + c.s2Hits, 0);

  console.log("\n=== Overall ===");
  console.log(`Foreclosure rows: ${total}`);
  console.log(`Strict join:                ${strict}/${total} = ${pct(strict, total)}%`);
  console.log(`Normalize alphanum only:    ${s1}/${total} = ${pct(s1, total)}%`);
  console.log(`Normalize alphanum + zeros: ${s2}/${total} = ${pct(s2, total)}%`);

  console.log("\n=== Per-county ===");
  console.log(
    [
      "FIPS".padEnd(7),
      "County".padEnd(16),
      "Total".padStart(6),
      "Strict%".padStart(8),
      "S1%".padStart(7),
      "S2%".padStart(7),
      "Delta(S2-Strict)".padStart(18),
    ].join(" "),
  );
  for (const c of stats) {
    console.log(
      [
        c.countyFips.padEnd(7),
        c.county.padEnd(16),
        String(c.total).padStart(6),
        `${pct(c.strictHits, c.total)}%`.padStart(8),
        `${pct(c.s1Hits, c.total)}%`.padStart(7),
        `${pct(c.s2Hits, c.total)}%`.padStart(7),
        `+${(pct(c.s2Hits, c.total) - pct(c.strictHits, c.total)).toFixed(1)}pp`.padStart(18),
      ].join(" "),
    );
  }

  // Unfixable counties: still under 50% after best normalization.
  const unfixable = stats
    .filter((c) => c.total >= 3 && pct(c.s2Hits, c.total) < 50)
    .map((c) => ({
      countyFips: c.countyFips,
      county: c.county,
      total: c.total,
      bestPct: pct(c.s2Hits, c.total),
    }));

  console.log("\n=== Unfixable (>=3 rows, <50% after S2) ===");
  if (!unfixable.length) console.log("(none)");
  for (const u of unfixable) {
    // Sample one foreclosure APN and one parcel APN to compare formats.
    const fSample = await prisma.foreclosure.findFirst({
      where: { countyFips: u.countyFips, source: { startsWith: "scraper:realauction-pw-" }, apn: { not: null } },
      select: { apn: true },
    });
    const pSample = await prisma.parcel.findFirst({
      where: { countyFips: u.countyFips },
      select: { apn: true },
    });
    console.log(
      `${u.county} (${u.countyFips}) total=${u.total} bestPct=${u.bestPct}%  fc="${fSample?.apn}"  parcel="${pSample?.apn}"`,
    );
  }

  // Emit machine-readable JSON for the calling agent.
  const json = {
    scriptPath: "C:\\Users\\tanne\\flipopsLP\\flipops-site\\scripts\\probe-apn-normalize.ts",
    totalRows: total,
    strictJoinPct: pct(strict, total),
    normalize_alphanum_only_pct: pct(s1, total),
    normalize_alphanum_strip_zeros_pct: pct(s2, total),
    perCounty: stats.map((c) => ({
      countyFips: c.countyFips,
      county: c.county,
      total: c.total,
      strictPct: pct(c.strictHits, c.total),
      s1Pct: pct(c.s1Hits, c.total),
      s2Pct: pct(c.s2Hits, c.total),
    })),
    unfixable,
  };
  console.log("\n=== JSON ===");
  console.log(JSON.stringify(json));

  await prisma.$disconnect();
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
