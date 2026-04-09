"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Play,
  Pause,
  Copy,
  Archive,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  Clock,
  Zap,
  TestTube,
  BarChart3,
  Send,
  Target,
  Sparkles,
  LayoutGrid,
  List,
  Calendar,
  DollarSign
} from "lucide-react";
// Note: Some icons (Users, Calendar, etc.) are used in child components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CampaignWizard } from "../components/campaign-wizard";
import { CampaignDetail } from "../components/campaign-detail";
import { seedCampaigns } from "./seed-data";

// Use seed data for campaigns
const mockCampaigns = seedCampaigns.map(campaign => ({
  ...campaign,
  lastRun: campaign.lastRun ? new Date(campaign.lastRun) : null,
  createdAt: new Date(campaign.createdAt)
}));

// Animated mini sparkline component - animates on hover
function Sparkline({ data, color = "emerald", height = 24 }: { data: number[], color?: string, height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const colorMap: Record<string, string> = {
    emerald: "#10b981",
    blue: "#3b82f6",
    amber: "#f59e0b",
    purple: "#8b5cf6",
    rose: "#f43f5e"
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full sparkline-container"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorMap[color]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorMap[color]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#sparkline-gradient-${color})`}
        className="sparkline-fill"
      />
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color]}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line drop-shadow-sm"
        pathLength="1"
      />
    </svg>
  );
}

// Progress ring component
function ProgressRing({ progress, size = 48, strokeWidth = 4, color = "emerald" }: {
  progress: number,
  size?: number,
  strokeWidth?: number,
  color?: string
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const colorMap: Record<string, string> = {
    emerald: "#10b981",
    blue: "#3b82f6",
    amber: "#f59e0b",
    purple: "#8b5cf6",
    rose: "#f43f5e"
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 progress-ring" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={progress >= 20 ? "progress-ring-circle" : ""}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            ['--target-offset' as string]: offset
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold tabular-nums">{progress}%</span>
      </div>
    </div>
  );
}

// Status indicator with pulse animation
function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string, label: string, icon: React.ReactNode, pulse: boolean }> = {
    running: {
      color: "bg-emerald-500",
      label: "Running",
      icon: <Play className="h-3 w-3" />,
      pulse: true
    },
    paused: {
      color: "bg-amber-500",
      label: "Paused",
      icon: <Pause className="h-3 w-3" />,
      pulse: false
    },
    completed: {
      color: "bg-gray-400",
      label: "Completed",
      icon: <CheckCircle className="h-3 w-3" />,
      pulse: false
    },
    draft: {
      color: "bg-blue-500",
      label: "Draft",
      icon: <Clock className="h-3 w-3" />,
      pulse: false
    }
  };

  const { color, label, icon, pulse } = config[status] || config.draft;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="relative flex items-center justify-center">
        <span className={cn("h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full", color)} />
        {pulse && (
          <span className={cn("absolute h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full animate-ping", color, "opacity-75")} />
        )}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
        <span className="hidden sm:inline">{icon}</span>
        {label}
      </span>
    </div>
  );
}

// Channel badges
function ChannelBadges({ channels }: { channels: string[] }) {
  const channelConfig: Record<string, { icon: React.ReactNode, color: string, label: string }> = {
    sms: { icon: <MessageSquare className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />, color: "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20", label: "SMS" },
    email: { icon: <Mail className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />, color: "text-purple-500 bg-purple-500/10 hover:bg-purple-500/20", label: "Email" },
    voicemail: { icon: <Phone className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />, color: "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20", label: "Voicemail" },
    letter: { icon: <FileText className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />, color: "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20", label: "Letter" }
  };

  return (
    <div className="flex gap-0.5 sm:gap-1">
      {channels.map(channel => {
        const config = channelConfig[channel];
        if (!config) return null;
        return (
          <div
            key={channel}
            className={cn("p-1 sm:p-2 rounded sm:rounded-lg transition-colors", config.color)}
            title={config.label}
          >
            {config.icon}
          </div>
        );
      })}
    </div>
  );
}

// Campaign card component
function CampaignCard({
  campaign,
  onSelect,
  onAction,
  compact = false
}: {
  campaign: typeof mockCampaigns[0],
  onSelect: () => void,
  onAction: (action: string) => void,
  compact?: boolean
}) {
  const replyRate = campaign.metrics.sends > 0
    ? (campaign.metrics.replies / campaign.metrics.sends * 100)
    : 0;
  const costPerDeal = campaign.metrics.contracts > 0
    ? campaign.metrics.cost / campaign.metrics.contracts
    : 0;

  // Generate mock sparkline data
  const sparklineData = useMemo(() => {
    return Array.from({ length: 7 }, () => Math.random() * 100);
  }, [campaign.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Compact list view for mobile
  if (compact) {
    return (
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200",
          "hover:bg-gray-50 dark:hover:bg-muted/50",
          "border-l-4",
          campaign.status === "running" && "border-l-emerald-500",
          campaign.status === "paused" && "border-l-amber-500",
          campaign.status === "completed" && "border-l-gray-400",
          campaign.status === "draft" && "border-l-blue-500"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3 flex items-center gap-3">
          {/* Name & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                {campaign.name}
              </h3>
              {campaign.abTest && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                  <TestTube className="h-3.5 w-3.5 text-purple-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="capitalize">{campaign.status}</span>
              <span>·</span>
              <span>{campaign.audience.size.toLocaleString()} leads</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div className="text-center hidden xs:block">
              <div className="font-bold tabular-nums">{campaign.metrics.sends.toLocaleString()}</div>
              <div className="text-muted-foreground text-[10px]">sent</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "font-bold tabular-nums",
                replyRate > 10 ? "text-emerald-600" : replyRate > 5 ? "text-blue-600" : "text-amber-600"
              )}>
                {replyRate.toFixed(1)}%
              </div>
              <div className="text-muted-foreground text-[10px]">reply</div>
            </div>
            <div className="text-center">
              <div className="font-bold tabular-nums text-emerald-600">{campaign.metrics.contracts}</div>
              <div className="text-muted-foreground text-[10px]">deals</div>
            </div>
            <div className="text-center hidden sm:block">
              <div className="font-bold tabular-nums">{formatCurrency(campaign.metrics.cost)}</div>
              <div className="text-muted-foreground text-[10px]">cost</div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="w-10 h-10 flex-shrink-0 hidden sm:flex items-center justify-center">
            <div className="relative w-8 h-8">
              <svg className="transform -rotate-90" width={32} height={32}>
                <circle
                  cx={16}
                  cy={16}
                  r={12}
                  stroke="currentColor"
                  strokeWidth={3}
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx={16}
                  cy={16}
                  r={12}
                  stroke={campaign.status === "completed" ? "#10b981" : "#3b82f6"}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 12 * 2 * Math.PI,
                    strokeDashoffset: 12 * 2 * Math.PI * (1 - campaign.progress / 100)
                  }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums">
                {campaign.progress}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-300",
        "hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20",
        "hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-800",
        "bg-gradient-to-br from-white to-gray-50/50 dark:from-card dark:to-card/50"
      )}
      onClick={onSelect}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Status bar at top */}
      <div className={cn(
        "h-1 w-full",
        campaign.status === "running" && "bg-gradient-to-r from-emerald-400 to-emerald-500",
        campaign.status === "paused" && "bg-gradient-to-r from-amber-400 to-amber-500",
        campaign.status === "completed" && "bg-gradient-to-r from-gray-300 to-gray-400",
        campaign.status === "draft" && "bg-gradient-to-r from-blue-400 to-blue-500"
      )} />

      <CardContent className="p-3 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className="flex-1 min-w-0 pr-2 sm:pr-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white truncate">
                {campaign.name}
              </h3>
              {campaign.abTest && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-[11px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <TestTube className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  A/B
                </span>
              )}
            </div>
            <StatusIndicator status={campaign.status} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onAction("view")}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {campaign.status === "running" && (
                <DropdownMenuItem onClick={() => onAction("pause")}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Campaign
                </DropdownMenuItem>
              )}
              {campaign.status === "paused" && (
                <DropdownMenuItem onClick={() => onAction("resume")}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Campaign
                </DropdownMenuItem>
              )}
              {campaign.status === "draft" && (
                <DropdownMenuItem onClick={() => onAction("launch")}>
                  <Zap className="h-4 w-4 mr-2" />
                  Launch Campaign
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onAction("duplicate")}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onAction("archive")}
                className="text-red-600 focus:text-red-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Full layout */}
        <div>
          {/* Audience & Channels */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium tabular-nums">{campaign.audience.size.toLocaleString()}</span>
              <span className="text-muted-foreground">leads</span>
            </div>
            <ChannelBadges channels={campaign.channels} />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Send className="h-3 w-3 text-blue-500" />
                <span className="text-lg font-bold tabular-nums">{campaign.metrics.sends.toLocaleString()}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sent</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="h-3 w-3 text-purple-500" />
                <span className="text-lg font-bold tabular-nums">{campaign.metrics.replies.toLocaleString()}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Replies</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="h-3 w-3 text-emerald-500" />
                <span className="text-lg font-bold tabular-nums">{campaign.metrics.contracts}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Deals</span>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <ProgressRing
                progress={campaign.progress}
                size={48}
                color={campaign.status === "completed" ? "emerald" : "blue"}
              />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">Progress</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Reply Rate</span>
                <span className={cn(
                  "font-semibold tabular-nums",
                  replyRate > 10 ? "text-emerald-600" : replyRate > 5 ? "text-blue-600" : "text-amber-600"
                )}>
                  {replyRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-5">
                <Sparkline
                  data={sparklineData}
                  color={replyRate > 10 ? "emerald" : replyRate > 5 ? "blue" : "amber"}
                  height={20}
                />
              </div>
            </div>
          </div>

          {/* Footer Stats */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 text-xs">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold tabular-nums">{formatCurrency(campaign.metrics.cost)}</span>
              {campaign.metrics.contracts > 0 && (
                <span className="text-muted-foreground">
                  · <span className="font-semibold text-emerald-600 tabular-nums">{formatCurrency(costPerDeal)}</span>/deal
                </span>
              )}
            </div>
            {campaign.lastRun && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(campaign.lastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact inline stat chip for horizontal scroll
function StatChip({
  label,
  value,
  subValue,
  icon,
  trend,
  color = "blue"
}: {
  label: string,
  value: string | number,
  subValue?: string,
  icon: React.ReactNode,
  trend?: { value: number, positive: boolean },
  color?: string
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5"
  };

  const iconColorMap: Record<string, string> = {
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
    rose: "text-rose-500"
  };

  return (
    <div className={cn(
      "flex-shrink-0 flex items-center gap-1.5 sm:gap-3 rounded-lg sm:rounded-xl border px-2 sm:px-4 py-1.5 sm:py-2.5 min-w-fit",
      colorMap[color]
    )}>
      <div className={cn("p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/80 dark:bg-black/30 hidden sm:block", iconColorMap[color])}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[8px] sm:text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </span>
        <div className="flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xs sm:text-lg font-bold tracking-tight tabular-nums leading-tight">{value}</span>
          {subValue && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">{subValue}</span>
          )}
          {trend && (
            <span className={cn(
              "hidden sm:flex items-center gap-0.5 text-[10px] font-medium",
              trend.positive ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {trend.value}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function CampaignCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gray-200 dark:bg-border" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center">
              <Skeleton className="h-6 w-16 mx-auto mb-1" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState(mockCampaigns);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showWizard, setShowWizard] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<typeof mockCampaigns[0] | null>(null);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && campaign.status !== statusFilter) {
      return false;
    }
    if (objectiveFilter !== "all" && campaign.objective !== objectiveFilter) {
      return false;
    }
    return true;
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter(c => c.status === "running").length;
    const totalSends = filteredCampaigns.reduce((sum, c) => sum + c.metrics.sends, 0);
    const totalReplies = filteredCampaigns.reduce((sum, c) => sum + c.metrics.replies, 0);
    const totalContracts = filteredCampaigns.reduce((sum, c) => sum + c.metrics.contracts, 0);
    const totalCost = filteredCampaigns.reduce((sum, c) => sum + c.metrics.cost, 0);
    const totalRevenue = filteredCampaigns.reduce((sum, c) => sum + (c.metrics.revenue || 0), 0);
    const avgReplyRate = totalSends > 0 ? (totalReplies / totalSends * 100) : 0;

    return {
      activeCampaigns,
      totalSends,
      totalReplies,
      totalContracts,
      totalCost,
      totalRevenue,
      avgReplyRate,
      roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost * 100) : 0
    };
  }, [campaigns, filteredCampaigns]);

  const handleCampaignAction = (campaignId: string, action: string) => {
    switch (action) {
      case "pause":
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId && c.status === "running"
            ? { ...c, status: "paused" }
            : c
        ));
        break;
      case "resume":
      case "launch":
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId && (c.status === "paused" || c.status === "draft")
            ? { ...c, status: "running" }
            : c
        ));
        break;
      case "archive":
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        break;
      case "view":
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign) setSelectedCampaign(campaign);
        break;
    }
  };

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Compact Header with inline stats */}
      <div className="flex-shrink-0 mb-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Campaigns
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Multi-channel outreach automation
            </p>
          </div>
          <Button
            onClick={() => setShowWizard(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 px-3 sm:px-4"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Campaign</span>
          </Button>
        </div>

        {/* Stats bar - grid on mobile, horizontal scroll on desktop */}
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <StatChip
            label="Active"
            value={stats.activeCampaigns}
            icon={<Play className="h-4 w-4" />}
            color="emerald"
          />
          <StatChip
            label="Sent"
            value={stats.totalSends.toLocaleString()}
            icon={<Send className="h-4 w-4" />}
            color="blue"
          />
          <StatChip
            label="Reply"
            value={`${stats.avgReplyRate.toFixed(1)}%`}
            icon={<MessageSquare className="h-4 w-4" />}
            color="purple"
          />
          <StatChip
            label="Deals"
            value={stats.totalContracts}
            icon={<Target className="h-4 w-4" />}
            color="emerald"
          />
          <StatChip
            label="Cost"
            value={formatCurrency(stats.totalCost)}
            icon={<DollarSign className="h-4 w-4" />}
            color="amber"
          />
          <StatChip
            label="ROI"
            value={stats.roi > 1000 ? `${(stats.roi / 1000).toFixed(1)}k%` : `${stats.roi.toFixed(0)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            color="emerald"
          />
        </div>
        {/* Desktop: horizontal scroll */}
        <div className="hidden sm:block -mx-6">
          <div className="flex gap-3 overflow-x-auto pb-2 px-6 scrollbar-hide">
            <StatChip
              label="Active"
              value={stats.activeCampaigns}
              icon={<Play className="h-4 w-4" />}
              color="emerald"
            />
            <StatChip
              label="Sent"
              value={stats.totalSends.toLocaleString()}
              icon={<Send className="h-4 w-4" />}
              color="blue"
            />
            <StatChip
              label="Reply Rate"
              value={`${stats.avgReplyRate.toFixed(1)}%`}
              icon={<MessageSquare className="h-4 w-4" />}
              trend={{ value: 12, positive: true }}
              color="purple"
            />
            <StatChip
              label="Contracts"
              value={stats.totalContracts}
              subValue={formatCurrency(stats.totalRevenue)}
              icon={<Target className="h-4 w-4" />}
              color="emerald"
            />
            <StatChip
              label="Cost"
              value={formatCurrency(stats.totalCost)}
              subValue={stats.roi > 1000 ? `${(stats.roi / 1000).toFixed(1)}k% ROI` : `${stats.roi.toFixed(0)}% ROI`}
              icon={<DollarSign className="h-4 w-4" />}
              color="amber"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center justify-between mt-4">
          <div className="flex flex-1 gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-muted text-gray-900 dark:text-white placeholder:text-gray-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[81px] sm:w-[117px] bg-white dark:bg-muted flex-shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
              <SelectTrigger className="w-[135px] bg-white dark:bg-muted hidden sm:flex flex-shrink-0">
                <SelectValue placeholder="Objective" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Objectives</SelectItem>
                <SelectItem value="inbound">Lead Gen</SelectItem>
                <SelectItem value="reengage">Re-engage</SelectItem>
                <SelectItem value="disposition">Buyer Mktg</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
            <TabsList className="bg-white dark:bg-muted flex-shrink-0">
              <TabsTrigger value="grid" className="px-2.5 sm:px-3.5 py-2">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2.5 sm:px-3.5 py-2">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Campaign Grid */}
      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="pr-4 pb-6 pt-1">
          {isLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === "grid"
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                {searchQuery || statusFilter !== "all" || objectiveFilter !== "all"
                  ? "Try adjusting your filters to see more campaigns"
                  : "Create your first campaign to start reaching motivated sellers"
                }
              </p>
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === "grid"
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1"
            )}>
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={() => setSelectedCampaign(campaign)}
                  onAction={(action) => handleCampaignAction(campaign.id, action)}
                  compact={viewMode === "list"}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Campaign Wizard Modal */}
      <CampaignWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={(campaign) => {
          setCampaigns([...campaigns, campaign]);
          setShowWizard(false);
        }}
      />
    </div>
  );
}
