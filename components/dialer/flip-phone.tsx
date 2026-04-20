"use client";

import { useMemo, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  PauseCircle,
  Volume2,
  Hash,
  Delete,
  UserCheck,
  Building,
  Radio,
  Timer,
  MessageSquareText,
  NotebookPen,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ConsentBadge, type ConsentState } from "./consent-badge";

// ---------------------------------------------------------------------------
// FlipPhone — browser WebRTC softphone for human-initiated outbound.
// Uses @telnyx/webrtc under the hood once wired. This file is the visual
// surface; the actual SIP over WebSocket connection plugs in when the JWT
// endpoint and credential are live.
// ---------------------------------------------------------------------------

type CallState = "idle" | "dialing" | "ringing" | "active" | "ended";

interface QueuedLead {
  id: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  score: number;
  consent: ConsentState;
}

const DEMO_QUEUE: QueuedLead[] = [
  {
    id: "ql-1",
    ownerName: "Margaret Sullivan",
    address: "1234 Oak Street",
    city: "Jacksonville",
    state: "FL",
    phone: "+19045551234",
    score: 92,
    consent: "human_only",
  },
  {
    id: "ql-2",
    ownerName: "James Rodriguez",
    address: "567 Maple Ave",
    city: "Orlando",
    state: "FL",
    phone: "+14075559876",
    score: 89,
    consent: "ai_legal",
  },
  {
    id: "ql-3",
    ownerName: "Patricia Chen",
    address: "890 Pine Road",
    city: "Tampa",
    state: "FL",
    phone: "+18135554321",
    score: 85,
    consent: "unknown",
  },
  {
    id: "ql-4",
    ownerName: "Unknown Owner",
    address: "321 Cedar Ln",
    city: "Miami",
    state: "FL",
    phone: "+13055557654",
    score: 82,
    consent: "dnc",
  },
];

const CALLER_IDS = [
  { id: "+19045550001", label: "Jacksonville (904) 555-0001" },
  { id: "+14075550002", label: "Orlando (407) 555-0002" },
  { id: "+13055550003", label: "Miami (305) 555-0003" },
];

export function FlipPhone() {
  const [queue] = useState<QueuedLead[]>(DEMO_QUEUE);
  const [activeLead, setActiveLead] = useState<QueuedLead | null>(queue[0] ?? null);
  const [search, setSearch] = useState("");
  const [dialInput, setDialInput] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [recording, setRecording] = useState(true);
  const [callerId, setCallerId] = useState(CALLER_IDS[0].id);
  const [callSeconds, setCallSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState<string>("");

  const filtered = useMemo(
    () =>
      queue.filter(
        (l) =>
          !search ||
          l.ownerName.toLowerCase().includes(search.toLowerCase()) ||
          l.address.toLowerCase().includes(search.toLowerCase()) ||
          l.phone.includes(search),
      ),
    [queue, search],
  );

  const dialOrPick = (digit: string) => {
    if (callState === "active") return; // DTMF would stream to Telnyx once live
    setDialInput((prev) => (prev.length >= 14 ? prev : prev + digit));
  };

  const backspace = () => setDialInput((prev) => prev.slice(0, -1));

  const startCall = () => {
    if (!activeLead) return;
    setCallState("dialing");
    setTimeout(() => setCallState("ringing"), 600);
    setTimeout(() => {
      setCallState("active");
      startTimer();
    }, 1600);
  };

  const endCall = () => {
    setCallState("ended");
    setCallSeconds(0);
  };

  const startTimer = () => {
    const id = window.setInterval(() => {
      setCallSeconds((s) => {
        if (callState === "active") return s + 1;
        return s;
      });
    }, 1000);
    // Hacky demo — actual cleanup will happen when real WebRTC events arrive.
    setTimeout(() => window.clearInterval(id), 10 * 60 * 1000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  };

  const isConnecting = callState === "dialing" || callState === "ringing";
  const isActive = callState === "active";
  const canCallActive =
    activeLead && activeLead.consent !== "dnc" && callState === "idle";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr_340px] gap-4 min-h-0">
        {/* ----- Left: queue ----- */}
        <Card className="flex flex-col overflow-hidden p-0 gap-0">
          <div className="shrink-0 border-b px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Dial queue</h3>
              <Badge variant="secondary" className="text-[10px]">
                {filtered.length}
              </Badge>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queue..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <ul className="divide-y divide-border">
              {filtered.map((lead) => {
                const isSelected = activeLead?.id === lead.id;
                return (
                  <li key={lead.id}>
                    <button
                      onClick={() => setActiveLead(lead)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "bg-muted/60"
                          : "hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {lead.ownerName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">
                            {lead.address} · {lead.city}, {lead.state}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded",
                            lead.score >= 85
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {lead.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {lead.phone}
                        </span>
                        <ConsentBadge state={lead.consent} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </Card>

        {/* ----- Center: dialer ----- */}
        <Card className="flex flex-col overflow-hidden p-0 gap-0">
          {/* Caller card */}
          <div className="shrink-0 border-b px-6 py-4">
            {activeLead ? (
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-semibold">
                  {activeLead.ownerName.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold truncate">
                      {activeLead.ownerName}
                    </h2>
                    <ConsentBadge state={activeLead.consent} size="md" />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building className="h-3.5 w-3.5" />
                    {activeLead.address}, {activeLead.city}, {activeLead.state}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-1">
                    {activeLead.phone}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs">
                  Open lead
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a lead from the queue or dial a number below.
              </div>
            )}
          </div>

          {/* Call state banner */}
          <div
            className={cn(
              "shrink-0 px-6 py-3 border-b flex items-center justify-between transition-colors",
              isActive
                ? "bg-emerald-50/60 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                : isConnecting
                  ? "bg-blue-50/60 border-blue-200/60 dark:bg-blue-950/30 dark:border-blue-900/50"
                  : "bg-muted/30",
            )}
          >
            <div className="flex items-center gap-2">
              {isActive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              {isConnecting && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              )}
              <span className="text-sm font-medium">
                {callState === "idle" && "Ready"}
                {callState === "dialing" && "Dialing..."}
                {callState === "ringing" && "Ringing..."}
                {callState === "active" && "Live"}
                {callState === "ended" && "Call ended"}
              </span>
              {isActive && (
                <span className="text-sm tabular-nums text-muted-foreground flex items-center gap-1 ml-3">
                  <Timer className="h-3.5 w-3.5" />
                  {formatTime(callSeconds)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Radio className={cn("h-3.5 w-3.5", recording ? "text-red-500" : "text-muted-foreground")} />
              <button
                onClick={() => setRecording((r) => !r)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {recording ? "Recording" : "Not recording"}
              </button>
            </div>
          </div>

          {/* Dial pad / active call controls */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-6 pt-4 pb-2 shrink-0">
              <Input
                value={dialInput || activeLead?.phone || ""}
                onChange={(e) => setDialInput(e.target.value)}
                placeholder="(___) ___-____"
                className="h-12 text-center text-xl font-medium tabular-nums tracking-wide"
                disabled={isActive || isConnecting}
              />
            </div>

            <div className="flex-1 min-h-0 px-6 py-2 grid grid-cols-3 gap-2 content-center">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => dialOrPick(k)}
                    className={cn(
                      "h-14 rounded-2xl text-lg font-semibold tabular-nums",
                      "bg-muted/50 hover:bg-muted active:scale-95 transition-all",
                      "border border-border/50",
                    )}
                  >
                    {k}
                  </button>
                ),
              )}
            </div>

            <div className="shrink-0 px-6 pb-4 pt-2">
              {!isActive && !isConnecting && (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={backspace}
                    className="gap-1"
                  >
                    <Delete className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    onClick={startCall}
                    disabled={!canCallActive}
                    className={cn(
                      "flex-1 h-14 rounded-full text-base gap-2 shadow-md transition-all",
                      canCallActive
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : "",
                    )}
                  >
                    <Phone className="h-5 w-5" />
                    {activeLead?.consent === "dnc" ? "On DNC — cannot call" : "Call"}
                  </Button>
                  <div className="w-10" />
                </div>
              )}

              {(isActive || isConnecting) && (
                <div className="grid grid-cols-5 gap-2">
                  <Button
                    variant={muted ? "default" : "outline"}
                    size="sm"
                    className="h-12 flex-col gap-0.5 text-[10px]"
                    onClick={() => setMuted((m) => !m)}
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {muted ? "Muted" : "Mute"}
                  </Button>
                  <Button
                    variant={held ? "default" : "outline"}
                    size="sm"
                    className="h-12 flex-col gap-0.5 text-[10px]"
                    onClick={() => setHeld((h) => !h)}
                  >
                    <PauseCircle className="h-4 w-4" />
                    Hold
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 flex-col gap-0.5 text-[10px]"
                  >
                    <Hash className="h-4 w-4" />
                    Keypad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 flex-col gap-0.5 text-[10px]"
                  >
                    <Volume2 className="h-4 w-4" />
                    Audio
                  </Button>
                  <Button
                    size="sm"
                    className="h-12 flex-col gap-0.5 text-[10px] bg-red-500 hover:bg-red-600 text-white"
                    onClick={endCall}
                  >
                    <PhoneOff className="h-4 w-4" />
                    End
                  </Button>
                </div>
              )}

              {/* Caller ID selector */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">From</span>
                <Select value={callerId} onValueChange={setCallerId}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALLER_IDS.map((cid) => (
                      <SelectItem key={cid.id} value={cid.id} className="text-xs">
                        {cid.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* ----- Right: disposition + notes ----- */}
        <Card className="flex flex-col overflow-hidden p-0 gap-0">
          <div className="shrink-0 border-b px-4 py-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <NotebookPen className="h-4 w-4" />
              Call workspace
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Log disposition, drop notes into the lead timeline.
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* Live transcript placeholder */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                  Live transcript
                </h4>
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  {isActive ? (
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-3.5 w-3.5 animate-pulse" />
                      Listening... speech will stream here during the call.
                    </div>
                  ) : (
                    <span>Transcript will appear when the call connects.</span>
                  )}
                </div>
              </div>

              {/* Disposition */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                  Disposition
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { v: "interested", l: "Interested", c: "emerald" },
                    { v: "callback", l: "Callback", c: "blue" },
                    { v: "not_interested", l: "Not interested", c: "amber" },
                    { v: "voicemail", l: "Voicemail", c: "violet" },
                    { v: "no_answer", l: "No answer", c: "gray" },
                    { v: "wrong_number", l: "Wrong #", c: "red" },
                    { v: "dnc_request", l: "Asked DNC", c: "red" },
                    { v: "appt_set", l: "Appt set", c: "emerald" },
                  ].map((d) => (
                    <button
                      key={d.v}
                      onClick={() => setDisposition(d.v)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                        disposition === d.v
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background hover:bg-muted/50 border-border",
                      )}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                  Notes
                </h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivation, timeline, condition, asking price..."
                  className="min-h-[120px] text-xs resize-none"
                />
              </div>

              <Button
                className="w-full gap-1.5"
                disabled={!disposition && !notes}
                onClick={() => {
                  setDisposition("");
                  setNotes("");
                }}
              >
                <UserCheck className="h-4 w-4" />
                Save to lead timeline
              </Button>
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
