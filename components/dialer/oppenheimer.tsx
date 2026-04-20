"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  Clock,
  AudioLines,
  FileText,
  Play,
  Pause,
  Users,
  Flame,
  Info,
  AlertTriangle,
  Activity,
  Phone,
  Mic,
  Volume2,
  Settings2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ConsentBadge } from "./consent-badge";

// ---------------------------------------------------------------------------
// Oppenheimer — the AI voice dialer. Runs on Telnyx AI Assistants with an
// ElevenLabs voice. Its superpower AND its legal exposure is the same thing:
// it speaks to sellers on your behalf.
//
// This component enforces TCPA compliance at the UX layer:
//   1. Only leads with consent state = "ai_legal" are callable
//   2. Four compliance gates must be checked to launch a campaign
//   3. Calling hours are enforced per recipient timezone
//   4. DNC scrub runs before launch and every 7 days during
// ---------------------------------------------------------------------------

type InboundMode = "ai_answer" | "route_to_human" | "voicemail";

const VOICES = [
  {
    id: "oppenheimer-alex",
    name: "Alex · Friendly acquisitions",
    provider: "ElevenLabs",
    preview: "Hey, this is Alex with FlipOps. Got a quick question about your property...",
  },
  {
    id: "oppenheimer-jamie",
    name: "Jamie · Professional",
    provider: "ElevenLabs",
    preview: "Hi, I'm Jamie calling from FlipOps regarding the property at...",
  },
  {
    id: "oppenheimer-pat",
    name: "Pat · Conversational",
    provider: "ElevenLabs",
    preview: "Hi there, Pat from FlipOps. Got a second?",
  },
  {
    id: "telnyx-kokoro",
    name: "Kokoro · Telnyx TTS (no extra cost)",
    provider: "Telnyx",
    preview: "Telnyx default voice — cheapest option.",
  },
];

interface AudienceLead {
  id: string;
  name: string;
  phone: string;
  score: number;
  consent: "ai_legal" | "human_only" | "dnc" | "unknown";
}

const DEMO_AUDIENCE: AudienceLead[] = [
  { id: "al-1", name: "Margaret Sullivan", phone: "+19045551234", score: 92, consent: "ai_legal" },
  { id: "al-2", name: "James Rodriguez", phone: "+14075559876", score: 89, consent: "ai_legal" },
  { id: "al-3", name: "Patricia Chen", phone: "+18135554321", score: 85, consent: "ai_legal" },
  { id: "al-4", name: "David Park", phone: "+12795556655", score: 81, consent: "human_only" },
  { id: "al-5", name: "Maria Lopez", phone: "+13055550987", score: 78, consent: "human_only" },
  { id: "al-6", name: "Unknown Owner", phone: "+17275552211", score: 77, consent: "unknown" },
  { id: "al-7", name: "Robert Kim", phone: "+14075558800", score: 74, consent: "ai_legal" },
  { id: "al-8", name: "Jessie Brown", phone: "+18135559933", score: 71, consent: "dnc" },
];

const LIVE_CALLS = [
  {
    id: "live-1",
    name: "Margaret Sullivan",
    duration: "0:42",
    stage: "Qualifying motivation",
    sentiment: "positive",
  },
  {
    id: "live-2",
    name: "Robert Kim",
    duration: "1:18",
    stage: "Negotiating timeline",
    sentiment: "neutral",
  },
];

const RESULTS = [
  { label: "Completed", value: 47, tone: "text-foreground" },
  { label: "Interested", value: 11, tone: "text-emerald-600 dark:text-emerald-400" },
  { label: "Appt set", value: 4, tone: "text-emerald-600 dark:text-emerald-400" },
  { label: "Callback req", value: 8, tone: "text-blue-600 dark:text-blue-400" },
  { label: "Not interested", value: 18, tone: "text-amber-600 dark:text-amber-400" },
  { label: "Voicemail", value: 6, tone: "text-muted-foreground" },
];

export function Oppenheimer() {
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [campaignName, setCampaignName] = useState("Pre-FC outreach · Jacksonville");
  const [script, setScript] = useState(
    `You are Alex, an acquisitions specialist for FlipOps — a real-estate investment company that buys houses for cash.\n\nYour goal on this outbound call: confirm the property owner is still considering selling, ask about their timeline and price expectation, and if they're interested, schedule a callback with a human acquisitions agent.\n\nDynamic variables available:\n  {{owner_name}} — how to greet them\n  {{property_address}} — the property you're calling about\n  {{prior_contact_note}} — how they opted in (web form, prior inbound call, etc.)\n\nCRITICAL: This is a recorded call. If the caller asks to be removed, immediately say "I'll take you off our list right now" and call the end_call tool with reason="dnc_request".`,
  );
  const [inboundMode, setInboundMode] = useState<InboundMode>("ai_answer");
  const [quietHoursStart, setQuietHoursStart] = useState("09:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("19:00");
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  // Compliance gates — campaign cannot launch unless all checked
  const [consentVerified, setConsentVerified] = useState(false);
  const [dncScrubbed, setDncScrubbed] = useState(false);
  const [disclosureEnabled, setDisclosureEnabled] = useState(true);
  const [optOutEnabled, setOptOutEnabled] = useState(true);

  const audience = DEMO_AUDIENCE;
  const audienceBreakdown = useMemo(() => {
    const callable = audience.filter((a) => a.consent === "ai_legal");
    const skipped = audience.filter((a) => a.consent !== "ai_legal");
    return { callable, skipped };
  }, [audience]);

  const launchReady =
    consentVerified &&
    dncScrubbed &&
    disclosureEnabled &&
    optOutEnabled &&
    audienceBreakdown.callable.length > 0;

  const launchBlockedReasons: string[] = [];
  if (!consentVerified) launchBlockedReasons.push("Consent records not verified");
  if (!dncScrubbed) launchBlockedReasons.push("DNC scrub hasn't run");
  if (!disclosureEnabled) launchBlockedReasons.push("AI disclosure is required by law");
  if (!optOutEnabled) launchBlockedReasons.push("Opt-out keyword must be enabled");
  if (audienceBreakdown.callable.length === 0)
    launchBlockedReasons.push("Audience has 0 AI-consented leads");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 pb-4">
          {/* ----- Hero banner ----- */}
          <Card className="overflow-hidden p-0 gap-0 border-violet-200/60 dark:border-violet-900/60">
            <div className="bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Oppenheimer</h2>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-violet-300 text-violet-700 dark:text-violet-300 dark:border-violet-700"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Dialer
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Outbound AI voice calls via Telnyx + ElevenLabs. Runs only against consented leads.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Live monitor
                </Button>
                <Button
                  size="sm"
                  disabled={!launchReady}
                  className={cn(
                    "gap-1.5",
                    launchReady
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "",
                  )}
                >
                  <Play className="h-3.5 w-3.5" />
                  Launch campaign
                </Button>
              </div>
            </div>

            {!launchReady && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border-t border-amber-200/60 dark:border-amber-900/40 px-6 py-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Launch blocked: {launchBlockedReasons.join(" · ")}
                </p>
              </div>
            )}
          </Card>

          {/* ----- Compliance rail (TCPA gates) ----- */}
          <Card className="p-0 gap-0 overflow-hidden">
            <div className="border-b px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  TCPA compliance rail
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  All four must be true before Oppenheimer places a single outbound call.
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  launchReady
                    ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-300 text-amber-700 dark:text-amber-300",
                )}
              >
                {launchReady ? "Cleared" : "Action required"}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <GateRow
                checked={consentVerified}
                onToggle={() => setConsentVerified((v) => !v)}
                title="Consent records verified"
                body="Every lead in the audience has documented prior express written consent (website opt-in, signed form, or inbound call)."
              />
              <GateRow
                checked={dncScrubbed}
                onToggle={() => setDncScrubbed((v) => !v)}
                title="DNC scrub run within 7 days"
                body="Federal + state Do-Not-Call registries checked. Re-scrub runs automatically every 7 days during the campaign."
              />
              <GateRow
                checked={disclosureEnabled}
                onToggle={() => setDisclosureEnabled((v) => !v)}
                title="AI identifies itself (required)"
                body="First utterance includes 'This is an automated call from FlipOps.' Mandatory under the FCC Feb 2024 ruling."
              />
              <GateRow
                checked={optOutEnabled}
                onToggle={() => setOptOutEnabled((v) => !v)}
                title="Opt-out path enabled"
                body="If the seller says 'stop,' 'remove me,' or presses 9, Oppenheimer calls end_call with reason=dnc_request and writes the number to the opt-out list."
              />
            </div>
          </Card>

          {/* ----- Two-column: builder + audience ----- */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            {/* Campaign builder */}
            <Card className="p-0 gap-0 overflow-hidden">
              <div className="border-b px-5 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Settings2 className="h-4 w-4" />
                  Campaign
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="camp-name" className="text-xs">
                    Campaign name
                  </Label>
                  <Input
                    id="camp-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <AudioLines className="h-3 w-3" />
                      Voice
                    </Label>
                    <Select value={voiceId} onValueChange={setVoiceId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICES.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground -ml-2"
                    >
                      <Volume2 className="h-3 w-3" />
                      Preview voice
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Inbound behavior
                    </Label>
                    <Select
                      value={inboundMode}
                      onValueChange={(v) => setInboundMode(v as InboundMode)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_answer" className="text-xs">
                          AI answers &amp; qualifies
                        </SelectItem>
                        <SelectItem value="route_to_human" className="text-xs">
                          Route to a human agent
                        </SelectItem>
                        <SelectItem value="voicemail" className="text-xs">
                          Send to voicemail
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Inbound always legal — no consent gate applies.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Quiet hours start
                    </Label>
                    <Input
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <Label className="text-xs">Quiet hours end</Label>
                    <Input
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <Label className="text-xs">Max concurrent</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxConcurrent}
                      onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-blue-200/60 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Calling hours are enforced in each recipient's local timezone. Federal floor is 8am–9pm; FlipOps defaults to 9am–7pm to stay inside state-level restrictions (FL, OK, WA).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    System prompt
                  </Label>
                  <Textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="min-h-[160px] text-xs font-mono resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Dynamic variables resolve per caller from the CRM at call start.
                  </p>
                </div>
              </div>
            </Card>

            {/* Audience side */}
            <Card className="p-0 gap-0 overflow-hidden">
              <div className="border-b px-5 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Audience
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {audience.length} leads · {audienceBreakdown.callable.length} callable by AI
                </p>
              </div>

              {/* Audience breakdown */}
              <div className="border-b px-5 py-3 grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {audienceBreakdown.callable.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    AI-legal
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
                    {audienceBreakdown.skipped.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Skipped
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
                <ul className="divide-y divide-border">
                  {audience.map((lead) => {
                    const willCall = lead.consent === "ai_legal";
                    return (
                      <li
                        key={lead.id}
                        className={cn(
                          "px-5 py-2.5 flex items-center gap-3",
                          !willCall && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            willCall ? "bg-emerald-500" : "bg-muted-foreground/40",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {lead.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {lead.phone}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums shrink-0">
                          {lead.score}
                        </span>
                        <ConsentBadge state={lead.consent} showLabel={false} />
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>

              <div className="border-t px-5 py-2">
                <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                  Import from Leads →
                </Button>
              </div>
            </Card>
          </div>

          {/* ----- Live monitor + results summary ----- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Live monitor */}
            <Card className="lg:col-span-2 p-0 gap-0 overflow-hidden">
              <div className="border-b px-5 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-violet-500" />
                  Live calls
                </h3>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {LIVE_CALLS.length} active
                </Badge>
              </div>
              <div className="p-4 space-y-2">
                {LIVE_CALLS.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border px-3 py-2.5 flex items-center gap-3"
                  >
                    <div className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.stage}
                      </p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {c.duration}
                    </span>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
                        c.sentiment === "positive"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Flame className="h-2.5 w-2.5" />
                      {c.sentiment}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                      <Mic className="h-3 w-3" />
                      Barge
                    </Button>
                  </div>
                ))}
                {LIVE_CALLS.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No active calls. Launch a campaign to start dialing.
                  </div>
                )}
              </div>
            </Card>

            {/* Results summary */}
            <Card className="p-0 gap-0 overflow-hidden">
              <div className="border-b px-5 py-3">
                <h3 className="text-sm font-semibold">Last 24h results</h3>
              </div>
              <ul className="divide-y divide-border">
                {RESULTS.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-center justify-between px-5 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                    <span className={cn("text-lg font-semibold tabular-nums", r.tone)}>
                      {r.value}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------

function GateRow({
  checked,
  onToggle,
  title,
  body,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors",
        checked ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "hover:bg-muted/30",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
          {body}
        </p>
      </div>
    </label>
  );
}
