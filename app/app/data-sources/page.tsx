"use client";

// ---------------------------------------------------------------------------
// Data Health & Coverage — the crown-jewel demo surface (roadmap M1.7).
//
// Replaces the old 100%-hardcoded "Data Connectors" fiction with live numbers
// from GET /api/data-health: headline counts, a 67-county FL coverage grid,
// and per-source scraper cards backed by BulkIngestJob audit rows. An
// investor should grasp the data moat in 10 seconds.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { StatBand, StatBandSkeleton } from "@/components/data-health/stat-band";
import {
  CountyGrid,
  CountyGridSkeleton,
} from "@/components/data-health/county-grid";
import {
  SourceCards,
  SourceCardsSkeleton,
} from "@/components/data-health/source-cards";
import {
  formatRelativeTime,
  type DataHealthPayload,
} from "@/components/data-health/types";

export default function DataHealthPage() {
  const [data, setData] = useState<DataHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data-health");
      if (res.status === 401) {
        setError("Sign in to view live data health.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const payload = (await res.json()) as DataHealthPayload;
      setData(payload);
    } catch (err) {
      console.error("Failed to load data health:", err);
      setError("Could not load data health. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">
                Data Health &amp; Coverage
              </h1>
              {data && !loading && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">
              Live counts from the FlipOps property database — scraped directly
              from public county records
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {data && (
              <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">
                Updated {formatRelativeTime(data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw
                className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Headline stat band */}
      <div className="shrink-0 border-b px-6 py-3 bg-muted/30">
        {loading && !data ? (
          <StatBandSkeleton />
        ) : data ? (
          <StatBand headline={data.headline} />
        ) : (
          <StatBandSkeleton />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-6 py-5 space-y-8">
            {error && !data ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{error}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The data health endpoint aggregates live production tables.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* County coverage grid */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Florida county coverage
                    </h2>
                    {loading && !data ? (
                      <Skeleton className="h-3 w-64 mt-1" />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        All {data?.headline.flCountiesTotal ?? 67} counties on
                        the parcel roll — tile depth shows distress-signal
                        coverage
                      </p>
                    )}
                  </div>
                  {loading && !data ? (
                    <CountyGridSkeleton />
                  ) : data ? (
                    <CountyGrid counties={data.counties} />
                  ) : null}
                </section>

                {/* Per-source cards */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Data sources
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Every source is our own pipeline — freshness measured
                      against each scraper&apos;s expected cadence
                    </p>
                  </div>
                  {loading && !data ? (
                    <SourceCardsSkeleton />
                  ) : data ? (
                    <SourceCards sources={data.sources} />
                  ) : null}
                </section>

                {/* Honest provenance footer */}
                <footer className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      All data scraped from public county records — no
                      third-party data vendors.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      FlipOps owns its pipeline end to end: county assessment
                      rolls, clerk recordings, tax-delinquency rolls, and
                      foreclosure auction calendars, with run-by-run audit
                      receipts for every source above.
                    </p>
                  </div>
                </footer>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
