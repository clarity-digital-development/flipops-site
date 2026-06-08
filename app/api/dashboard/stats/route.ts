import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-helpers';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for authenticated user
 */
export async function GET() {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // New leads in last 24 hours
    const newLeads24h = await prisma.property.count({
      where: {
        userId,
        createdAt: { gte: yesterday },
      },
    });

    // New leads in previous 24 hours (for comparison)
    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    const newLeadsPrevious24h = await prisma.property.count({
      where: {
        userId,
        createdAt: { gte: twoDaysAgo, lt: yesterday },
      },
    });

    // New leads in last 7 days
    const newLeads7d = await prisma.property.count({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // New leads in previous 7 days (for comparison)
    const newLeadsPrevious7d = await prisma.property.count({
      where: {
        userId,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    });

    // Properties contacted (last 7 days)
    const propertiesContacted = await prisma.property.count({
      where: {
        userId,
        lastContactDate: { gte: sevenDaysAgo },
      },
    });

    // Properties contacted (previous 7 days)
    const propertiesContactedPrevious = await prisma.property.count({
      where: {
        userId,
        lastContactDate: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    });

    // Properties skip traced (last 7 days)
    const propertiesSkipTraced = await prisma.property.count({
      where: {
        userId,
        enriched: true,
        updatedAt: { gte: sevenDaysAgo },
      },
    });

    // Properties skip traced (previous 7 days)
    const propertiesSkipTracedPrevious = await prisma.property.count({
      where: {
        userId,
        enriched: true,
        updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    });

    // Overdue tasks
    const tasksOverdue = await prisma.task.count({
      where: {
        userId,
        completed: false,
        dueDate: { lt: now },
      },
    });

    // Tasks completed today
    const tasksCompleted = await prisma.task.count({
      where: {
        userId,
        completed: true,
        completedAt: { gte: startOfToday },
      },
    });

    // ------------------------------------------------------------------
    // Period-over-period trends. Mirrors the Sprint 1 L2 pattern used in
    // /api/analytics: pctDelta(curr, prev) returns null when either side is
    // missing or prev=0 so the UI hides the trend pill instead of rendering
    // a fake "0% change" or Infinity.
    //
    // tasksCompleted gets a PoP signal by comparing today's completions to
    // yesterday's completions (counted between the two startOfDay markers).
    // tasksOverdue is a point-in-time snapshot, not a window, so its trend
    // is intentionally null — historical-overdue counts would require an
    // audit log we don't keep yet.
    // ------------------------------------------------------------------
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const tasksCompletedYesterday = await prisma.task.count({
      where: {
        userId,
        completed: true,
        completedAt: { gte: startOfYesterday, lt: startOfToday },
      },
    });

    const pctDelta = (curr: number | null, prev: number | null): number | null => {
      if (curr === null || prev === null) return null;
      if (prev === 0) return null;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    const trends = {
      newLeads24h: pctDelta(newLeads24h, newLeadsPrevious24h),
      newLeads7d: pctDelta(newLeads7d, newLeadsPrevious7d),
      propertiesContacted: pctDelta(propertiesContacted, propertiesContactedPrevious),
      propertiesSkipTraced: pctDelta(propertiesSkipTraced, propertiesSkipTracedPrevious),
      tasksCompleted: pctDelta(tasksCompleted, tasksCompletedYesterday),
      tasksOverdue: null, // point-in-time snapshot — no honest PoP available
    };

    return NextResponse.json({
      stats: {
        newLeads24h,
        newLeads7d,
        newLeadsPrevious24h,
        newLeadsPrevious7d,
        propertiesContacted,
        propertiesContactedPrevious,
        propertiesSkipTraced,
        propertiesSkipTracedPrevious,
        tasksOverdue,
        tasksCompleted,
      },
      trends,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
