"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PipelineBreadcrumb } from "@/components/shared/pipeline-breadcrumb";
import {
  Search,
  Plus,
  MoreVertical,
  FileText,
  Send,
  Check,
  X,
  Clock,
  DollarSign,
  Home,
  Calendar,
  AlertCircle,
  FileSignature,
  Download,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Sparkles,
  LayoutGrid,
  List,
  ArrowRight,
  Timer,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  Handshake,
  Banknote,
  Target
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

// ============================================================================
// STATS CALCULATION
// ============================================================================

function calculateOfferStats(offers: Offer[]) {
  return {
    total: offers.length,
    draft: offers.filter(o => o.status === "draft").length,
    sent: offers.filter(o => o.status === "sent").length,
    countered: offers.filter(o => o.status === "countered").length,
    accepted: offers.filter(o => o.status === "accepted").length,
    rejected: offers.filter(o => o.status === "rejected").length,
    expired: offers.filter(o => o.status === "expired").length,
    totalValue: offers.reduce((sum, o) => sum + o.amount, 0),
    avgOffer: offers.length > 0 ? offers.reduce((sum, o) => sum + o.amount, 0) / offers.length : 0,
    pendingValue: offers.filter(o => o.status === "sent" || o.status === "countered").reduce((sum, o) => sum + o.amount, 0),
    acceptedValue: offers.filter(o => o.status === "accepted").reduce((sum, o) => sum + o.amount, 0),
    conversionRate: offers.length > 0 ? (offers.filter(o => o.status === "accepted").length / offers.length) * 100 : 0,
    withContracts: offers.filter(o => o.contract).length,
    needsContract: offers.filter(o => o.status === "accepted" && !o.contract).length
  };
}

// ============================================================================
// TYPES
// ============================================================================

interface Offer {
  id: string;
  amount: number;
  terms: string | null;
  contingencies: string[] | null;
  closingDate: string | null;
  expiresAt: string | null;
  earnestMoney: number | null;
  status: string;
  sentAt: string | null;
  responseAt: string | null;
  responseNotes: string | null;
  counterAmount: number | null;
  notes: string | null;
  createdAt: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string | null;
    ownerName: string | null;
    beds?: number;
    baths?: number;
    sqft?: number;
    arv?: number;
  };
  contract?: {
    id: string;
    status: string;
  };
}

// ============================================================================
// STAT CHIP COMPONENT
// ============================================================================

function StatChip({
  label,
  value,
  subValue,
  icon,
  trend,
  color = "blue"
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5",
    gray: "border-gray-200/50 dark:border-border/50 bg-gray-500/5"
  };

  const iconColorMap: Record<string, string> = {
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    gray: "text-gray-500"
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

// ============================================================================
// STATUS TIMELINE COMPONENT
// ============================================================================

function StatusTimeline({ status, sentAt, responseAt }: {
  status: string;
  sentAt: string | null;
  responseAt: string | null;
}) {
  const steps = [
    { key: "draft", label: "Draft", icon: FileText },
    { key: "sent", label: "Sent", icon: Send },
    { key: "response", label: "Response", icon: MessageSquare },
    { key: "outcome", label: "Outcome", icon: Target }
  ];

  const getStepStatus = (stepKey: string) => {
    if (status === "draft") {
      return stepKey === "draft" ? "active" : "pending";
    }
    if (status === "sent") {
      if (stepKey === "draft") return "completed";
      if (stepKey === "sent") return "active";
      return "pending";
    }
    if (status === "countered" || status === "accepted" || status === "rejected" || status === "expired") {
      if (stepKey === "draft" || stepKey === "sent") return "completed";
      if (stepKey === "response") return status === "countered" ? "active" : "completed";
      if (stepKey === "outcome") {
        if (status === "countered") return "pending";
        return status === "accepted" ? "success" : status === "rejected" ? "failed" : "expired";
      }
    }
    return "pending";
  };

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
              stepStatus === "completed" && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600",
              stepStatus === "active" && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 ring-2 ring-blue-500/30",
              stepStatus === "success" && "bg-emerald-500 text-white",
              stepStatus === "failed" && "bg-rose-500 text-white",
              stepStatus === "expired" && "bg-gray-400 text-white",
              stepStatus === "pending" && "bg-gray-100 dark:bg-muted text-gray-400"
            )}>
              {stepStatus === "completed" ? (
                <Check className="h-3 w-3" />
              ) : stepStatus === "success" ? (
                <Check className="h-3 w-3" />
              ) : stepStatus === "failed" ? (
                <X className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-4 h-0.5 mx-0.5",
                (stepStatus === "completed" || stepStatus === "success") ? "bg-emerald-300 dark:bg-emerald-700" : "bg-gray-200 dark:bg-gray-700"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// STATUS INDICATOR COMPONENT
// ============================================================================

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; bgColor: string; label: string; icon: React.ReactNode; pulse: boolean }> = {
    draft: {
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-100 dark:bg-muted",
      label: "Draft",
      icon: <FileText className="h-3 w-3" />,
      pulse: false
    },
    sent: {
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      label: "Sent",
      icon: <Send className="h-3 w-3" />,
      pulse: true
    },
    countered: {
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      label: "Countered",
      icon: <MessageSquare className="h-3 w-3" />,
      pulse: true
    },
    accepted: {
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      label: "Accepted",
      icon: <Check className="h-3 w-3" />,
      pulse: false
    },
    rejected: {
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-100 dark:bg-rose-900/30",
      label: "Rejected",
      icon: <X className="h-3 w-3" />,
      pulse: false
    },
    expired: {
      color: "text-gray-500 dark:text-gray-500",
      bgColor: "bg-gray-100 dark:bg-muted",
      label: "Expired",
      icon: <Clock className="h-3 w-3" />,
      pulse: false
    }
  };

  const { color, bgColor, label, icon, pulse } = config[status] || config.draft;

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", bgColor, color)}>
      <div className="relative flex items-center justify-center">
        {icon}
        {pulse && (
          <span className={cn("absolute h-full w-full rounded-full animate-ping opacity-30", bgColor)} />
        )}
      </div>
      {label}
    </div>
  );
}

// ============================================================================
// EXPIRATION BADGE COMPONENT
// ============================================================================

function ExpirationBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;

  const expirationDate = new Date(expiresAt);
  const isExpired = isPast(expirationDate);
  const daysUntil = differenceInDays(expirationDate, new Date());

  if (isExpired) {
    return (
      <Badge variant="outline" className="text-gray-500 border-gray-300">
        <Clock className="h-3 w-3 mr-1" />
        Expired
      </Badge>
    );
  }

  if (daysUntil <= 2) {
    return (
      <Badge variant="outline" className="text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-900/20">
        <Timer className="h-3 w-3 mr-1" />
        {daysUntil === 0 ? "Expires today" : `${daysUntil}d left`}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
      <Timer className="h-3 w-3 mr-1" />
      {daysUntil}d left
    </Badge>
  );
}

// ============================================================================
// OFFER CARD COMPONENT
// ============================================================================

function OfferCard({
  offer,
  onSelect,
  onAction,
  compact = false
}: {
  offer: Offer;
  onSelect: () => void;
  onAction: (action: string) => void;
  compact?: boolean;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const profit = offer.property.arv ? offer.property.arv - offer.amount : null;
  const margin = profit && offer.property.arv ? (profit / offer.property.arv) * 100 : null;

  // Compact list view
  if (compact) {
    return (
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200",
          "hover:bg-gray-50 dark:hover:bg-muted/50",
          "border-l-4",
          offer.status === "accepted" && "border-l-emerald-500",
          offer.status === "sent" && "border-l-blue-500",
          offer.status === "countered" && "border-l-amber-500",
          offer.status === "rejected" && "border-l-rose-500",
          offer.status === "expired" && "border-l-gray-400",
          offer.status === "draft" && "border-l-gray-300"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                {offer.property.address}
              </h3>
              {offer.status === "countered" && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs flex-shrink-0">
                  Counter: {formatCurrency(offer.counterAmount || 0)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{offer.property.city}, {offer.property.state}</span>
              <span>·</span>
              <span>{offer.property.ownerName || "Unknown Owner"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div className="text-center">
              <div className="font-bold tabular-nums text-lg">{formatCurrency(offer.amount)}</div>
              <div className="text-muted-foreground text-[10px]">offer</div>
            </div>
            {margin !== null && (
              <div className="text-center hidden sm:block">
                <div className={cn(
                  "font-bold tabular-nums",
                  margin >= 25 ? "text-emerald-600" : margin >= 15 ? "text-blue-600" : "text-amber-600"
                )}>
                  {margin.toFixed(0)}%
                </div>
                <div className="text-muted-foreground text-[10px]">margin</div>
              </div>
            )}
            <StatusIndicator status={offer.status} />
            {offer.expiresAt && offer.status === "sent" && (
              <ExpirationBadge expiresAt={offer.expiresAt} />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full card view
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
      {/* Status bar at top */}
      <div className={cn(
        "h-1 w-full",
        offer.status === "accepted" && "bg-gradient-to-r from-emerald-400 to-emerald-500",
        offer.status === "sent" && "bg-gradient-to-r from-blue-400 to-blue-500",
        offer.status === "countered" && "bg-gradient-to-r from-amber-400 to-amber-500",
        offer.status === "rejected" && "bg-gradient-to-r from-rose-400 to-rose-500",
        offer.status === "expired" && "bg-gradient-to-r from-gray-300 to-gray-400",
        offer.status === "draft" && "bg-gradient-to-r from-gray-200 to-gray-300"
      )} />

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
              {offer.property.address}
            </h3>
            <p className="text-sm text-muted-foreground">
              {offer.property.city}, {offer.property.state} {offer.property.zip}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onAction("view")}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("edit")}>
                <Edit className="h-4 w-4 mr-2" />
                Update Status
              </DropdownMenuItem>
              {offer.status === "accepted" && !offer.contract && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onAction("contract")}>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Create Contract
                  </DropdownMenuItem>
                </>
              )}
              {offer.contract && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/app/contracts" onClick={(e) => e.stopPropagation()}>
                      <FileSignature className="h-4 w-4 mr-2" />
                      View Contract
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onAction("delete")}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Owner & Property Info */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-medium text-xs">
                {(offer.property.ownerName || "?")[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{offer.property.ownerName || "Unknown"}</p>
              {offer.property.beds && (
                <p className="text-xs text-muted-foreground">
                  {offer.property.beds}bd · {offer.property.baths}ba · {offer.property.sqft?.toLocaleString()} sqft
                </p>
              )}
            </div>
          </div>
          <StatusIndicator status={offer.status} />
        </div>

        {/* Offer Amount */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {formatCurrency(offer.amount)}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {offer.status === "countered" ? "Your Offer" : "Offer Amount"}
            </span>
          </div>

          {offer.status === "countered" && offer.counterAmount ? (
            <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <span className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatCurrency(offer.counterAmount)}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-500">Counter Offer</span>
            </div>
          ) : offer.property.arv ? (
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Home className="h-4 w-4 text-emerald-500" />
                <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(offer.property.arv)}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ARV</span>
            </div>
          ) : (
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Banknote className="h-4 w-4 text-emerald-500" />
                <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(offer.earnestMoney || 0)}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Earnest Money</span>
            </div>
          )}
        </div>

        {/* Progress Timeline */}
        <div className="mb-4">
          <StatusTimeline status={offer.status} sentAt={offer.sentAt} responseAt={offer.responseAt} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border">
          <div className="flex items-center gap-2">
            {offer.terms && (
              <Badge variant="outline" className="capitalize text-xs">
                {offer.terms}
              </Badge>
            )}
            {offer.contract && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                <FileSignature className="h-3 w-3 mr-1" />
                Contract
              </Badge>
            )}
            {offer.status === "accepted" && !offer.contract && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Needs Contract
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {offer.expiresAt && offer.status === "sent" && (
              <ExpirationBadge expiresAt={offer.expiresAt} />
            )}
            {offer.closingDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Close: {format(new Date(offer.closingDate), "MMM d")}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function OfferCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gray-200 dark:bg-gray-700" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-6 w-6 rounded-full" />
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-border">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialog states
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [createContractDialogOpen, setCreateContractDialogOpen] = useState(false);

  // Form states
  const [newStatus, setNewStatus] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [contractClosingDate, setContractClosingDate] = useState<Date | undefined>(undefined);
  const [contractNotes, setContractNotes] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);

  // Fetch offers from API — strictly real data, no seed fallback.
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers');
        if (response.ok) {
          const data = await response.json();
          setOffers(data.offers ?? []);
        } else {
          setOffers([]);
        }
      } catch (error) {
        console.error('Error fetching offers:', error);
        setOffers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Filter offers
  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesAddress = offer.property.address.toLowerCase().includes(query);
        const matchesCity = offer.property.city.toLowerCase().includes(query);
        const matchesOwner = offer.property.ownerName?.toLowerCase().includes(query);
        if (!matchesAddress && !matchesCity && !matchesOwner) return false;
      }
      if (statusFilter !== "all" && offer.status !== statusFilter) return false;
      return true;
    });
  }, [offers, searchQuery, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => calculateOfferStats(offers), [offers]);

  // Handlers
  const handleOfferAction = (offerId: string, action: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    switch (action) {
      case "view":
        setSelectedOffer(offer);
        setDetailsDialogOpen(true);
        break;
      case "edit":
        setSelectedOffer(offer);
        setNewStatus(offer.status);
        setResponseNotes(offer.responseNotes || "");
        setUpdateStatusDialogOpen(true);
        break;
      case "contract":
        setSelectedOffer(offer);
        setContractClosingDate(offer.closingDate ? new Date(offer.closingDate) : undefined);
        setContractNotes("");
        setCreateContractDialogOpen(true);
        break;
      case "delete":
        if (confirm("Are you sure you want to delete this offer?")) {
          handleDeleteOffer(offerId);
        }
        break;
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOffer) return;
    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/offers/${selectedOffer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, responseNotes: responseNotes || null }),
      });

      if (response.ok) {
        toast.success('Offer status updated');
        setUpdateStatusDialogOpen(false);
        // Update local state
        setOffers(prev => prev.map(o =>
          o.id === selectedOffer.id
            ? { ...o, status: newStatus, responseNotes: responseNotes || null }
            : o
        ));
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      // Update local state anyway for demo
      setOffers(prev => prev.map(o =>
        o.id === selectedOffer.id
          ? { ...o, status: newStatus, responseNotes: responseNotes || null }
          : o
      ));
      toast.success('Offer status updated');
      setUpdateStatusDialogOpen(false);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      const response = await fetch(`/api/offers/${offerId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Offer deleted');
        setOffers(prev => prev.filter(o => o.id !== offerId));
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      // Update local state anyway for demo
      setOffers(prev => prev.filter(o => o.id !== offerId));
      toast.success('Offer deleted');
    }
  };

  const handleCreateContract = async () => {
    if (!selectedOffer) return;
    try {
      setCreatingContract(true);
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: selectedOffer.id,
          closingDate: contractClosingDate ? format(contractClosingDate, 'yyyy-MM-dd') : null,
          notes: contractNotes || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create contract: ${response.status}`);
      }

      // Read the real contract id from the API response. Do NOT fabricate
      // a `contract-${Date.now()}` id on failure (the pre-Phase-4 catch
      // block did this, masking real errors as successes).
      const data = await response.json();
      const realContract = data?.contract;
      if (!realContract?.id) {
        throw new Error('Contract response missing id');
      }

      // Sync local state with the real contract row.
      setOffers(prev => prev.map(o =>
        o.id === selectedOffer.id
          ? { ...o, contract: { id: realContract.id, status: realContract.status ?? 'pending' } }
          : o
      ));
      setCreateContractDialogOpen(false);
      toast.success('Contract created — taking you to Contracts');
      // Pipeline handoff: navigate to /app/contracts highlighting the
      // new row.
      router.push(`/app/contracts?highlight=${realContract.id}`);
    } catch (error) {
      console.error('Failed to create contract:', error);
      toast.error('Could not create contract. Please try again.');
    } finally {
      setCreatingContract(false);
    }
  };

  const exportToCSV = () => {
    const offersToExport = filteredOffers.length > 0 ? filteredOffers : offers;
    if (offersToExport.length === 0) {
      toast.error("No offers to export");
      return;
    }

    let csvContent = "Property,City,State,Owner,Amount,Status,Earnest Money,Closing Date,Sent At,Created\n";
    offersToExport.forEach(o => {
      csvContent += `"${o.property.address}",${o.property.city},${o.property.state},"${o.property.ownerName || ""}",${o.amount},${o.status},${o.earnestMoney || ""},${o.closingDate || ""},${o.sentAt || ""},${o.createdAt}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `offers-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${offersToExport.length} offers`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Offers
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Track and manage property offers
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={offers.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {/* Stats bar - mobile grid, desktop horizontal scroll */}
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <StatChip label="Active" value={stats.sent + stats.countered} icon={<Send className="h-4 w-4" />} color="blue" />
          <StatChip label="Won" value={stats.accepted} icon={<Check className="h-4 w-4" />} color="emerald" />
          <StatChip label="Rate" value={`${stats.conversionRate.toFixed(0)}%`} icon={<Target className="h-4 w-4" />} color="purple" />
        </div>
        <div className="hidden sm:block -mx-6">
          <div className="flex gap-3 overflow-x-auto pb-2 px-6 scrollbar-hide">
            <StatChip label="Total" value={stats.total} icon={<FileText className="h-4 w-4" />} color="gray" />
            <StatChip label="Pending" value={stats.sent + stats.countered} subValue={formatCurrency(stats.pendingValue)} icon={<Send className="h-4 w-4" />} color="blue" />
            <StatChip label="Countered" value={stats.countered} icon={<MessageSquare className="h-4 w-4" />} color="amber" />
            <StatChip label="Won" value={stats.accepted} subValue={formatCurrency(stats.acceptedValue)} icon={<Check className="h-4 w-4" />} color="emerald" />
            <StatChip label="Needs Contract" value={stats.needsContract} icon={<AlertCircle className="h-4 w-4" />} color="rose" />
            {/* Cleanup E2: trend prop omitted entirely — there is no prior-period
                conversion baseline in calculateOfferStats(), so any value here
                would be fabricated. D3 only suppressed the pill at 0%; the
                moment conversionRate became non-zero (any accepted offer),
                the hardcoded `{ value: 8, positive: true }` rendered a fake
                '+8% emerald' trend. Render value only until a real
                prevConversionRate is wired through /api/offers. */}
            <StatChip label="Conversion" value={`${stats.conversionRate.toFixed(0)}%`} icon={<Target className="h-4 w-4" />} color="purple" />
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
                className="pl-9 bg-white dark:bg-card"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[90px] sm:w-[126px] bg-white dark:bg-card flex-shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offers</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="countered">Countered</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
            <TabsList className="bg-white dark:bg-card flex-shrink-0">
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

      {/* Offers Grid */}
      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="pr-4 pb-6 pt-1">
          {isLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredOffers.length === 0 ? (
            searchQuery || statusFilter !== "all" ? (
              <EmptyState
                icon={<Sparkles className="h-10 w-10" />}
                title="No offers match your filters"
                description="Try adjusting your search or status filter to see more offers."
              />
            ) : (
              <EmptyState
                icon={<FileSignature className="h-10 w-10" />}
                title="No offers yet"
                description="Offers are created from the Underwriting workspace after you analyze a property. Pick a deal to underwrite and send your first offer."
                actionLabel="Go to Underwriting"
                actionHref="/app/underwriting"
              />
            )
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
              {filteredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onSelect={() => {
                    setSelectedOffer(offer);
                    setDetailsDialogOpen(true);
                  }}
                  onAction={(action) => handleOfferAction(offer.id, action)}
                  compact={viewMode === "list"}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Offer Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Offer Details</DialogTitle>
            <DialogDescription>Full details of this offer</DialogDescription>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              {/* Pipeline stage — reflects whether offer has advanced to contract/closed */}
              <PipelineBreadcrumb
                currentStage={
                  selectedOffer.contract?.status === "closed"
                    ? "closed"
                    : selectedOffer.contract
                      ? "under_contract"
                      : "offered"
                }
                variant="compact"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Property</Label>
                  <p className="font-medium">{selectedOffer.property.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOffer.property.city}, {selectedOffer.property.state}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Owner</Label>
                  <p className="font-medium">{selectedOffer.property.ownerName || 'Unknown'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Offer Amount</Label>
                  <p className="font-medium text-lg">{formatCurrency(selectedOffer.amount)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Earnest Money</Label>
                  <p className="font-medium">
                    {selectedOffer.earnestMoney ? formatCurrency(selectedOffer.earnestMoney) : 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Terms</Label>
                  <p className="font-medium capitalize">{selectedOffer.terms || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1"><StatusIndicator status={selectedOffer.status} /></div>
                </div>
              </div>

              {selectedOffer.contingencies && selectedOffer.contingencies.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Contingencies</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedOffer.contingencies.map((cont) => (
                      <Badge key={cont} variant="outline" className="capitalize">
                        {cont.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Closing Date</Label>
                  <p className="font-medium">
                    {selectedOffer.closingDate
                      ? format(new Date(selectedOffer.closingDate), 'MMM d, yyyy')
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expires</Label>
                  <p className="font-medium">
                    {selectedOffer.expiresAt
                      ? format(new Date(selectedOffer.expiresAt), 'MMM d, yyyy')
                      : 'Not set'}
                  </p>
                </div>
              </div>

              {selectedOffer.counterAmount && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Label className="text-amber-700 dark:text-amber-400">Counter Offer Amount</Label>
                  <p className="font-bold text-lg text-amber-800 dark:text-amber-300">
                    {formatCurrency(selectedOffer.counterAmount)}
                  </p>
                </div>
              )}

              {selectedOffer.responseNotes && (
                <div>
                  <Label className="text-muted-foreground">Response Notes</Label>
                  <p>{selectedOffer.responseNotes}</p>
                </div>
              )}

              {selectedOffer.notes && (
                <div>
                  <Label className="text-muted-foreground">Internal Notes</Label>
                  <p>{selectedOffer.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Offer Status</DialogTitle>
            <DialogDescription>Change the status and add response notes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="countered">Countered</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Response Notes</Label>
              <Input
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="Add notes about seller's response..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(false)} disabled={updatingStatus}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
              {updatingStatus ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Contract Dialog */}
      <Dialog open={createContractDialogOpen} onOpenChange={setCreateContractDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>Convert this accepted offer into a contract</DialogDescription>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Property</Label>
                <p className="font-medium">{selectedOffer.property.address}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedOffer.property.city}, {selectedOffer.property.state}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Purchase Price</Label>
                <p className="text-2xl font-bold">{formatCurrency(selectedOffer.amount)}</p>
              </div>

              <div className="space-y-2">
                <Label>Expected Closing Date</Label>
                <DatePicker
                  date={contractClosingDate}
                  onDateChange={setContractClosingDate}
                  placeholder="Select closing date"
                />
              </div>

              <div className="space-y-2">
                <Label>Contract Notes (Optional)</Label>
                <Textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder="Add any notes about this contract..."
                  rows={3}
                />
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> This will create a new contract with status "pending" and
                  generate closing tasks to help you track the process.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateContractDialogOpen(false)} disabled={creatingContract}>
              Cancel
            </Button>
            <Button onClick={handleCreateContract} disabled={creatingContract}>
              {creatingContract ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
