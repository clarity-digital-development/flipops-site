"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  MoreVertical,
  Phone,
  MessageSquare,
  Home,
  Target,
  FileText,
  Wrench,
  LayoutGrid,
  LayoutList,
  ChevronRight,
  Timer,
  Users,
  TrendingUp,
  Calendar,
  ExternalLink,
  Edit3,
  Trash2,
  Play,
  Activity,
  MessageCircle,
  ListChecks,
  CheckSquare,
  Square,
  Send,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { EmptyState as SharedEmptyState } from "@/components/ui/empty-state";
import type { Task, TaskActivity, TaskComment, TaskSubtask } from "./seed-data";

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "open" | "in-progress" | "completed" | "blocked" | "overdue";

interface TaskFormData {
  type: Task["type"];
  title: string;
  description: string;
  dueDate: string;
  priority: Task["priority"];
}

// ============================================================================
// ANIMATED SLA GAUGE
// ============================================================================

function SLAGauge({
  value,
  label,
  size = 100
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // Half circle
  const offset = circumference - (animatedValue / 100) * circumference;

  const getColor = () => {
    if (animatedValue >= 85) return "#10b981"; // emerald
    if (animatedValue >= 70) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-800"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' }}
        />
        {/* Center value */}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          className="fill-current text-foreground font-bold tabular-nums"
          style={{ fontSize: size * 0.24 }}
        >
          {Math.round(animatedValue)}%
        </text>
      </svg>
      <span className="text-xs text-muted-foreground -mt-1">{label}</span>
    </div>
  );
}

// ============================================================================
// STATUS PIPELINE
// ============================================================================

function StatusPipeline({
  tasks,
  activeFilter,
  onFilterChange
}: {
  tasks: Task[];
  activeFilter: StatusFilter;
  onFilterChange: (status: StatusFilter) => void;
}) {
  const statusCounts = {
    all: tasks.length,
    open: tasks.filter(t => t.status === "open").length,
    "in-progress": tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    blocked: tasks.filter(t => t.status === "blocked").length,
    overdue: tasks.filter(t => t.status === "overdue").length,
  };

  const stages: { id: StatusFilter; label: string; color: string; bgColor: string }[] = [
    { id: "all", label: "All", color: "text-zinc-600 dark:text-zinc-300", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
    { id: "open", label: "Open", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/50" },
    { id: "in-progress", label: "In Progress", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/50" },
    { id: "blocked", label: "Blocked", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/50" },
    { id: "overdue", label: "Overdue", color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950/50" },
    { id: "completed", label: "Done", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/50" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl">
      {stages.map((stage, idx) => (
        <button
          key={stage.id}
          onClick={() => onFilterChange(stage.id)}
          className={cn(
            "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            activeFilter === stage.id
              ? cn(stage.bgColor, stage.color, "shadow-sm")
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <span>{stage.label}</span>
          <span className={cn(
            "tabular-nums text-xs px-1.5 py-0.5 rounded-md",
            activeFilter === stage.id
              ? "bg-white/60 dark:bg-black/20"
              : "bg-zinc-200/60 dark:bg-zinc-700/60"
          )}>
            {statusCounts[stage.id]}
          </span>
          {idx < stages.length - 1 && activeFilter !== stage.id && (
            <ChevronRight className="absolute -right-2 h-3 w-3 text-zinc-300 dark:text-zinc-700" />
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// STAT CHIPS (Horizontal)
// ============================================================================

function StatChip({
  icon: Icon,
  label,
  value,
  trend,
  color = "default"
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: { value: number; up: boolean };
  color?: "default" | "warning" | "danger" | "success";
}) {
  const colors = {
    default: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
    warning: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
    danger: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400",
    success: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-xl",
      colors[color]
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tabular-nums">{value}</span>
        <span className="text-xs opacity-75">{label}</span>
      </div>
      {trend && (
        <span className={cn(
          "text-xs font-medium ml-auto",
          trend.up ? "text-emerald-600" : "text-red-600"
        )}>
          {trend.up ? "+" : ""}{trend.value}%
        </span>
      )}
    </div>
  );
}

// ============================================================================
// TASK TYPE ICON
// ============================================================================

function TaskTypeIcon({ type, className }: { type: Task["type"]; className?: string }) {
  const icons: Record<Task["type"], { icon: React.ElementType; color: string }> = {
    call: { icon: Phone, color: "text-blue-500 bg-blue-500/10" },
    "follow-up": { icon: MessageSquare, color: "text-purple-500 bg-purple-500/10" },
    inspection: { icon: Home, color: "text-amber-500 bg-amber-500/10" },
    underwriting: { icon: Target, color: "text-emerald-500 bg-emerald-500/10" },
    dispo: { icon: TrendingUp, color: "text-cyan-500 bg-cyan-500/10" },
    document: { icon: FileText, color: "text-pink-500 bg-pink-500/10" },
    generic: { icon: Wrench, color: "text-zinc-500 bg-zinc-500/10" },
  };

  const config = icons[type] || icons.generic;
  const Icon = config.icon;

  return (
    <div className={cn("p-2 rounded-lg", config.color, className)}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

// ============================================================================
// PRIORITY BADGE
// ============================================================================

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const config: Record<Task["priority"], { label: string; className: string }> = {
    urgent: { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800" },
    high: { label: "High", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
    normal: { label: "Normal", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
    low: { label: "Low", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  };

  const { label, className } = config[priority];

  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", className)}>
      {label}
    </Badge>
  );
}

// ============================================================================
// SLA STATUS INDICATOR
// ============================================================================

function SLAIndicator({ status }: { status?: Task["slaStatus"] }) {
  if (!status) return null;

  const config: Record<NonNullable<Task["slaStatus"]>, { icon: React.ElementType; color: string; label: string }> = {
    "on-track": { icon: CheckCircle2, color: "text-emerald-500", label: "On Track" },
    "at-risk": { icon: Timer, color: "text-amber-500", label: "At Risk" },
    "violated": { icon: AlertTriangle, color: "text-red-500", label: "SLA Violated" },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

// ============================================================================
// TASK TABLE ROW (for table view)
// ============================================================================

function TaskTableRow({
  task,
  onClick,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  subtasks: TaskSubtask[];
  onClick: () => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue = task.status === "overdue" ||
    (task.status !== "completed" && new Date(task.dueAt) < new Date());

  return (
    <TableRow
      className={cn(
        "group cursor-pointer",
        task.status === "completed" && "opacity-60",
        isOverdue && "bg-red-50/50 dark:bg-red-950/20"
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <TableCell className="w-12">
        <div onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}>
          <Checkbox
            checked={task.status === "completed"}
            className={cn(
              "h-5 w-5 rounded-md",
              task.status === "completed" && "bg-emerald-500 border-emerald-500"
            )}
          />
        </div>
      </TableCell>

      {/* Task */}
      <TableCell>
        <div className="flex items-center gap-3">
          <TaskTypeIcon type={task.type} />
          <div className="min-w-0">
            <div className={cn(
              "font-medium text-foreground truncate",
              task.status === "completed" && "line-through text-muted-foreground"
            )}>
              {task.title}
            </div>
            {task.linkedEntity && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                {task.linkedEntity.type === "lead" ? (
                  <Users className="h-3 w-3" />
                ) : (
                  <Home className="h-3 w-3" />
                )}
                <span className="truncate max-w-[180px]">
                  {task.linkedEntity.address || task.linkedEntity.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Assignee */}
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {task.assigneeName.split(" ").map(n => n[0]).join("")}
          </div>
          <span className="text-sm text-muted-foreground truncate">
            {task.assigneeName}
          </span>
        </div>
      </TableCell>

      {/* Due */}
      <TableCell>
        <div className={cn(
          "flex items-center gap-1.5 text-sm",
          isOverdue && "text-red-600 dark:text-red-400 font-medium"
        )}>
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(task.dueAt)}</span>
        </div>
      </TableCell>

      {/* Priority */}
      <TableCell>
        <PriorityBadge priority={task.priority} />
      </TableCell>

      {/* SLA */}
      <TableCell>
        <SLAIndicator status={task.slaStatus} />
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {task.status === "completed" ? "Mark Incomplete" : "Mark Complete"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// TASK GRID CARD
// ============================================================================

function TaskGridCard({
  task,
  onClick,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  subtasks: TaskSubtask[];
  onClick: () => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue = task.status === "overdue" ||
    (task.status !== "completed" && new Date(task.dueAt) < new Date());

  return (
    <div
      className={cn(
        "group relative flex flex-col p-4 rounded-xl border bg-card transition-all cursor-pointer h-[162px]",
        "hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600",
        task.status === "completed" && "opacity-60",
        isOverdue && "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <TaskTypeIcon type={task.type} className="shrink-0" />
        <div className="flex items-center gap-1">
          <SLAIndicator status={task.slaStatus} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {task.status === "completed" ? "Mark Incomplete" : "Mark Complete"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 dark:text-red-400"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 mt-3 min-w-0">
        <h3 className={cn(
          "font-semibold text-sm text-foreground line-clamp-2",
          task.status === "completed" && "line-through text-muted-foreground"
        )}>
          {task.title}
        </h3>
        <div className="mt-2">
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-[9px] font-bold text-white">
            {task.assigneeName.split(" ").map(n => n[0]).join("")}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[72px]">
            {task.assigneeName.split(" ")[0]}
          </span>
        </div>
        <div className={cn(
          "text-xs flex items-center gap-1",
          isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
        )}>
          <Clock className="h-3 w-3" />
          {formatRelativeTime(task.dueAt)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TASK DETAIL SHEET
// ============================================================================

function TaskDetailSheet({
  task,
  subtasks,
  activities,
  comments,
  open,
  onOpenChange,
  onToggleComplete,
  onToggleSubtask,
  onAddComment,
}: {
  task: Task | null;
  subtasks: TaskSubtask[];
  activities: TaskActivity[];
  comments: TaskComment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleComplete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onAddComment: (content: string) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  if (!task) return null;

  const isOverdue = task.status === "overdue" ||
    (task.status !== "completed" && new Date(task.dueAt) < new Date());

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[486px] sm:max-w-[486px] p-0 flex flex-col"
      >
        {/* Hidden title for accessibility */}
        <SheetHeader className="sr-only">
          <SheetTitle>Task Details: {task.title}</SheetTitle>
        </SheetHeader>

        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start gap-4">
            <TaskTypeIcon type={task.type} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">
                {task.title}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <PriorityBadge priority={task.priority} />
                <SLAIndicator status={task.slaStatus} />
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    task.status === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
                    task.status === "in-progress" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
                    task.status === "blocked" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                  )}
                >
                  {task.status.replace("-", " ")}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant={task.status === "completed" ? "outline" : "default"}
              onClick={onToggleComplete}
            >
              {task.status === "completed" ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-zinc-200 dark:border-zinc-800 bg-transparent px-6 h-12">
            <TabsTrigger
              value="details"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <FileText className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Comments ({comments.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="details" className="m-0 p-6 space-y-6">
              {/* Description */}
              {task.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                  <p className="text-sm text-foreground">{task.description}</p>
                </div>
              )}

              {/* Subtasks */}
              {subtasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Subtasks ({subtasks.filter(s => s.status === "completed").length}/{subtasks.length})
                  </h4>
                  <div className="space-y-2">
                    {subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        onClick={() => onToggleSubtask(subtask.id)}
                      >
                        {subtask.status === "completed" ? (
                          <CheckSquare className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={cn(
                          "text-sm",
                          subtask.status === "completed" && "line-through text-muted-foreground"
                        )}>
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="text-xs text-muted-foreground mb-1">Assignee</div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-[10px] font-bold text-white">
                      {task.assigneeName.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span className="text-sm font-medium">{task.assigneeName}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="text-xs text-muted-foreground mb-1">Due Date</div>
                  <div className={cn(
                    "text-sm font-medium flex items-center gap-2",
                    isOverdue && "text-red-600 dark:text-red-400"
                  )}>
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(task.dueAt)}
                  </div>
                </div>
                {task.linkedEntity && (
                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      Linked {task.linkedEntity.type === "lead" ? "Lead" : "Deal"}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {task.linkedEntity.type === "lead" ? (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Home className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{task.linkedEntity.name}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    {task.linkedEntity.address && (
                      <p className="text-xs text-muted-foreground mt-1">{task.linkedEntity.address}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="m-0 p-6">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      activity.type === "completed" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                      activity.type === "sla-violation" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                      activity.type === "assigned" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                      activity.type === "updated" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                      activity.type === "created" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                      activity.type === "commented" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    )}>
                      {activity.type === "completed" && <CheckCircle2 className="h-4 w-4" />}
                      {activity.type === "sla-violation" && <AlertTriangle className="h-4 w-4" />}
                      {activity.type === "assigned" && <Users className="h-4 w-4" />}
                      {activity.type === "updated" && <Edit3 className="h-4 w-4" />}
                      {activity.type === "created" && <Plus className="h-4 w-4" />}
                      {activity.type === "commented" && <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{activity.userName}</span>
                        {" "}
                        <span className="text-muted-foreground">{activity.description}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="m-0 p-6 flex flex-col h-full">
              <div className="flex-1 space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {comment.userName.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{comment.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>

          {/* Comment input (always visible on comments tab) */}
          {activeTab === "comments" && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="resize-none min-h-[72px]"
                />
                <Button
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function TaskListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12"></TableHead>
          <TableHead className="text-primary font-semibold">Task</TableHead>
          <TableHead className="text-primary font-semibold w-40">Assignee</TableHead>
          <TableHead className="text-primary font-semibold w-32">Due</TableHead>
          <TableHead className="text-primary font-semibold w-24">Priority</TableHead>
          <TableHead className="text-primary font-semibold w-28">SLA</TableHead>
          <TableHead className="text-primary font-semibold w-20 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-5 rounded-md" /></TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TaskGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[162px]">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex-1 mt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-16 rounded-full mt-2" />
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-36 rounded-xl" />
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ filter }: { filter: StatusFilter }) {
  const copy: Record<StatusFilter, { title: string; description: string }> = {
    all: {
      title: "No tasks yet",
      description: "Tasks auto-create when you skip-trace a lead or take action on a property. Head to Leads to start working a property and your first task will land here.",
    },
    open: {
      title: "No open tasks",
      description: "All caught up. New tasks land here when you skip-trace a lead or move a property forward.",
    },
    "in-progress": {
      title: "Nothing in progress",
      description: "Open a task and mark it in progress to see it here.",
    },
    completed: {
      title: "No completed tasks",
      description: "Finish a task and it will show up here.",
    },
    blocked: {
      title: "Nothing blocked",
      description: "No tasks are waiting on something right now.",
    },
    overdue: {
      title: "No overdue tasks",
      description: "You are on top of every deadline. Nice.",
    },
  };

  const { title, description } = copy[filter];

  return (
    <SharedEmptyState
      icon={<ListChecks className="h-10 w-10" />}
      title={title}
      description={description}
      actionLabel="Browse Leads"
      actionHref="/app/leads"
    />
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    // Past
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  } else {
    // Future
    if (days > 0) return `in ${days}d`;
    if (hours > 0) return `in ${hours}h`;
    if (minutes > 0) return `in ${minutes}m`;
    return "Now";
  }
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TasksPageContent() {
  const { isLoaded, user } = useUser();
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New task form
  const [newTask, setNewTask] = useState<TaskFormData>({
    type: "call",
    title: "",
    description: "",
    dueDate: "",
    priority: "normal",
  });
  const [creating, setCreating] = useState(false);

  // Load real tasks from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
        setSubtasks(Array.isArray(data?.subtasks) ? data.subtasks : []);
        setActivities(Array.isArray(data?.activities) ? data.activities : []);
        setComments(Array.isArray(data?.comments) ? data.comments : []);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load tasks", err);
          setTasks([]);
          setSubtasks([]);
          setActivities([]);
          setComments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered tasks
  const filteredTasks = tasks.filter((task) => {
    // Status filter
    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesDesc = task.description?.toLowerCase().includes(query);
      const matchesAssignee = task.assigneeName.toLowerCase().includes(query);
      const matchesEntity = task.linkedEntity?.name.toLowerCase().includes(query) ||
        task.linkedEntity?.address?.toLowerCase().includes(query);

      if (!matchesTitle && !matchesDesc && !matchesAssignee && !matchesEntity) {
        return false;
      }
    }

    return true;
  });

  // Metrics derived from real tasks only
  const metrics = (() => {
    const overdue = tasks.filter(t => t.status === "overdue" ||
      (t.status !== "completed" && new Date(t.dueAt) < new Date())).length;
    const urgent = tasks.filter(t => t.priority === "urgent" && t.status !== "completed").length;
    const dueToday = tasks.filter(t => {
      const due = new Date(t.dueAt);
      const now = new Date();
      return due.toDateString() === now.toDateString() && t.status !== "completed";
    }).length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const withSla = tasks.filter(t => t.slaStatus);
    const onTrack = withSla.filter(t => t.slaStatus === "on-track").length;
    const slaCompliance = withSla.length > 0 ? Math.round((onTrack / withSla.length) * 100) : 0;
    return { overdue, urgent, dueToday, completed, slaCompliance };
  })();

  // Handlers
  const handleToggleComplete = useCallback(async (taskId: string) => {
    const current = tasks.find(t => t.id === taskId);
    if (!current) return;
    const newStatus: Task["status"] = current.status === "completed" ? "open" : "completed";
    const completedAt = newStatus === "completed" ? new Date().toISOString() : null;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, status: newStatus, completedAt: completedAt ?? undefined }
      : t));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, completedAt }),
      });
      if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
      toast({
        title: newStatus === "completed" ? "Task completed" : "Task reopened",
        description: current.title,
      });
    } catch (err) {
      console.error("Failed to toggle task", err);
      // Roll back
      setTasks(prev => prev.map(t => t.id === taskId ? current : t));
      toast({
        title: "Could not update task",
        description: current.title,
        variant: "destructive",
      });
    }
  }, [tasks, toast]);

  const handleToggleSubtask = useCallback((subtaskId: string) => {
    setSubtasks(prev => prev.map(s => {
      if (s.id === subtaskId) {
        return {
          ...s,
          status: s.status === "completed" ? "open" : "completed",
          completedAt: s.status === "completed" ? undefined : new Date().toISOString()
        };
      }
      return s;
    }));
  }, []);

  const handleAddComment = useCallback((taskId: string, content: string) => {
    const newComment: TaskComment = {
      id: `COMMENT-${Date.now()}`,
      taskId,
      userId: user?.id || "USER-001",
      userName: user?.fullName || "You",
      content,
      createdAt: new Date().toISOString(),
    };
    setComments(prev => [...prev, newComment]);
    toast({
      title: "Comment added",
    });
  }, [user, toast]);

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.dueDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in title and due date",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          type: newTask.type,
          priority: newTask.priority,
          dueAt: new Date(newTask.dueDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
      const created: Task = await res.json();

      setTasks(prev => [created, ...prev]);
      setCreateDialogOpen(false);
      setNewTask({
        type: "call",
        title: "",
        description: "",
        dueDate: "",
        priority: "normal",
      });
      toast({
        title: "Task created",
        description: created.title,
      });
    } catch (err) {
      console.error("Failed to create task", err);
      toast({
        title: "Could not create task",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  // Edit opens the detail sheet. The sheet today is read-mostly; this gets us
  // a working surface immediately. A dedicated edit-mode flag can layer on
  // top in a follow-up without touching consumers.
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirmTask) return;
    setDeleting(true);
    const target = deleteConfirmTask;
    try {
      const res = await fetch(`/api/tasks/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
      setTasks((prev) => prev.filter((t) => t.id !== target.id));
      if (selectedTask?.id === target.id) {
        setSelectedTask(null);
        setSheetOpen(false);
      }
      toast({ title: "Task deleted", description: target.title });
      setDeleteConfirmTask(null);
    } catch (err) {
      console.error("Failed to delete task", err);
      toast({
        title: "Could not delete task",
        description: target.title,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const selectedTaskSubtasks = subtasks.filter(s => s.taskId === selectedTask?.id);
  const selectedTaskActivities = activities.filter(a => a.taskId === selectedTask?.id);
  const selectedTaskComments = comments.filter(c => c.taskId === selectedTask?.id);

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Tasks</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your team's workload and track SLA compliance
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* SLA Gauge */}
              <div className="mr-4">
                <SLAGauge value={metrics.slaCompliance} label="SLA Compliance" size={80} />
              </div>

              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          {loading ? (
            <StatsSkeleton />
          ) : (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <StatChip
                icon={AlertTriangle}
                label="Overdue"
                value={metrics.overdue}
                color={metrics.overdue > 0 ? "danger" : "default"}
              />
              <StatChip
                icon={Zap}
                label="Urgent"
                value={metrics.urgent}
                color={metrics.urgent > 0 ? "warning" : "default"}
              />
              <StatChip
                icon={Clock}
                label="Due Today"
                value={metrics.dueToday}
                color="default"
              />
              <StatChip
                icon={CheckCircle2}
                label="Completed"
                value={metrics.completed}
                color="success"
              />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Status Pipeline */}
            <StatusPipeline
              tasks={tasks}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
            />

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[216px] bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode("list")}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content - scrollable area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            viewMode === "list" ? (
              <TaskListSkeleton />
            ) : (
              <div className="h-full p-4 overflow-auto">
                <TaskGridSkeleton />
              </div>
            )
          ) : filteredTasks.length === 0 ? (
            <EmptyState filter={statusFilter} />
          ) : viewMode === "list" ? (
            <ScrollArea className="h-full">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                    <TableHead className="sticky top-0 bg-card z-10 w-12"></TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold">Task</TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold w-40">Assignee</TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold w-32">Due</TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold w-24">Priority</TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold w-28">SLA</TableHead>
                    <TableHead className="sticky top-0 bg-card z-10 text-primary font-semibold w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TaskTableRow
                      key={task.id}
                      task={task}
                      subtasks={subtasks.filter(s => s.taskId === task.id)}
                      onClick={() => openTaskDetail(task)}
                      onToggleComplete={() => handleToggleComplete(task.id)}
                      onEdit={() => handleEditTask(task)}
                      onDelete={() => setDeleteConfirmTask(task)}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="h-full p-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTasks.map((task) => (
                  <TaskGridCard
                    key={task.id}
                    task={task}
                    subtasks={subtasks.filter(s => s.taskId === task.id)}
                    onClick={() => openTaskDetail(task)}
                    onToggleComplete={() => handleToggleComplete(task.id)}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => setDeleteConfirmTask(task)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        subtasks={selectedTaskSubtasks}
        activities={selectedTaskActivities}
        comments={selectedTaskComments}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onToggleComplete={() => selectedTask && handleToggleComplete(selectedTask.id)}
        onToggleSubtask={handleToggleSubtask}
        onAddComment={(content) => selectedTask && handleAddComment(selectedTask.id, content)}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={(o) => !o && setDeleteConfirmTask(null)}>
        <DialogContent className="sm:max-w-[432px]">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This permanently removes &quot;{deleteConfirmTask?.title}&quot; from your task list. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmTask(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTask} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[432px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your workflow
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newTask.type}
                onValueChange={(value: Task["type"]) => setNewTask({ ...newTask, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="follow-up">Follow Up</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="underwriting">Underwriting</SelectItem>
                  <SelectItem value="dispo">Disposition</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="E.g., Follow up with seller"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Add details..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value: Task["priority"]) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={creating}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
