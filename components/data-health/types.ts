// ---------------------------------------------------------------------------
// Client-side types + formatters for the Data Health & Coverage page.
// Mirrors the payload shape of GET /api/data-health (app/api/data-health/
// route.ts). Kept separate so client components never import the route file
// (which pulls in prisma).
// ---------------------------------------------------------------------------

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

// --- Formatters --------------------------------------------------------------

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0,
});

/** 10,998,035 → "11M"; 105,432 → "105K" */
export function formatCompact(n: number): string {
  return compactFormatter.format(n);
}

/** 681_234_567 → "$681M" */
export function formatMoneyCompact(n: number): string {
  return compactMoneyFormatter.format(n);
}

/** ISO timestamp → "2h ago" / "3d ago" / "just now". Null-safe. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
