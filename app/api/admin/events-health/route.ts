import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/events-health
// LeadEvents/day health stat (M1.1 step 5) — a zero-event week must never go
// unnoticed again. Cheap: three indexed counts + one 7-day GROUP BY over the
// occurredAt index. Admin-only.
//
// Response:
//   {
//     today: number,
//     last7Days: { total, anonymous, byDay: [{ day, count, anonymous }] },
//     healthy: boolean   // false when zero events in the last 7 days
//   }
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [todayCount, last7Total, last7Anonymous, byDay] = await Promise.all([
      prisma.leadEvent.count({ where: { occurredAt: { gte: startOfTodayUtc } } }),
      prisma.leadEvent.count({ where: { occurredAt: { gte: sevenDaysAgo } } }),
      prisma.leadEvent.count({
        where: { occurredAt: { gte: sevenDaysAgo }, userId: null },
      }),
      // Per-day buckets need date_trunc — not expressible in Prisma groupBy.
      // Raw SQL must schema-qualify (namespace 'flipops'); ::int casts avoid
      // BigInt JSON-serialization issues.
      prisma.$queryRaw<Array<{ day: Date; count: number; anonymous: number }>>`
        SELECT date_trunc('day', "occurredAt")                    AS day,
               COUNT(*)::int                                       AS count,
               COUNT(*) FILTER (WHERE "userId" IS NULL)::int       AS anonymous
        FROM flipops."LeadEvent"
        WHERE "occurredAt" >= NOW() - INTERVAL '7 days'
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    ]);

    return NextResponse.json({
      today: todayCount,
      last7Days: {
        total: last7Total,
        anonymous: last7Anonymous,
        byDay: byDay.map((r) => ({
          day: new Date(r.day).toISOString().slice(0, 10),
          count: r.count,
          anonymous: r.anonymous,
        })),
      },
      healthy: last7Total > 0,
    });
  } catch (error) {
    console.error("[admin/events-health] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
