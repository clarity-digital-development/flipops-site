"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  UserCheck,
  Hammer,
  Building2,
  BarChart3,
  PiggyBank,
  Percent,
  Bell,
  ChevronRight,
  Target,
  Zap,
  Calendar,
  Activity,
  User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getInvestorTypeDisplayName, type InvestorType } from "@/lib/navigation-config";

export const dynamic = 'force-dynamic';

// ============================================================================
// SEED DATA - Demo data for new users
// ============================================================================

const seedStats: DashboardStats = {
  newLeads24h: 12,
  newLeads7d: 47,
  newLeadsPrevious24h: 8,
  newLeadsPrevious7d: 32,
  propertiesContacted: 23,
  propertiesContactedPrevious: 18,
  propertiesSkipTraced: 35,
  propertiesSkipTracedPrevious: 28,
  tasksOverdue: 3,
  tasksCompleted: 7,
};

const seedHotLeads: HotLead[] = [
  {
    id: 'seed-1',
    address: '1234 Oak Street',
    city: 'Austin',
    state: 'TX',
    score: 92,
    dataSource: 'REI Skip',
    skipTraced: true,
    contacted: false,
    ownerName: 'Margaret Sullivan',
  },
  {
    id: 'seed-2',
    address: '567 Maple Avenue',
    city: 'Dallas',
    state: 'TX',
    score: 89,
    dataSource: 'PropStream',
    skipTraced: true,
    contacted: true,
    ownerName: 'James Rodriguez',
  },
  {
    id: 'seed-3',
    address: '890 Pine Road',
    city: 'Houston',
    state: 'TX',
    score: 87,
    dataSource: 'BatchLeads',
    skipTraced: false,
    contacted: false,
    ownerName: null,
  },
  {
    id: 'seed-4',
    address: '321 Cedar Lane',
    city: 'San Antonio',
    state: 'TX',
    score: 85,
    dataSource: 'REI Skip',
    skipTraced: true,
    contacted: false,
    ownerName: 'Patricia Chen',
  },
];

const seedActionItems: ActionItem[] = [
  {
    id: 'seed-action-1',
    type: 'first_contact',
    title: 'Make initial contact',
    description: '1234 Oak Street - High score, not contacted',
    propertyAddress: '1234 Oak Street',
  },
  {
    id: 'seed-action-2',
    type: 'follow_up',
    title: 'Follow up on offer',
    description: '567 Maple Avenue - Waiting for response',
    propertyAddress: '567 Maple Avenue',
  },
];

const seedOverdueTasks: OverdueTask[] = [
  {
    id: 'seed-overdue-1',
    title: 'Review comps for Oak Street property',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    priority: 'high',
    propertyAddress: '1234 Oak Street',
    overdueDays: 1,
  },
];

// Seed tasks for calendar widget
const seedCalendarTasks: CalendarTask[] = [
  {
    id: 'cal-1',
    title: 'Follow up with seller - 123 Oak St',
    dueDate: new Date().toISOString(),
    status: 'overdue',
    priority: 'urgent',
  },
  {
    id: 'cal-2',
    title: 'Schedule property inspection',
    dueDate: new Date().toISOString(),
    status: 'open',
    priority: 'high',
  },
  {
    id: 'cal-3',
    title: 'Review comps and finalize ARV',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    status: 'open',
    priority: 'normal',
  },
  {
    id: 'cal-4',
    title: 'Call back interested seller',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: 'open',
    priority: 'high',
  },
  {
    id: 'cal-5',
    title: 'Send purchase agreement',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    status: 'overdue',
    priority: 'urgent',
  },
  {
    id: 'cal-6',
    title: 'Submit title search request',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: 'open',
    priority: 'normal',
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  newLeads24h: number;
  newLeads7d: number;
  newLeadsPrevious24h: number;
  newLeadsPrevious7d: number;
  propertiesContacted: number;
  propertiesContactedPrevious: number;
  propertiesSkipTraced: number;
  propertiesSkipTracedPrevious: number;
  tasksOverdue: number;
  tasksCompleted: number;
}

interface HotLead {
  id: string;
  address: string;
  city: string;
  state: string;
  score: number;
  dataSource: string;
  skipTraced: boolean;
  contacted: boolean;
  ownerName: string | null;
}

interface ActionItem {
  id: string;
  type: 'first_contact' | 'follow_up' | 'overdue_task';
  title: string;
  description: string;
  propertyAddress?: string;
  dueDate?: string;
  priority?: string;
}

interface OverdueTask {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  propertyAddress?: string;
  overdueDays: number;
}

interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
}

interface InvestorStats {
  wholesaler?: {
    totalBuyers: number;
    activeAssignments: number;
    completedAssignments: number;
    totalRevenue: number;
    avgAssignmentFee: number;
  };
  flipper?: {
    totalRenovations: number;
    activeRenovations: number;
    completedRenovations: number;
    totalBudget: number;
    avgROI: number;
  };
  buyAndHold?: {
    totalRentals: number;
    leasedRentals: number;
    vacantRentals: number;
    totalMonthlyRent: number;
    totalMonthlyCashFlow: number;
    avgCapRate: number;
    occupancyRate: number;
  };
}

interface Notification {
  id: string;
  type: string;
  message: string;
  occurredAt: string;
  processed: boolean;
}

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================

function Sparkline({
  data,
  color = "currentColor",
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      />
    </svg>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function PipelineSkeletonFull() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4 h-32">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="w-full rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }} />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-100/50 dark:bg-zinc-800/50">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CalendarSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-2">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

interface KPICardProps {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  iconColor?: string;
  sparklineData?: number[];
  href?: string;
}

function KPICard({ label, value, change, trend, icon: Icon, iconColor = "text-muted-foreground", sparklineData, href }: KPICardProps) {
  const content = (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 group",
      href && "cursor-pointer hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5"
    )}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl",
            "bg-muted/50 dark:bg-zinc-800/50",
            "transition-colors group-hover:bg-primary/10"
          )}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend === "up" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
            trend === "down" && "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
            trend === "neutral" && "bg-gray-100 dark:bg-zinc-800 text-muted-foreground"
          )}>
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            <span>{change}</span>
          </div>
        </div>

        {/* Value */}
        <div className="mt-4">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <Sparkline
              data={sparklineData}
              color={trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280"}
              width={100}
              height={24}
            />
          </div>
        )}

        {/* Link indicator */}
        {href && (
          <div className="mt-3 flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
            <span>View details</span>
            <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ============================================================================
// PIPELINE FUNNEL (FULL WIDTH)
// ============================================================================

interface PipelineStage {
  name: string;
  count: number;
  color: string;
}

function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-medium">Deal Pipeline</CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {totalCount} total
            </Badge>
          </div>
          <Link href="/app/analytics">
            <Button variant="ghost" size="sm" className="text-xs">
              View Analytics <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bar segments */}
        <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4">
          {stages.map((stage) => (
            <div
              key={stage.name}
              className={cn("rounded-full transition-all duration-500", stage.color)}
              style={{ flex: Math.max(stage.count, 1) }}
            />
          ))}
        </div>
        {/* Stage labels and counts */}
        <div className="flex items-start justify-between gap-2">
          {stages.map((stage) => (
            <div key={stage.name} className="flex-1 flex flex-col items-center text-center gap-1">
              <span className="text-2xl font-semibold text-foreground tabular-nums">{stage.count}</span>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                <span className="text-xs text-muted-foreground">{stage.name}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// NOTIFICATIONS PREVIEW
// ============================================================================

function NotificationsPreview({ notifications }: { notifications: Notification[] }) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'g1.denied':
      case 'g2.denied':
      case 'g3.denied':
      case 'g4.denied':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          {notifications.some(n => !n.processed) && (
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              {notifications.filter(n => !n.processed).length} new
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-3 max-h-[180px] overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl transition-colors",
                  notification.processed
                    ? "bg-gray-100/30 dark:bg-zinc-800/30"
                    : "bg-primary/5 border border-primary/10"
                )}
              >
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(notification.occurredAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100/50 dark:bg-zinc-800/50 flex items-center justify-center mb-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CALENDAR WIDGET
// ============================================================================

function WeekCalendarWidget({ tasks }: { tasks: CalendarTask[] }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Start on Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        date: date.toISOString().split('T')[0],
        dayNum: date.getDate(),
        isToday: date.toDateString() === now.toDateString(),
      };
    });
  }, []);

  const tasksByDay = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const task of tasks) {
      const day = new Date(task.dueDate).toISOString().split('T')[0];
      if (!map[day]) map[day] = [];
      map[day].push(task);
    }
    return map;
  }, [tasks]);

  const getDayIndicator = (dateStr: string) => {
    const dayTasks = tasksByDay[dateStr];
    if (!dayTasks || dayTasks.length === 0) return null;

    const hasOverdue = dayTasks.some(t => t.status === 'overdue');
    const today = new Date().toISOString().split('T')[0];
    const isDueToday = dateStr === today;

    if (hasOverdue) return 'bg-red-500';
    if (isDueToday) return 'bg-amber-500';
    return 'bg-muted-foreground/40';
  };

  const selectedDayTasks = selectedDay ? (tasksByDay[selectedDay] || []) : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            This Week
          </CardTitle>
          <Link href="/app/tasks">
            <Button variant="ghost" size="sm" className="text-xs">
              Full calendar <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const indicator = getDayIndicator(day.date);
            const isSelected = selectedDay === day.date;
            const dayTaskCount = tasksByDay[day.date]?.length || 0;

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDay(isSelected ? null : day.date)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors",
                  "hover:bg-muted/50",
                  isSelected && "bg-primary/10 ring-1 ring-primary/20",
                  day.isToday && !isSelected && "bg-muted/30"
                )}
              >
                <span className="text-[10px] text-muted-foreground font-medium">{day.label}</span>
                <span className={cn(
                  "text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full",
                  day.isToday && "bg-primary text-primary-foreground",
                  !day.isToday && "text-foreground"
                )}>
                  {day.dayNum}
                </span>
                <div className="flex items-center gap-0.5 h-2">
                  {indicator ? (
                    <>
                      <div className={cn("w-1.5 h-1.5 rounded-full", indicator)} />
                      {dayTaskCount > 1 && (
                        <span className="text-[9px] text-muted-foreground">{dayTaskCount}</span>
                      )}
                    </>
                  ) : (
                    <div className="w-1.5 h-1.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded day tasks */}
        {selectedDay && selectedDayTasks.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {selectedDayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30"
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  task.status === 'overdue' ? 'bg-red-500' : task.priority === 'urgent' ? 'bg-amber-500' : 'bg-muted-foreground/40'
                )} />
                <span className="truncate text-foreground">{task.title}</span>
              </div>
            ))}
          </div>
        )}

        {selectedDay && selectedDayTasks.length === 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center py-2">No tasks this day</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INVESTOR STATS SECTIONS
// ============================================================================

function WholesalerStats({ stats }: { stats: NonNullable<InvestorStats['wholesaler']> }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Wholesaling</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Buyers"
          value={stats.totalBuyers}
          change="Active"
          trend="neutral"
          icon={UserCheck}
          iconColor="text-blue-500"
          href="/app/buyers"
        />
        <KPICard
          label="Active Assignments"
          value={stats.activeAssignments}
          change="In progress"
          trend="neutral"
          icon={Clock}
          iconColor="text-amber-500"
        />
        <KPICard
          label="Completed"
          value={stats.completedAssignments}
          change="All time"
          trend="up"
          icon={CheckCircle}
          iconColor="text-emerald-500"
        />
        <KPICard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          change="All time"
          trend="up"
          icon={DollarSign}
          iconColor="text-emerald-600"
        />
        <KPICard
          label="Avg Fee"
          value={formatCurrency(stats.avgAssignmentFee)}
          change="Per deal"
          trend="neutral"
          icon={BarChart3}
          iconColor="text-purple-500"
        />
      </div>
    </div>
  );
}

function FlipperStats({ stats }: { stats: NonNullable<InvestorStats['flipper']> }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
          <Hammer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Renovation Projects</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Projects"
          value={stats.totalRenovations}
          change="All time"
          trend="neutral"
          icon={Hammer}
          iconColor="text-orange-500"
          href="/app/renovations"
        />
        <KPICard
          label="Active"
          value={stats.activeRenovations}
          change="In progress"
          trend="neutral"
          icon={Clock}
          iconColor="text-amber-500"
        />
        <KPICard
          label="Completed"
          value={stats.completedRenovations}
          change="All time"
          trend="up"
          icon={CheckCircle}
          iconColor="text-emerald-500"
        />
        <KPICard
          label="Active Budget"
          value={formatCurrency(stats.totalBudget)}
          change="Committed"
          trend="neutral"
          icon={DollarSign}
          iconColor="text-red-500"
        />
        <KPICard
          label="Avg ROI"
          value={`${stats.avgROI.toFixed(1)}%`}
          change="Per project"
          trend={stats.avgROI >= 15 ? "up" : "down"}
          icon={Percent}
          iconColor="text-emerald-600"
        />
      </div>
    </div>
  );
}

function BuyAndHoldStats({ stats }: { stats: NonNullable<InvestorStats['buyAndHold']> }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Rental Portfolio</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard
          label="Properties"
          value={stats.totalRentals}
          change="Total"
          trend="neutral"
          icon={Building2}
          iconColor="text-indigo-500"
          href="/app/rentals"
        />
        <KPICard
          label="Leased"
          value={stats.leasedRentals}
          change="Active"
          trend="up"
          icon={CheckCircle}
          iconColor="text-emerald-500"
        />
        <KPICard
          label="Vacant"
          value={stats.vacantRentals}
          change={stats.vacantRentals === 0 ? "All occupied" : "Available"}
          trend={stats.vacantRentals === 0 ? "up" : "down"}
          icon={Building2}
          iconColor="text-zinc-400"
        />
        <KPICard
          label="Monthly Rent"
          value={formatCurrency(stats.totalMonthlyRent)}
          change="Gross"
          trend="up"
          icon={DollarSign}
          iconColor="text-emerald-600"
        />
        <KPICard
          label="Cash Flow"
          value={formatCurrency(stats.totalMonthlyCashFlow)}
          change="Net"
          trend={stats.totalMonthlyCashFlow >= 0 ? "up" : "down"}
          icon={PiggyBank}
          iconColor={stats.totalMonthlyCashFlow >= 0 ? "text-emerald-500" : "text-red-500"}
        />
        <KPICard
          label="Cap Rate"
          value={`${stats.avgCapRate.toFixed(1)}%`}
          change="Average"
          trend={stats.avgCapRate >= 6 ? "up" : "neutral"}
          icon={Percent}
          iconColor="text-purple-500"
        />
        <KPICard
          label="Occupancy"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          change="Rate"
          trend={stats.occupancyRate >= 90 ? "up" : "down"}
          icon={BarChart3}
          iconColor="text-blue-600"
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [investorStats, setInvestorStats] = useState<InvestorStats | null>(null);
  const [investorType, setInvestorType] = useState<InvestorType>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);

  // Helper: check if the user has any recent lead activity.
  // Only checks lead-related stats so that stale overdue tasks
  // don't prevent the seed demo data from showing on the dashboard.
  const hasRealStats = (s: DashboardStats | null): boolean => {
    if (!s) return false;
    return (
      s.newLeads24h > 0 ||
      s.newLeads7d > 0 ||
      s.propertiesContacted > 0 ||
      s.propertiesSkipTraced > 0
    );
  };

  // Fetch all dashboard data
  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [statsRes, hotLeadsRes, actionItemsRes, overdueTasksRes, investorStatsRes, notificationsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/hot-leads'),
        fetch('/api/dashboard/action-items'),
        fetch('/api/dashboard/overdue-tasks'),
        fetch('/api/dashboard/investor-stats'),
        fetch('/api/notifications?limit=5'),
      ]);

      // Handle stats - use seed data if API fails or returns no data
      let fetchedStats: DashboardStats | null = null;
      if (statsRes.ok) {
        const data = await statsRes.json();
        fetchedStats = data.stats;
      }
      // Use seed data if no real data exists
      setStats(hasRealStats(fetchedStats) ? fetchedStats : seedStats);

      // Handle hot leads - use seed data if empty
      let fetchedHotLeads: HotLead[] = [];
      if (hotLeadsRes.ok) {
        const data = await hotLeadsRes.json();
        fetchedHotLeads = data.hotLeads || [];
      }
      setHotLeads(fetchedHotLeads.length > 0 ? fetchedHotLeads : seedHotLeads);

      // Handle action items - use seed data if empty
      let fetchedActionItems: ActionItem[] = [];
      if (actionItemsRes.ok) {
        const data = await actionItemsRes.json();
        fetchedActionItems = data.actionItems || [];
      }
      setActionItems(fetchedActionItems.length > 0 ? fetchedActionItems : seedActionItems);

      // Handle overdue tasks - use seed data if empty
      let fetchedOverdueTasks: OverdueTask[] = [];
      if (overdueTasksRes.ok) {
        const data = await overdueTasksRes.json();
        fetchedOverdueTasks = data.overdueTasks || [];
      }
      setOverdueTasks(fetchedOverdueTasks.length > 0 ? fetchedOverdueTasks : seedOverdueTasks);

      // Handle investor stats - no seed data needed (optional section)
      if (investorStatsRes.ok) {
        const data = await investorStatsRes.json();
        setInvestorStats(data.stats || null);
        setInvestorType(data.investorType || null);
      }

      // Handle notifications - no seed data (fine to be empty)
      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data.notifications || []);
      }

      // Calendar tasks — use seed data immediately; try API in background
      setCalendarTasks(seedCalendarTasks);
      // Fire-and-forget: try to load real tasks without blocking dashboard
      const abortCtrl = new AbortController();
      const taskTimeout = setTimeout(() => abortCtrl.abort(), 3000);
      fetch('/api/tasks?limit=20', { signal: abortCtrl.signal })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          clearTimeout(taskTimeout);
          if (!data?.tasks?.length) return;
          const fetched = data.tasks.map((t: { id: string; title: string; dueDate?: string; dueAt?: string; status: string; priority: string }) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate || t.dueAt || new Date().toISOString(),
            status: t.status,
            priority: t.priority,
          }));
          setCalendarTasks(fetched);
        })
        .catch(() => { clearTimeout(taskTimeout); });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // On complete failure, use seed data
      setStats(seedStats);
      setHotLeads(seedHotLeads);
      setActionItems(seedActionItems);
      setOverdueTasks(seedOverdueTasks);
      setCalendarTasks(seedCalendarTasks);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Calculate KPI trends
  const calculateTrend = (current: number, previous: number): { change: string; trend: 'up' | 'down' | 'neutral' } => {
    const diff = current - previous;
    if (diff === 0) return { change: 'No change', trend: 'neutral' };
    const percentChange = previous > 0 ? ((diff / previous) * 100).toFixed(0) : '100';
    return {
      change: diff > 0 ? `+${percentChange}%` : `${percentChange}%`,
      trend: diff > 0 ? 'up' : 'down',
    };
  };

  // Pipeline stages
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const baseStages = [
      { name: "Leads", count: stats?.newLeads7d || 0, color: "bg-blue-500" },
      { name: "Contacted", count: stats?.propertiesContacted || 0, color: "bg-indigo-500" },
      { name: "Qualified", count: Math.floor((stats?.propertiesContacted || 0) * 0.6), color: "bg-purple-500" },
      { name: "Offers", count: Math.floor((stats?.propertiesContacted || 0) * 0.3), color: "bg-amber-500" },
      { name: "Closed", count: Math.floor((stats?.propertiesContacted || 0) * 0.1), color: "bg-emerald-500" },
    ];
    return baseStages;
  }, [stats]);

  // Dynamic greeting with user's first name
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting: string;
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";

    const firstName = clerkUser?.firstName;
    if (firstName) {
      return `${timeGreeting}, ${firstName}`;
    }
    return timeGreeting;
  }, [clerkUser?.firstName]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 pr-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-96" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            {/* Pipeline skeleton */}
            <PipelineSkeletonFull />

            {/* Content skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ActionCardSkeleton />
              <ActionCardSkeleton />
              <CalendarSkeleton />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 pr-4">
          {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your deals today
            {investorType && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {getInvestorTypeDisplayName(investorType)}
              </Badge>
            )}
            <Badge variant="outline" className="ml-2 text-[10px] font-mono opacity-50">
              v2.8.0
            </Badge>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Deal Pipeline — full width */}
      <PipelineFunnel stages={pipelineStages} />

      {/* Investor-specific stats */}
      {investorStats && (
        <div className="space-y-6">
          {investorStats.wholesaler && <WholesalerStats stats={investorStats.wholesaler} />}
          {investorStats.flipper && <FlipperStats stats={investorStats.flipper} />}
          {investorStats.buyAndHold && <BuyAndHoldStats stats={investorStats.buyAndHold} />}
        </div>
      )}

      {/* Main grid - Hot Leads, Actions, Calendar + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Hot Leads */}
        <Card className="lg:col-span-1 flex flex-col h-[459px]">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Hot Leads
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Score &ge; 85
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {hotLeads.length > 0 ? (
              <>
                <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                  {hotLeads.slice(0, 4).map((lead) => (
                    <Link
                      key={lead.id}
                      href="/app/leads"
                      className="block p-3 rounded-xl bg-gray-100/50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium",
                              lead.ownerName
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                : "bg-gray-100 text-gray-400 dark:bg-zinc-700 dark:text-zinc-500"
                            )}>
                              {lead.ownerName ? lead.ownerName.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {lead.ownerName || 'No Contact Info'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {lead.address}, {lead.city}, {lead.state}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-semibold",
                              lead.score >= 90
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                            )}
                          >
                            {lead.score}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 ml-9">
                        <Badge variant="secondary" className="text-[10px]">
                          {lead.dataSource}
                        </Badge>
                        {lead.skipTraced && (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            Skip Traced
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/app/leads" className="flex-shrink-0 mt-auto pt-2">
                  <Button variant="ghost" className="w-full text-sm">
                    View all hot leads
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <div className="w-10 h-10 rounded-full bg-gray-100/50 dark:bg-zinc-800/50 flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No hot leads yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads with score &ge; 85 will appear here
                </p>
                <Link href="/app/leads">
                  <Button variant="outline" size="sm" className="mt-3">
                    Search for leads
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Actions */}
        <Card className="flex flex-col h-[459px]">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Today&apos;s Actions
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {actionItems.length + overdueTasks.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {(actionItems.length > 0 || overdueTasks.length > 0) ? (
              <>
                <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                  {/* Overdue tasks first */}
                  {overdueTasks.slice(0, 2).map((task) => (
                    <Link
                      key={task.id}
                      href="/app/tasks?filter=overdue"
                      className="block p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            Overdue {task.overdueDays} {task.overdueDays === 1 ? 'day' : 'days'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {/* Action items */}
                  {actionItems.slice(0, 3 - Math.min(overdueTasks.length, 2)).map((item) => (
                    <Link
                      key={item.id}
                      href="/app/tasks"
                      className="block p-3 rounded-xl bg-gray-100/50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                          {item.type === 'first_contact' ? (
                            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <Link href="/app/tasks" className="flex-shrink-0 mt-auto pt-2">
                  <Button variant="ghost" className="w-full text-sm">
                    View all tasks
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No pending tasks for today
                </p>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Calendar + Recent Activity */}
          <div className="flex flex-col gap-6">
            <WeekCalendarWidget tasks={calendarTasks} />
            <NotificationsPreview notifications={notifications} />
          </div>
        </div>
      </div>
      </ScrollArea>
    </div>
  );
}
