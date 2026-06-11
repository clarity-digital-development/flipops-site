import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// LANE B5 blast-radius probe (read-only): how many Foreclosure rows persisted
// by the realauction-xhr scraper carry a misattributed auctionDate due to the
// splash-time date-pinning bug (see .gstack/qa-reports/realauction-date-
// pinning-probe.md)?
//
// Pre-fix mechanics: every (county, track) run only ever fetched the RUN
// DAY's calendar (the jar was minted on the first iterated date = run day),
// then re-upserted the SAME rows once per iterated date, overwriting
// auctionDate each time (last-write-wins). So:
//   - TRUE auction date of a captured row = its capture run day.
//   - capturedAt is @default(now()) and NOT updated on upsert -> the first
//     capture day is preserved.
//   - Heuristic: auctionDate::date != capturedAt::date  =>  misattributed.
//     auctionDate::date == capturedAt::date             =>  correct stamp
//     (run cut early, errors, or single-date runs).
// ---------------------------------------------------------------------------

async function main() {
  const q = async <T>(sql: string): Promise<T[]> => prisma.$queryRawUnsafe<T[]>(sql);

  const totals = await q<{ track: string; n: number; with_date: number; misattributed: number }>(`
    SELECT
      CASE WHEN source LIKE '%-foreclosure' THEN 'foreclosure'
           WHEN source LIKE '%-tax-deed'    THEN 'tax-deed'
           ELSE 'other' END AS track,
      COUNT(*)::int AS n,
      COUNT("auctionDate")::int AS with_date,
      COUNT(*) FILTER (
        WHERE "auctionDate" IS NOT NULL
          AND "auctionDate"::date <> "capturedAt"::date
      )::int AS misattributed
    FROM flipops."Foreclosure"
    WHERE source LIKE 'scraper:realauction-xhr-%'
    GROUP BY 1 ORDER BY 1`);
  console.log("Foreclosure rows, source LIKE 'scraper:realauction-xhr-%':");
  for (const r of totals) {
    console.log(`  ${r.track.padEnd(12)} n=${r.n} with_auctionDate=${r.with_date} misattributed(auctionDate!=capturedAt day)=${r.misattributed}`);
  }

  const lag = await q<{ lag_days: number; n: number }>(`
    SELECT ("auctionDate"::date - "capturedAt"::date)::int AS lag_days, COUNT(*)::int AS n
    FROM flipops."Foreclosure"
    WHERE source LIKE 'scraper:realauction-xhr-%' AND "auctionDate" IS NOT NULL
    GROUP BY 1 ORDER BY 1`);
  console.log("\nLag distribution (auctionDate day - capturedAt day):");
  for (const r of lag) console.log(`  lag=${String(r.lag_days).padStart(3)}d  n=${r.n}`);

  const byStage = await q<{ stageCode: string; n: number; future_n: number }>(`
    SELECT "stageCode", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE "auctionDate" > NOW())::int AS future_n
    FROM flipops."Foreclosure"
    WHERE source LIKE 'scraper:realauction-xhr-%' AND "auctionDate" IS NOT NULL
    GROUP BY 1 ORDER BY 1`);
  console.log("\nBy stageCode (rows with auctionDate):");
  for (const r of byStage) console.log(`  ${r.stageCode.padEnd(10)} n=${r.n} future=${r.future_n}`);

  // AuctionSummary downstream exposure: summaries whose nextAuctionDate could
  // only have come from misattributed realauction-xhr foreclosure rows.
  const summary = await q<{ n: number }>(`
    SELECT COUNT(*)::int AS n FROM flipops."AuctionSummary" WHERE "nextAuctionDate" IS NOT NULL`);
  console.log(`\nAuctionSummary rows with nextAuctionDate set (downstream of these stamps): ${summary[0]?.n}`);

  // Lien rows (tax-lien track) — recordingDate is only set at CREATE (first
  // iteration = run day = splash date = correct) and never overwritten, so
  // they should be unaffected. Verify:
  const liens = await q<{ n: number; mis: number }>(`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE "recordingDate"::date <> "capturedAt"::date)::int AS mis
    FROM flipops."Lien"
    WHERE source LIKE 'scraper:realauction-xhr-%'`);
  console.log(`Lien rows (tax-lien track): n=${liens[0]?.n} recordingDate!=capturedAt-day=${liens[0]?.mis} (expected 0 — create-only stamp)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
