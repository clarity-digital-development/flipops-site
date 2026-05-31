"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

// ---------------------------------------------------------------------------
// /app/admin/queues — BullMQ queue inspector for worker-bullmq.
//
// Native Next.js substitute for @bull-board (which expects Express middleware
// that doesn't fit App Router cleanly). Shows job counts per state for every
// queue plus the 10 most recent failed jobs per queue, with retry/remove
// actions.
// ---------------------------------------------------------------------------

interface JobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  "waiting-children"?: number;
}

interface FailedJob {
  id: string | null;
  name: string;
  data: unknown;
  attemptsMade: number;
  failedReason: string | null;
  finishedOn: number | null;
  processedOn: number | null;
  timestamp: number;
  stacktrace: string[];
}

interface QueueData {
  name: string;
  counts: JobCounts;
  failed: FailedJob[];
}

interface ApiResponse {
  queues: QueueData[];
}

export default function QueuesAdminPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/queues", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          toast({ title: "Forbidden", description: "Admin only.", variant: "destructive" });
        } else {
          toast({ title: "Failed to load queues", description: `HTTP ${res.status}`, variant: "destructive" });
        }
        return;
      }
      setData(await res.json());
    } catch (err) {
      toast({ title: "Failed to load queues", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
    const t = setInterval(() => void fetchData(), 15_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const toggleExpand = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };

  const jobAction = async (queueName: string, jobId: string, action: "retry" | "remove") => {
    setActing(`${queueName}:${jobId}:${action}`);
    try {
      const res = await fetch(
        `/api/admin/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}/${action}`,
        { method: "POST" },
      );
      const j = await res.json();
      if (!res.ok) {
        toast({ title: `${action} failed`, description: j.error ?? "Unknown error", variant: "destructive" });
      } else {
        toast({ title: `${action} ok`, description: `${queueName}#${jobId}` });
        void fetchData();
      }
    } catch (err) {
      toast({ title: `${action} failed`, description: String(err), variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const totalCounts = aggregateCounts(data?.queues ?? []);

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto p-2">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Queues</h1>
          <p className="text-sm text-muted-foreground">BullMQ queue inspector. Auto-refresh every 15s.</p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-muted"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Waiting" value={totalCounts.waiting} />
        <StatCard label="Active" value={totalCounts.active} accent={totalCounts.active > 0 ? "emerald" : undefined} />
        <StatCard label="Completed" value={totalCounts.completed} />
        <StatCard label="Failed" value={totalCounts.failed} accent={totalCounts.failed > 0 ? "rose" : undefined} />
        <StatCard label="Delayed" value={totalCounts.delayed} />
        <StatCard label="Paused" value={totalCounts.paused} />
      </section>

      <section className="space-y-3">
        {(data?.queues ?? []).map((q) => {
          const totals = (
            q.counts.waiting +
            q.counts.active +
            q.counts.completed +
            q.counts.failed +
            q.counts.delayed +
            q.counts.paused
          );
          const hasFailures = q.counts.failed > 0;
          const isExpanded = expanded.has(q.name);
          return (
            <div key={q.name} className="border rounded-lg bg-card overflow-hidden">
              <div
                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 ${hasFailures ? "border-l-4 border-l-rose-500" : ""}`}
                onClick={() => toggleExpand(q.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{q.name}</span>
                  {hasFailures && <Badge color="rose">{q.counts.failed} failed</Badge>}
                  {q.counts.active > 0 && <Badge color="emerald">{q.counts.active} active</Badge>}
                  {q.counts.waiting > 0 && <Badge color="amber">{q.counts.waiting} waiting</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span><strong className="text-foreground tabular-nums">{q.counts.completed}</strong> done</span>
                  <span><strong className="text-foreground tabular-nums">{totals}</strong> total</span>
                  <span className="text-lg">{isExpanded ? "▾" : "▸"}</span>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t bg-muted/10 p-4 space-y-3">
                  <CountsTable counts={q.counts} />
                  {q.failed.length > 0 ? (
                    <div>
                      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        Recent failed jobs ({q.failed.length}{q.counts.failed > q.failed.length ? ` of ${q.counts.failed}` : ""})
                      </h3>
                      <div className="space-y-2">
                        {q.failed.map((f) => (
                          <FailedJobCard
                            key={f.id ?? `${f.timestamp}`}
                            queueName={q.name}
                            job={f}
                            onAction={(action) => void jobAction(q.name, f.id ?? "", action)}
                            acting={acting}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No failed jobs.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {data?.queues.length === 0 && (
          <div className="text-center text-muted-foreground py-8">No queues found.</div>
        )}
      </section>
    </div>
  );
}

function aggregateCounts(queues: QueueData[]): JobCounts {
  return queues.reduce(
    (acc, q) => ({
      waiting: acc.waiting + q.counts.waiting,
      active: acc.active + q.counts.active,
      completed: acc.completed + q.counts.completed,
      failed: acc.failed + q.counts.failed,
      delayed: acc.delayed + q.counts.delayed,
      paused: acc.paused + q.counts.paused,
    }),
    { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "rose" }) {
  const colorClass =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "rose"  ? "text-rose-600 dark:text-rose-400"
    : "text-foreground";
  return (
    <div className="border rounded-md bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${colorClass}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function CountsTable({ counts }: { counts: JobCounts }) {
  const rows = [
    ["waiting", counts.waiting],
    ["active", counts.active],
    ["completed", counts.completed],
    ["failed", counts.failed],
    ["delayed", counts.delayed],
    ["paused", counts.paused],
  ] as const;
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded border bg-card p-2">
          <div className="text-muted-foreground capitalize">{k}</div>
          <div className="text-base font-medium tabular-nums">{v.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function FailedJobCard({
  queueName: _queueName,
  job,
  onAction,
  acting,
}: {
  queueName: string;
  job: FailedJob;
  onAction: (action: "retry" | "remove") => void;
  acting: string | null;
}) {
  const isRetrying = acting?.endsWith(`:${job.id}:retry`);
  const isRemoving = acting?.endsWith(`:${job.id}:remove`);
  const failedAt = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "—";
  const dataStr = (() => {
    try { return JSON.stringify(job.data, null, 0).slice(0, 200); }
    catch { return String(job.data ?? ""); }
  })();
  return (
    <div className="rounded border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-xs">
          <span className="font-semibold">{job.name}</span>
          <span className="text-muted-foreground ml-2">#{job.id ?? "?"}</span>
          <span className="text-muted-foreground ml-2">attempt {job.attemptsMade}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onAction("retry")}
            disabled={isRetrying || !job.id}
            className="px-2 py-0.5 text-xs rounded border bg-card hover:bg-muted disabled:opacity-50"
          >
            {isRetrying ? "…" : "Retry"}
          </button>
          <button
            onClick={() => onAction("remove")}
            disabled={isRemoving || !job.id}
            className="px-2 py-0.5 text-xs rounded border bg-card hover:bg-muted text-rose-600 disabled:opacity-50"
          >
            {isRemoving ? "…" : "Remove"}
          </button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{failedAt}</div>
      <div className="text-xs font-mono text-rose-600 whitespace-pre-wrap break-words">
        {job.failedReason ?? "(no reason)"}
      </div>
      {dataStr && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">data</summary>
          <pre className="mt-1 p-2 bg-muted/30 rounded overflow-x-auto">{dataStr}</pre>
        </details>
      )}
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
