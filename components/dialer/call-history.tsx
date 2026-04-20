"use client";

import { useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Bot,
  Play,
  Download,
  Filter,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// CallHistory — unified log across Flip Phone, Oppenheimer, and external
// integrations. Filterable by source, direction, and disposition.
// ---------------------------------------------------------------------------

type CallSource = "flip_phone" | "oppenheimer" | "calltools" | "mojo" | "smrtphone";
type Direction = "outbound" | "inbound";
type Disposition =
  | "interested"
  | "callback"
  | "not_interested"
  | "voicemail"
  | "no_answer"
  | "dnc_request"
  | "appt_set";

interface CallLog {
  id: string;
  startedAt: string;
  source: CallSource;
  direction: Direction;
  leadName: string;
  phone: string;
  duration: number;
  disposition: Disposition;
  recordingUrl?: string;
  agent?: string;
}

const DEMO_LOGS: CallLog[] = [
  { id: "c1", startedAt: "2026-04-20T14:32:00Z", source: "oppenheimer", direction: "outbound", leadName: "Margaret Sullivan", phone: "+19045551234", duration: 183, disposition: "appt_set", recordingUrl: "#", agent: "Oppenheimer · Alex" },
  { id: "c2", startedAt: "2026-04-20T13:14:00Z", source: "flip_phone", direction: "outbound", leadName: "James Rodriguez", phone: "+14075559876", duration: 412, disposition: "callback", recordingUrl: "#", agent: "Tanner C." },
  { id: "c3", startedAt: "2026-04-20T12:47:00Z", source: "calltools", direction: "outbound", leadName: "Patricia Chen", phone: "+18135554321", duration: 78, disposition: "voicemail", agent: "Agent 3" },
  { id: "c4", startedAt: "2026-04-20T11:22:00Z", source: "oppenheimer", direction: "inbound", leadName: "Robert Kim", phone: "+12795556655", duration: 247, disposition: "interested", recordingUrl: "#", agent: "Oppenheimer · Alex" },
  { id: "c5", startedAt: "2026-04-20T10:58:00Z", source: "flip_phone", direction: "outbound", leadName: "Maria Lopez", phone: "+13055550987", duration: 0, disposition: "no_answer", agent: "Tanner C." },
  { id: "c6", startedAt: "2026-04-20T10:11:00Z", source: "oppenheimer", direction: "outbound", leadName: "Jessie Brown", phone: "+18135559933", duration: 22, disposition: "dnc_request", recordingUrl: "#", agent: "Oppenheimer · Alex" },
  { id: "c7", startedAt: "2026-04-20T09:44:00Z", source: "mojo", direction: "outbound", leadName: "Unknown Owner", phone: "+17275552211", duration: 0, disposition: "no_answer", agent: "Agent 1" },
  { id: "c8", startedAt: "2026-04-20T09:12:00Z", source: "flip_phone", direction: "inbound", leadName: "Amanda Lee", phone: "+19045557788", duration: 356, disposition: "interested", recordingUrl: "#", agent: "Tanner C." },
];

const SOURCE_META: Record<CallSource, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  flip_phone: { label: "Flip Phone", icon: Phone, color: "text-cyan-600 dark:text-cyan-400" },
  oppenheimer: { label: "Oppenheimer", icon: Bot, color: "text-violet-600 dark:text-violet-400" },
  calltools: { label: "CallTools", icon: Phone, color: "text-blue-600 dark:text-blue-400" },
  mojo: { label: "Mojo", icon: Phone, color: "text-orange-600 dark:text-orange-400" },
  smrtphone: { label: "smrtPhone", icon: Phone, color: "text-fuchsia-600 dark:text-fuchsia-400" },
};

const DISPOSITION_META: Record<Disposition, { label: string; className: string }> = {
  interested: { label: "Interested", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  appt_set: { label: "Appt set", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  callback: { label: "Callback", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  not_interested: { label: "Not interested", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  voicemail: { label: "Voicemail", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
  no_answer: { label: "No answer", className: "bg-muted text-muted-foreground" },
  dnc_request: { label: "DNC requested", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CallHistory() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");

  const logs = DEMO_LOGS;

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
        if (directionFilter !== "all" && l.direction !== directionFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          l.leadName.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.agent ?? "").toLowerCase().includes(q)
        );
      }),
    [logs, sourceFilter, directionFilter, search],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Card className="flex-1 flex flex-col overflow-hidden p-0 gap-0">
        <div className="shrink-0 border-b px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search caller, phone, agent..."
              className="h-9 pl-9 text-xs"
            />
          </div>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              <SelectItem value="flip_phone" className="text-xs">Flip Phone</SelectItem>
              <SelectItem value="oppenheimer" className="text-xs">Oppenheimer</SelectItem>
              <SelectItem value="calltools" className="text-xs">CallTools</SelectItem>
              <SelectItem value="mojo" className="text-xs">Mojo</SelectItem>
              <SelectItem value="smrtphone" className="text-xs">smrtPhone</SelectItem>
            </SelectContent>
          </Select>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Both directions</SelectItem>
              <SelectItem value="outbound" className="text-xs">Outbound</SelectItem>
              <SelectItem value="inbound" className="text-xs">Inbound</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="tabular-nums text-[11px]">
              {filtered.length} calls
            </Badge>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Download className="h-3 w-3" />
              Export
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-5 py-2 w-[76px]">Time</th>
                <th className="text-left font-semibold px-3 py-2 w-[76px]">Dir</th>
                <th className="text-left font-semibold px-3 py-2">Lead</th>
                <th className="text-left font-semibold px-3 py-2">Source</th>
                <th className="text-left font-semibold px-3 py-2">Agent</th>
                <th className="text-left font-semibold px-3 py-2">Disposition</th>
                <th className="text-right font-semibold px-3 py-2 w-[80px]">Duration</th>
                <th className="text-right font-semibold px-5 py-2 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const src = SOURCE_META[log.source];
                const SrcIcon = src.icon;
                const disp = DISPOSITION_META[log.disposition];
                const DirIcon =
                  log.direction === "inbound"
                    ? PhoneIncoming
                    : log.disposition === "no_answer"
                      ? PhoneMissed
                      : PhoneOutgoing;
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {formatTime(log.startedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <DirIcon
                        className={cn(
                          "h-3.5 w-3.5",
                          log.direction === "inbound"
                            ? "text-blue-500"
                            : log.disposition === "no_answer"
                              ? "text-muted-foreground"
                              : "text-emerald-500",
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{log.leadName}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {log.phone}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 text-xs", src.color)}>
                        <SrcIcon className="h-3 w-3" />
                        {src.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]">
                      {log.agent ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                          disp.className,
                        )}
                      >
                        {disp.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {formatDuration(log.duration)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {log.recordingUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label="Play recording"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No calls match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}
