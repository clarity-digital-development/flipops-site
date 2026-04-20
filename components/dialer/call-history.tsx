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
  Sparkles,
  Flame,
  ArrowUpRight,
  Clock,
  MessageSquareText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
// integrations. Filter by source / direction. Click a row to open the
// detail sheet with AI-extracted disposition, notes, and transcript.
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
  leadId?: string;
  leadName: string;
  address?: string;
  phone: string;
  duration: number;
  disposition: Disposition;
  recordingUrl?: string;
  agent?: string;
  // AI-extracted metadata (populated by Haiku after call.conversation.ended)
  sentiment?: "positive" | "neutral" | "negative";
  urgency?: "hot" | "warm" | "cold";
  keyNotes?: string[];
  askingPrice?: number | null;
  timelineDays?: number | null;
  transcript?: { role: "assistant" | "user"; text: string }[];
}

const DEMO_LOGS: CallLog[] = [
  {
    id: "c1",
    startedAt: "2026-04-20T14:32:00Z",
    source: "oppenheimer",
    direction: "inbound",
    leadId: "p-001",
    leadName: "Margaret Sullivan",
    address: "1234 Oak Street, Jacksonville FL",
    phone: "+19045551234",
    duration: 183,
    disposition: "appt_set",
    recordingUrl: "#",
    agent: "Oppenheimer · Alex",
    sentiment: "positive",
    urgency: "hot",
    keyNotes: [
      "Owner selling due to job relocation — moving to Arizona in 6 weeks",
      "Asking $285k; indicated flexibility on price",
      "Property needs light repairs (~$20k est., per owner)",
      "Booked walkthrough Thursday 2pm",
    ],
    askingPrice: 285000,
    timelineDays: 42,
    transcript: [
      { role: "assistant", text: "Thanks for calling FlipOps — I'm Alex. How can I help?" },
      { role: "user", text: "Hi, I'm calling about my property on Oak Street. Thinking about selling." },
      { role: "assistant", text: "Got it — 1234 Oak Street in Jacksonville? What's driving the decision to sell?" },
      { role: "user", text: "I took a job in Arizona, need to be there in about 6 weeks." },
      { role: "assistant", text: "That's a real timeline. What price are you hoping to get?" },
      { role: "user", text: "I was thinking around $285, maybe a little flexible." },
      { role: "assistant", text: "Perfect. Any major repairs I should know about?" },
      { role: "user", text: "Needs some paint and the water heater is old. Maybe $20k of stuff." },
      { role: "assistant", text: "Thanks. Let me get one of our acquisitions folks out there for a walkthrough — Thursday at 2pm work?" },
      { role: "user", text: "Yeah Thursday's good." },
      { role: "assistant", text: "Booked. You'll get a confirmation text in a minute. Talk soon." },
    ],
  },
  {
    id: "c2",
    startedAt: "2026-04-20T13:14:00Z",
    source: "flip_phone",
    direction: "outbound",
    leadName: "James Rodriguez",
    address: "567 Maple Ave, Orlando FL",
    phone: "+14075559876",
    duration: 412,
    disposition: "callback",
    recordingUrl: "#",
    agent: "Tanner C.",
    sentiment: "neutral",
    urgency: "warm",
    keyNotes: [
      "Still talking to siblings — inheritance situation",
      "Timeline 3-6 months",
      "Requested callback Monday afternoon",
    ],
  },
  {
    id: "c3",
    startedAt: "2026-04-20T12:47:00Z",
    source: "calltools",
    direction: "outbound",
    leadName: "Patricia Chen",
    address: "890 Pine Road, Tampa FL",
    phone: "+18135554321",
    duration: 78,
    disposition: "voicemail",
    agent: "Agent 3",
    keyNotes: ["Left voicemail — no response yet"],
  },
  {
    id: "c4",
    startedAt: "2026-04-20T11:22:00Z",
    source: "oppenheimer",
    direction: "inbound",
    leadName: "Robert Kim",
    address: "321 Cedar Ln, Miami FL",
    phone: "+12795556655",
    duration: 247,
    disposition: "interested",
    recordingUrl: "#",
    agent: "Oppenheimer · Alex",
    sentiment: "positive",
    urgency: "hot",
    keyNotes: [
      "Retiring, wants to downsize",
      "Timeline flexible (next 90 days)",
      "No repairs needed — recently renovated",
      "Wants cash offer before talking price",
    ],
    timelineDays: 90,
  },
  {
    id: "c5",
    startedAt: "2026-04-20T10:58:00Z",
    source: "flip_phone",
    direction: "outbound",
    leadName: "Maria Lopez",
    phone: "+13055550987",
    duration: 0,
    disposition: "no_answer",
    agent: "Tanner C.",
  },
  {
    id: "c6",
    startedAt: "2026-04-20T10:11:00Z",
    source: "oppenheimer",
    direction: "inbound",
    leadName: "Jessie Brown",
    phone: "+18135559933",
    duration: 22,
    disposition: "dnc_request",
    recordingUrl: "#",
    agent: "Oppenheimer · Alex",
    sentiment: "negative",
    keyNotes: [
      "Caller asked to be removed from list",
      "Auto-added to internal opt-out list — no future outbound",
    ],
  },
  {
    id: "c7",
    startedAt: "2026-04-20T09:44:00Z",
    source: "mojo",
    direction: "outbound",
    leadName: "Unknown Owner",
    phone: "+17275552211",
    duration: 0,
    disposition: "no_answer",
    agent: "Agent 1",
  },
  {
    id: "c8",
    startedAt: "2026-04-20T09:12:00Z",
    source: "flip_phone",
    direction: "inbound",
    leadName: "Amanda Lee",
    address: "Vero Beach FL",
    phone: "+19045557788",
    duration: 356,
    disposition: "interested",
    recordingUrl: "#",
    agent: "Tanner C.",
    sentiment: "positive",
    urgency: "warm",
    keyNotes: [
      "Inherited property from mother",
      "Wants quick close",
      "Open to assignment if price right",
    ],
  },
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const logs = DEMO_LOGS;
  const selected = logs.find((l) => l.id === selectedId) ?? null;

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
                <th className="text-left font-semibold px-3 py-2 w-[44px]">Dir</th>
                <th className="text-left font-semibold px-3 py-2">Lead</th>
                <th className="text-left font-semibold px-3 py-2">Source</th>
                <th className="text-left font-semibold px-3 py-2">Disposition</th>
                <th className="text-left font-semibold px-3 py-2">AI notes</th>
                <th className="text-right font-semibold px-3 py-2 w-[70px]">Duration</th>
                <th className="text-right font-semibold px-5 py-2 w-[44px]" />
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
                    onClick={() => setSelectedId(log.id)}
                    className={cn(
                      "border-b border-border/50 cursor-pointer transition-colors",
                      selectedId === log.id
                        ? "bg-muted/50"
                        : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-5 py-2.5 text-xs text-muted-foreground tabular-nums align-top">
                      {formatTime(log.startedAt)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <DirIcon
                        className={cn(
                          "h-3.5 w-3.5 mt-0.5",
                          log.direction === "inbound"
                            ? "text-blue-500"
                            : log.disposition === "no_answer"
                              ? "text-muted-foreground"
                              : "text-emerald-500",
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{log.leadName}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {log.phone}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className={cn("inline-flex items-center gap-1 text-xs", src.color)}>
                        <SrcIcon className="h-3 w-3" />
                        {src.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                          disp.className,
                        )}
                      >
                        {disp.label}
                      </span>
                      {log.urgency === "hot" && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <Flame className="h-2.5 w-2.5" />
                          hot
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 max-w-[280px]">
                        {log.keyNotes?.[0] ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums align-top">
                      {formatDuration(log.duration)}
                    </td>
                    <td className="px-5 py-2.5 text-right align-top">
                      {log.recordingUrl ? (
                        <Play className="h-3.5 w-3.5 text-muted-foreground inline" />
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

      {/* Detail sheet */}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 bg-background flex flex-col"
        >
          <VisuallyHidden>
            <SheetTitle>{selected?.leadName ?? "Call detail"}</SheetTitle>
          </VisuallyHidden>

          {selected && <CallDetailBody call={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CallDetailBody({ call }: { call: CallLog }) {
  const src = SOURCE_META[call.source];
  const SrcIcon = src.icon;
  const disp = DISPOSITION_META[call.disposition];
  const isAI = call.source === "oppenheimer";

  return (
    <>
      <div className="shrink-0 border-b border-border p-5 space-y-2">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
            {call.leadName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold truncate">{call.leadName}</h2>
            {call.address && (
              <p className="text-xs text-muted-foreground truncate">{call.address}</p>
            )}
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
              {call.phone}
            </p>
          </div>
          {call.leadId && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0">
              Open lead
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          <span className={cn("inline-flex items-center gap-1", src.color)}>
            <SrcIcon className="h-3 w-3" />
            {src.label}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(call.duration)}
          </span>
          <span>·</span>
          <span>{new Date(call.startedAt).toLocaleString()}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-5 space-y-5">
          {/* Auto-disposition */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Disposition
              </h3>
              {isAI && (
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI-classified
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                  disp.className,
                )}
              >
                {disp.label}
              </span>
              {call.urgency === "hot" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  <Flame className="h-3 w-3" />
                  Hot lead
                </span>
              )}
              {call.sentiment && (
                <span className="text-[11px] text-muted-foreground">
                  · {call.sentiment} sentiment
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] ml-auto text-muted-foreground"
              >
                Edit
              </Button>
            </div>
          </section>

          {/* AI-extracted key notes */}
          {call.keyNotes && call.keyNotes.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Key notes
                </h3>
                {isAI && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                    <Sparkles className="h-2.5 w-2.5" />
                    Extracted by AI
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {call.keyNotes.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed"
                  >
                    <span className="text-violet-500 mt-0.5">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Structured fields */}
          {(call.askingPrice != null || call.timelineDays != null) && (
            <section>
              <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Extracted fields
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {call.askingPrice != null && (
                  <FieldCell
                    label="Asking price"
                    value={`$${call.askingPrice.toLocaleString()}`}
                  />
                )}
                {call.timelineDays != null && (
                  <FieldCell
                    label="Timeline"
                    value={`${call.timelineDays} days`}
                  />
                )}
              </div>
            </section>
          )}

          {/* Recording */}
          {call.recordingUrl && (
            <section>
              <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Recording
              </h3>
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full shrink-0"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-0 bg-violet-500" />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDuration(call.duration)}
                </span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </section>
          )}

          {/* Transcript */}
          {call.transcript && call.transcript.length > 0 && (
            <section>
              <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <MessageSquareText className="h-3 w-3" />
                Transcript
              </h3>
              <div className="rounded-md border border-border divide-y divide-border/60">
                {call.transcript.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "px-3 py-2 text-xs leading-relaxed",
                      t.role === "assistant" && "bg-violet-50/30 dark:bg-violet-950/20",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide font-semibold mr-2",
                        t.role === "assistant"
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {t.role === "assistant" ? "AI" : "Caller"}
                    </span>
                    {t.text}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Action footer */}
      <div className="shrink-0 border-t bg-muted/30 p-4 grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm">
          Book appointment
        </Button>
        <Button variant="outline" size="sm">
          Assign to human
        </Button>
        <Button size="sm">Open lead</Button>
      </div>
    </>
  );
}

function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
