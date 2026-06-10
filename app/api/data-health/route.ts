import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { FL_COUNTIES } from "@/lib/data-sources/bulk/fl-counties";

// ---------------------------------------------------------------------------
// GET /api/data-health
//
// User-facing aggregate for the Data Health & Coverage page (M1.7). Everything
// here is computed from real production tables — no hardcoded numbers:
//   - headline counts: Parcel, ParcelSale, TaxDelinquencySummary (+SUM owed),
//     Foreclosure, AuctionSummary (future-scheduled)
//   - per-county Parcel counts + which signal tables have rows per county
//   - per-source latest BulkIngestJob run + freshness vs expected cadence
//
// The Parcel table is ~11M rows, so results are cached in-memory for 10
// minutes per server instance. Read-only GET, no inputs to validate.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

export type FreshnessState = "fresh" | "stale" | "critical" | "static";
export type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "static";

export interface CountyHealth {
  fips: string;
  name: string;
  parcels: number;
  signals: {
    taxDelinquent: boolean;
    foreclosure: boolean;
  };
  signalCount: number; // 0 = parcels only, 1 = +1 signal, 2 = +2 signals
}

export interface SourceHealth {
  key: string;
  name: string;
  description: string;
  domain: string | null;
  countyName: string | null; // null = statewide
  cadence: Cadence;
  freshness: FreshnessState;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastRunRecords: number | null;
  totalRecords: number;
}

export interface DataHealthPayload {
  generatedAt: string;
  headline: {
    parcels: number;
    flCountiesCovered: number;
    flCountiesTotal: number;
    sales: number;
    taxDelinquentParcels: number;
    taxDelinquentOwed: number;
    foreclosureFilings: number;
    auctionsScheduled: number;
  };
  counties: CountyHealth[];
  sources: SourceHealth[];
}

// --- 10-minute in-memory cache (per server instance) -----------------------

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { payload: DataHealthPayload; expiresAt: number } | null = null;

// --- Source presentation metadata ------------------------------------------
// Display names + one-line descriptions for known ScrapeRegistry sourceKeys
// and legacy bulk sourceTags. Unknown keys fall back to a generic prettifier
// so newly-registered scrapers appear automatically.

const SOURCE_META: Record<string, { name: string; description: string }> = {
  "realauction-fl-foreclosures": {
    name: "RealAuction Foreclosure Auctions",
    description: "Live foreclosure auction calendar swept across 14 FL counties",
  },
  "duval-clerk-recordings": {
    name: "Duval Clerk Recordings",
    description: "Daily lis pendens and deed recordings from the Duval County clerk",
  },
  "duval-tax-delinquent": {
    name: "Duval Tax Delinquent",
    description: "Delinquent tax certificates from the Jacksonville Daily Record",
  },
  "miami-dade-tax-delinquent": {
    name: "Miami-Dade Tax Delinquent",
    description: "County tax-delinquency roll scraped from miamidade.gov",
  },
  "orange-tax-delinquent": {
    name: "Orange Tax Delinquent",
    description: "Delinquent tax certificates scraped from LienHub",
  },
  "broward-tax-delinquent": {
    name: "Broward Tax Delinquent",
    description: "Delinquent tax certificates scraped from LienHub",
  },
  "palm-beach-tax-delinquent": {
    name: "Palm Beach Tax Delinquent",
    description: "Delinquency notices from Florida Public Notices",
  },
  "hillsborough-tax-delinquent": {
    name: "Hillsborough Tax Delinquent",
    description: "County tax roll delinquencies from county-taxes.net",
  },
  "fl-dor-statewide-nal-sdf": {
    name: "FL DOR Statewide Roll Refresh",
    description: "Quarterly statewide assessment-roll + sales refresh (NAL + SDF)",
  },
};

const BULK_META: Record<string, { name: string; description: string }> = {
  "bulk:fl-dor-2025": {
    name: "FL DOR Parcel Roll (NAL 2025)",
    description: "Statewide assessment roll — every parcel in all 67 FL counties",
  },
  "bulk:fl-dor-sdf-2025": {
    name: "FL DOR Sales History (SDF 2025)",
    description: "Statewide sale-event history back to 2009",
  },
  "bulk:fl-fgio-geo-2025": {
    name: "FL Parcel Geometry (FGIO 2025)",
    description: "Statewide parcel coordinates from the Florida Geographic Information Office",
  },
};

function prettifyKey(key: string): string {
  return key
    .replace(/^(bulk|scraper):/, "")
    .split("-")
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// --- Cadence + freshness ----------------------------------------------------

/** Rough cron classification — enough to pick an expected-staleness window. */
function classifyCadence(cronExpr: string): Cadence {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return "daily";
  const [, , dayOfMonth, month, dayOfWeek] = parts;
  if (month !== "*") return "quarterly";
  if (dayOfMonth !== "*") return "monthly";
  if (dayOfWeek !== "*") return "weekly";
  return "daily";
}

/**
 * Freshness vs expected cadence. Spec: daily scrapers stale >36h amber,
 * >72h red. Weekly/monthly scale the same 1.5x/3x multipliers off their
 * interval. Quarterly bulk-vintage refreshes are always "static" — they are
 * point-in-time roll snapshots, not freshness-sensitive feeds.
 */
function classifyFreshness(cadence: Cadence, lastRunAt: Date | null): FreshnessState {
  if (cadence === "quarterly" || cadence === "static") return "static";
  if (!lastRunAt) return "critical";

  const hoursSince = (Date.now() - lastRunAt.getTime()) / 3_600_000;
  const thresholds: Record<string, { amber: number; red: number }> = {
    daily: { amber: 36, red: 72 },
    weekly: { amber: 252, red: 504 }, // 1.5x / 3x of 168h
    monthly: { amber: 1116, red: 2232 }, // 1.5x / 3x of ~31d
  };
  const t = thresholds[cadence] ?? thresholds.daily;
  if (hoursSince > t.red) return "critical";
  if (hoursSince > t.amber) return "stale";
  return "fresh";
}

// --- Payload assembly --------------------------------------------------------

async function buildPayload(): Promise<DataHealthPayload> {
  const [
    parcelsByCounty,
    saleCount,
    taxAgg,
    taxByCounty,
    foreclosureCount,
    fcByCounty,
    aucByCounty,
    auctionsScheduled,
    registry,
    latestRuns,
    totalsBySource,
    bulkRuns,
  ] = await Promise.all([
    prisma.$queryRaw<{ countyFips: string; n: bigint }[]>`
      SELECT "countyFips", COUNT(*)::bigint AS n
      FROM flipops."Parcel"
      GROUP BY "countyFips"`,
    prisma.parcelSale.count(),
    prisma.$queryRaw<[{ n: bigint; owed: number | null }]>`
      SELECT COUNT(*)::bigint AS n, COALESCE(SUM("totalAmount"), 0)::float AS owed
      FROM flipops."TaxDelinquencySummary"`,
    prisma.$queryRaw<{ countyFips: string; n: bigint }[]>`
      SELECT "countyFips", COUNT(*)::bigint AS n
      FROM flipops."TaxDelinquencySummary"
      GROUP BY "countyFips"`,
    prisma.foreclosure.count(),
    prisma.$queryRaw<{ countyFips: string; n: bigint }[]>`
      SELECT "countyFips", COUNT(*)::bigint AS n
      FROM flipops."Foreclosure"
      GROUP BY "countyFips"`,
    prisma.$queryRaw<{ countyFips: string; n: bigint }[]>`
      SELECT "countyFips", COUNT(*)::bigint AS n
      FROM flipops."AuctionSummary"
      GROUP BY "countyFips"`,
    prisma.auctionSummary.count({ where: { nextAuctionDate: { gt: new Date() } } }),
    prisma.scrapeRegistry.findMany({
      select: {
        sourceKey: true,
        domain: true,
        countyFips: true,
        cronExpr: true,
        enabled: true,
        lastRunAt: true,
      },
      orderBy: { sourceKey: "asc" },
    }),
    // Latest BulkIngestJob audit row per registered source.
    prisma.$queryRaw<
      { sourceKey: string; status: string; recordsFetched: number; startedAt: Date }[]
    >`
      SELECT DISTINCT ON ("sourceKey")
        "sourceKey", status, "recordsFetched", "startedAt"
      FROM flipops."BulkIngestJob"
      WHERE "sourceKey" IS NOT NULL
      ORDER BY "sourceKey", "startedAt" DESC`,
    prisma.$queryRaw<{ sourceKey: string; total: bigint }[]>`
      SELECT "sourceKey", COALESCE(SUM("recordsFetched"), 0)::bigint AS total
      FROM flipops."BulkIngestJob"
      WHERE "sourceKey" IS NOT NULL
      GROUP BY "sourceKey"`,
    // Legacy bulk-vintage ingests (sourceKey = NULL) grouped by sourceTag.
    prisma.$queryRaw<
      { sourceTag: string; lastRunAt: Date; lastStatus: string; lastRecords: number; total: bigint }[]
    >`
      SELECT
        "sourceTag",
        MAX("startedAt") AS "lastRunAt",
        (ARRAY_AGG(status ORDER BY "startedAt" DESC))[1] AS "lastStatus",
        (ARRAY_AGG("recordsFetched" ORDER BY "startedAt" DESC))[1] AS "lastRecords",
        COALESCE(SUM("recordsFetched"), 0)::bigint AS total
      FROM flipops."BulkIngestJob"
      WHERE "sourceKey" IS NULL
      GROUP BY "sourceTag"
      ORDER BY MAX("startedAt") DESC`,
  ]);

  // Per-county coverage. Signal families: tax-delinquency (TaxDelinquencySummary)
  // and foreclosure/auction (Foreclosure OR AuctionSummary rows).
  const parcelMap = new Map(parcelsByCounty.map((r) => [r.countyFips, Number(r.n)]));
  const taxSet = new Set(taxByCounty.filter((r) => Number(r.n) > 0).map((r) => r.countyFips));
  const fcSet = new Set(fcByCounty.filter((r) => Number(r.n) > 0).map((r) => r.countyFips));
  for (const r of aucByCounty) if (Number(r.n) > 0) fcSet.add(r.countyFips);

  const counties: CountyHealth[] = FL_COUNTIES.map((c) => {
    const taxDelinquent = taxSet.has(c.fips);
    const foreclosure = fcSet.has(c.fips);
    return {
      fips: c.fips,
      name: c.name,
      parcels: parcelMap.get(c.fips) ?? 0,
      signals: { taxDelinquent, foreclosure },
      signalCount: (taxDelinquent ? 1 : 0) + (foreclosure ? 1 : 0),
    };
  });

  const flFipsSet = new Set(FL_COUNTIES.map((c) => c.fips));
  const totalParcels = parcelsByCounty.reduce((sum, r) => sum + Number(r.n), 0);
  const flCountiesCovered = parcelsByCounty.filter(
    (r) => flFipsSet.has(r.countyFips) && Number(r.n) > 0
  ).length;

  // Per-source freshness cards.
  const latestBySource = new Map(latestRuns.map((r) => [r.sourceKey, r]));
  const totalBySource = new Map(totalsBySource.map((r) => [r.sourceKey, Number(r.total)]));
  const countyNameByFips = new Map(FL_COUNTIES.map((c) => [c.fips, c.name]));

  const scraperSources: SourceHealth[] = registry.map((reg) => {
    const meta = SOURCE_META[reg.sourceKey] ?? {
      name: prettifyKey(reg.sourceKey),
      description: `Scraped from ${reg.domain}`,
    };
    const latest = latestBySource.get(reg.sourceKey);
    // Registry lastRunAt is updated by the scheduler even when the audit-row
    // write is best-effort; trust the newest of the two timestamps.
    const lastRunAt =
      [reg.lastRunAt, latest?.startedAt]
        .filter((d): d is Date => d != null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const cadence = classifyCadence(reg.cronExpr);

    return {
      key: reg.sourceKey,
      name: meta.name,
      description: meta.description,
      domain: reg.domain,
      countyName: reg.countyFips ? (countyNameByFips.get(reg.countyFips) ?? null) : null,
      cadence,
      freshness: reg.enabled ? classifyFreshness(cadence, lastRunAt) : "static",
      enabled: reg.enabled,
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      lastStatus: latest?.status ?? null,
      lastRunRecords: latest ? Number(latest.recordsFetched) : null,
      totalRecords: totalBySource.get(reg.sourceKey) ?? 0,
    };
  });

  const bulkSources: SourceHealth[] = bulkRuns.map((b) => {
    const meta = BULK_META[b.sourceTag] ?? {
      name: prettifyKey(b.sourceTag),
      description: "One-time bulk ingest from public records",
    };
    return {
      key: b.sourceTag,
      name: meta.name,
      description: meta.description,
      domain: null,
      countyName: null,
      cadence: "static",
      freshness: "static",
      enabled: true,
      lastRunAt: b.lastRunAt ? new Date(b.lastRunAt).toISOString() : null,
      lastStatus: b.lastStatus ?? null,
      lastRunRecords: b.lastRecords != null ? Number(b.lastRecords) : null,
      totalRecords: Number(b.total),
    };
  });

  // Live scrapers first (freshness matters), bulk vintage snapshots after.
  const sources = [...scraperSources, ...bulkSources];

  return {
    generatedAt: new Date().toISOString(),
    headline: {
      parcels: totalParcels,
      flCountiesCovered,
      flCountiesTotal: FL_COUNTIES.length,
      sales: saleCount,
      taxDelinquentParcels: Number(taxAgg[0]?.n ?? 0),
      taxDelinquentOwed: Number(taxAgg[0]?.owed ?? 0),
      foreclosureFilings: foreclosureCount,
      auctionsScheduled,
    },
    counties,
    sources,
  };
}

export async function GET() {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;

    if (cache && cache.expiresAt > Date.now()) {
      return NextResponse.json(cache.payload, {
        headers: { "x-data-health-cache": "hit" },
      });
    }

    const payload = await buildPayload();
    cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload, {
      headers: { "x-data-health-cache": "miss" },
    });
  } catch (error) {
    console.error("[data-health] failed to build payload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
