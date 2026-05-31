"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

// ---------------------------------------------------------------------------
// /app/admin/scrapers — operational dashboard for the freshness layer.
//
// Lists every ScrapeRegistry row + the 5 most recent BulkIngestJob audit rows
// per source. Admin-only (server-side check in /api/admin/scrapers). Actions:
//   - Pause / Resume a scraper
//   - Trigger a one-shot run (enqueued on the source's domain queue)
//
// All state changes go through /api/admin/scrapers/[sourceKey]/{enable,disable,trigger}.
// Worker-bullmq's 60s registry sync picks up enable/disable changes.
// ---------------------------------------------------------------------------

interface RegistryRow {
  id: string;
  sourceKey: string;
  domain: string;
  countyFips: string | null;
  state: string | null;
  scraperFn: string;
  cronExpr: string;
  strategy: string;
  enabled: boolean;
  bootstrapping: boolean;
  legalRisk: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  lastHighWaterMark: string | null;
  lastRowCount: number | null;
  consecutiveFails: number;
  consecutiveP1Alerts: number;
  pausedReason: string | null;
}

interface RunRow {
  id: string;
  status: string;
  tier: string | null;
  recordsUpserted: number;
  rejectCount: number;
  http4xxCount: number;
  http5xxCount: number;
  cfChallengeCount: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

interface ApiResponse {
  registry: RegistryRow[];
  runs: Record<string, RunRow[]>;
}

export default function ScrapersAdminPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scrapers", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          toast({ title: "Forbidden", description: "Admin only.", variant: "destructive" });
        } else {
          toast({ title: "Failed to load scrapers", description: `HTTP ${res.status}`, variant: "destructive" });
        }
        return;
      }
      const j = (await res.json()) as ApiResponse;
      setData(j);
    } catch (err) {
      toast({ title: "Failed to load scrapers", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
    // Refresh every 30s
    const t = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const toggleExpand = (sourceKey: string) => {
    const next = new Set(expanded);
    if (next.has(sourceKey)) next.delete(sourceKey);
    else next.add(sourceKey);
    setExpanded(next);
  };

  const performAction = async (sourceKey: string, action: "enable" | "disable" | "trigger") => {
    setActing(`${sourceKey}:${action}`);
    try {
      const res = await fetch(`/api/admin/scrapers/${encodeURIComponent(sourceKey)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "disable" ? JSON.stringify({ reason: "manually paused via admin UI" }) : undefined,
      });
      const j = await res.json();
      if (!res.ok) {
        toast({ title: `${action} failed`, description: j.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      const desc =
        action === "trigger"
          ? `Job ${j.jobId} enqueued on ${j.queue}`
          : action === "enable"
            ? "Scraper re-enabled. Next tick within 60s."
            : "Scraper paused.";
      toast({ title: `${sourceKey}: ${action}`, description: desc });
      void fetchData();
    } catch (err) {
      toast({ title: `${action} failed`, description: String(err), variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const stats = computeStats(data?.registry ?? []);

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto p-2">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scrapers</h1>
          <p className="text-sm text-muted-foreground">
            ScrapeRegistry + recent BulkIngestJob runs. Auto-refresh every 30s.
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-muted"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Enabled" value={stats.enabled} accent="emerald" />
        <StatCard label="Paused" value={stats.paused} accent="rose" />
        <StatCard label="Bootstrapping" value={stats.bootstrapping} accent="amber" />
        <StatCard label="P1 fails (24h)" value={stats.recentFails} accent={stats.recentFails > 0 ? "rose" : undefined} />
      </section>

      <section className="border rounded-lg bg-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr className="text-left">
                <Th>Source</Th>
                <Th>Domain</Th>
                <Th>Status</Th>
                <Th>Last run</Th>
                <Th>Last success</Th>
                <Th>Last rows</Th>
                <Th>Fails</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.registry ?? []).map((row) => (
                <RegistryRowView
                  key={row.id}
                  row={row}
                  runs={data?.runs?.[row.sourceKey] ?? []}
                  expanded={expanded.has(row.sourceKey)}
                  onToggle={() => toggleExpand(row.sourceKey)}
                  onAction={(action) => void performAction(row.sourceKey, action)}
                  acting={acting}
                />
              ))}
              {data?.registry.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No scrapers in registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function computeStats(rows: RegistryRow[]) {
  const total = rows.length;
  const enabled = rows.filter((r) => r.enabled).length;
  const paused = rows.filter((r) => !r.enabled).length;
  const bootstrapping = rows.filter((r) => r.bootstrapping).length;
  const recentFails = rows.filter((r) => r.consecutiveFails > 0).length;
  return { total, enabled, paused, bootstrapping, recentFails };
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "rose" | "amber";
}) {
  const colorClass =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "rose"  ? "text-rose-600 dark:text-rose-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : "text-foreground";
  return (
    <div className="border rounded-md bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${colorClass}`}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function RegistryRowView({
  row,
  runs,
  expanded,
  onToggle,
  onAction,
  acting,
}: {
  row: RegistryRow;
  runs: RunRow[];
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: "enable" | "disable" | "trigger") => void;
  acting: string | null;
}) {
  const statusBadge = row.enabled
    ? row.bootstrapping
      ? <Badge color="amber">bootstrapping</Badge>
      : <Badge color="emerald">enabled</Badge>
    : <Badge color="rose">paused</Badge>;

  const triggerActing = acting === `${row.sourceKey}:trigger`;
  const enableActing  = acting === `${row.sourceKey}:enable`;
  const disableActing = acting === `${row.sourceKey}:disable`;

  return (
    <>
      <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={onToggle}>
        <Td>
          <div className="font-medium">{row.sourceKey}</div>
          <div className="text-xs text-muted-foreground font-mono">{row.cronExpr} · {row.strategy}</div>
        </Td>
        <Td>
          <div className="text-xs">{row.domain}</div>
          {row.countyFips && <div className="text-xs text-muted-foreground">FIPS {row.countyFips}</div>}
        </Td>
        <Td>
          {statusBadge}
          {row.consecutiveP1Alerts > 0 && (
            <div className="text-xs text-rose-600 mt-1">P1×{row.consecutiveP1Alerts}</div>
          )}
        </Td>
        <Td className="text-xs">{row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : "—"}</Td>
        <Td className="text-xs">{row.lastSuccessAt ? new Date(row.lastSuccessAt).toLocaleString() : "—"}</Td>
        <Td className="text-xs tabular-nums">{row.lastRowCount?.toLocaleString() ?? "—"}</Td>
        <Td className="text-xs">{row.consecutiveFails > 0 ? <span className="text-rose-600">{row.consecutiveFails}</span> : "—"}</Td>
        <Td className="text-xs whitespace-nowrap">
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {row.enabled ? (
              <button
                disabled={disableActing}
                onClick={() => onAction("disable")}
                className="px-2 py-1 text-xs rounded border bg-card hover:bg-muted disabled:opacity-50"
              >
                Pause
              </button>
            ) : (
              <button
                disabled={enableActing}
                onClick={() => onAction("enable")}
                className="px-2 py-1 text-xs rounded border bg-card hover:bg-muted disabled:opacity-50"
              >
                Resume
              </button>
            )}
            <button
              disabled={triggerActing}
              onClick={() => onAction("trigger")}
              className="px-2 py-1 text-xs rounded border bg-card hover:bg-muted disabled:opacity-50"
            >
              {triggerActing ? "…" : "Run now"}
            </button>
          </div>
        </Td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b">
          <td colSpan={8} className="p-4">
            <RowDetail row={row} runs={runs} />
          </td>
        </tr>
      )}
    </>
  );
}

function RowDetail({ row, runs }: { row: RegistryRow; runs: RunRow[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Function</div>
          <div className="font-mono">{row.scraperFn}</div>
        </div>
        <div>
          <div className="text-muted-foreground">High-water mark</div>
          <div className="font-mono">{row.lastHighWaterMark ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Legal risk</div>
          <div><Badge color={row.legalRisk === "yellow" ? "amber" : row.legalRisk === "red" ? "rose" : "emerald"}>{row.legalRisk}</Badge></div>
        </div>
        <div>
          <div className="text-muted-foreground">Last failure</div>
          <div className="text-rose-600">{row.lastFailureReason ?? "—"}</div>
        </div>
        {row.pausedReason && (
          <div className="md:col-span-2">
            <div className="text-muted-foreground">Paused reason</div>
            <div className="text-rose-600 font-mono text-[11px]">{row.pausedReason}</div>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recent runs</h3>
        {runs.length === 0 ? (
          <div className="text-xs text-muted-foreground">No audit rows yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <Th>Started</Th>
                <Th>Status</Th>
                <Th>Tier</Th>
                <Th>Rows</Th>
                <Th>Rejects</Th>
                <Th>4xx</Th>
                <Th>5xx</Th>
                <Th>CF</Th>
                <Th>Duration</Th>
                <Th>Error</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <Td className="text-xs">{new Date(r.startedAt).toLocaleString()}</Td>
                  <Td>
                    <Badge color={r.status === "succeeded" ? "emerald" : r.status === "failed" ? "rose" : "amber"}>{r.status}</Badge>
                  </Td>
                  <Td>{r.tier ? <Badge color={r.tier === "P1" ? "rose" : r.tier === "P2" ? "amber" : "emerald"}>{r.tier}</Badge> : "—"}</Td>
                  <Td className="tabular-nums">{r.recordsUpserted.toLocaleString()}</Td>
                  <Td className="tabular-nums">{r.rejectCount}</Td>
                  <Td className="tabular-nums">{r.http4xxCount}</Td>
                  <Td className="tabular-nums">{r.http5xxCount}</Td>
                  <Td className="tabular-nums">{r.cfChallengeCount}</Td>
                  <Td className="tabular-nums">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</Td>
                  <Td className="text-rose-600 max-w-[300px] truncate">{r.errorMessage ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "rose" | "amber" }) {
  const cls =
    color === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : color === "rose"  ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] rounded-md font-medium ${cls}`}>
      {children}
    </span>
  );
}
