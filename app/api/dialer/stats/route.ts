// ---------------------------------------------------------------------------
// /api/dialer/stats — Oppenheimer + Flip Phone today/week/month aggregates.
//
// Currently aggregates against BulkIngestJob rows where sourceTag starts with
// `dialer-dispatch:` (audit trail written by the dialer-dispatch worker).
// This is a v0 surface: once we have a first-class CallLog table populated by
// Telnyx webhook callbacks, this route swaps the data source over without
// changing the response shape.
//
// Query params:
//   period = today (default) | week | month
//
// Response shape (must match TodayStats in components/dialer/oppenheimer.tsx):
//   { stats: { inboundHandled, callbacksCompleted, apptsBooked, afterHoursSaves } }
//
// All four counters are best-effort estimates from the audit log until the
// Telnyx webhook table lands. Returning zeros is fine; the panel renders
// cleanly with 0s.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

function periodWindow(period: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (period === "week") {
    from.setDate(to.getDate() - 7);
  } else if (period === "month") {
    from.setDate(to.getDate() - 30);
  } else {
    // "today" — start of local day
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

export async function GET(req: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "today";
  const { from, to } = periodWindow(period);

  // Pull every dispatch-audit row in the window. Volume is low at v0
  // (single-digit-per-minute peak) so we can do this client-side. Once we
  // outgrow that, push the aggregations down into GROUP BY SQL.
  // BulkIngestJob has no createdAt column — startedAt is the row timestamp.
  let rows: Array<{ sourceTag: string; status: string; startedAt: Date }> = [];
  try {
    rows = await prisma.bulkIngestJob.findMany({
      where: {
        sourceTag: { startsWith: "dialer-dispatch:" },
        startedAt: { gte: from, lte: to },
      },
      select: { sourceTag: true, status: true, startedAt: true },
      take: 5000,
    });
  } catch (err) {
    console.warn(
      `[dialer-stats] aggregation failed, returning zeros: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  let inboundHandled = 0;
  let callbacksCompleted = 0;
  let apptsBooked = 0;
  let afterHoursSaves = 0;

  for (const row of rows) {
    // sourceTag shape: "dialer-dispatch:<jobType>[:correlationId]"
    const jobType = row.sourceTag.split(":")[1];
    if (row.status === "tcpa-deferred") {
      afterHoursSaves += 1;
      continue;
    }
    if (row.status !== "dispatched") continue;
    // For v0 we treat SMS as "callbacks completed" (outbound text-back), and
    // voicemail drops as inbound-handled proxies. This is intentionally
    // rough — replaced by the real CallLog once webhook tables land.
    if (jobType === "sms") callbacksCompleted += 1;
    else if (jobType === "voicemail") inboundHandled += 1;
    else if (jobType === "voice") apptsBooked += 1;
  }

  return NextResponse.json({
    period,
    window: { from: from.toISOString(), to: to.toISOString() },
    stats: {
      inboundHandled,
      callbacksCompleted,
      apptsBooked,
      afterHoursSaves,
    },
  });
}
