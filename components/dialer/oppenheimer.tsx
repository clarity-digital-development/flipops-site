"use client";

import { useState } from "react";
import {
  Bot,
  Sparkles,
  AudioLines,
  Activity,
  Settings2,
  PhoneIncoming,
  PhoneForwarded,
  VoicemailIcon,
  MessageSquareText,
  Clock,
  Lock,
  ChevronDown,
  ChevronRight,
  Flame,
  Mic,
  Check,
  Volume2,
  Info,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getQuietHoursForState,
  STATE_NAMES,
  type StateCode,
} from "@/lib/dialer/quiet-hours";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Oppenheimer — INBOUND AI + callback automation. No cold outbound.
//
// Pivot rationale: TCPA liability on cold outbound AI > operator benefit.
// Most value sits on the inbound side (never miss a seller call) and on
// inbound-derived callbacks (return a missed call or voicemail). Both are
// legally safe: inbound has no consent requirement at all, and returning
// an initiated contact within a reasonable window is covered without PEWC.
// ---------------------------------------------------------------------------

type PersonalityPreset = "friendly" | "professional" | "brief" | "custom";
type CallbackPolicy = "instant" | "five_min" | "fifteen_min" | "human_first";

interface Personality {
  id: PersonalityPreset;
  name: string;
  tagline: string;
  sample: string;
  prompt: string;
}

const PERSONALITIES: Personality[] = [
  {
    id: "friendly",
    name: "Friendly acquisitions",
    tagline: "Warm, conversational, rapport-first",
    sample: "Hey — thanks for calling FlipOps. I'm Alex. You've got a property you're thinking about selling?",
    prompt: `You are Alex, a warm, friendly acquisitions specialist for FlipOps.
Your first priority is rapport: ask how they're doing, listen, don't rush.
Once rapport is established, gently gather:
  • Property address
  • Reason for selling + timeline
  • Condition of the property
  • Price expectation
If they're interested, offer to schedule a human follow-up call within 24h.
Keep responses under 2 sentences. This is a phone call, not a pitch.`,
  },
  {
    id: "professional",
    name: "Professional analyst",
    tagline: "Direct, business-like, specific questions",
    sample: "Thanks for calling FlipOps. I can get you a preliminary offer in about two minutes — can I ask you a few questions about the property?",
    prompt: `You are a professional acquisitions analyst at FlipOps.
Be respectful but direct. Gather the qualification data efficiently:
  1. Property address (confirm)
  2. Reason for selling + timeline (days, weeks, months)
  3. Property condition (scale 1–5)
  4. Asking price or price range
  5. Whether other parties are involved in the decision
Book a callback with a human offer specialist if qualification is complete.
Keep responses under 2 sentences.`,
  },
  {
    id: "brief",
    name: "Brief receptionist",
    tagline: "Takes info, hands off, minimal AI footprint",
    sample: "Thanks for calling FlipOps. So I can route you to the right person — what's the property address?",
    prompt: `You are a brief receptionist for FlipOps. Your only job is to:
  1. Get the caller's name
  2. Get the property address they want to discuss
  3. Note the best callback time
Then end the call with: "A specialist will call you back within 2 hours. Thanks!"
Do not negotiate, discuss price, or qualify deeper — just collect and hand off.`,
  },
  {
    id: "custom",
    name: "Custom prompt",
    tagline: "Write your own system prompt (advanced)",
    sample: "(Your custom script preview appears here.)",
    prompt: "",
  },
];

// Voices are served by Telnyx native (Kokoro + AWS Polly via Telnyx bridge).
// ElevenLabs was dropped pre-beta — saved ~$0.15/min and one vendor dependency.
// Voice IDs map to the underlying Telnyx voice config server-side at call time.
const VOICES = [
  { id: "alex", label: "Alex", tone: "Warm, masculine" },
  { id: "jamie", label: "Jamie", tone: "Clear, neutral" },
  { id: "pat", label: "Pat", tone: "Conversational" },
  { id: "kokoro", label: "Kokoro", tone: "Fastest option" },
];

// The user's home/operating state determines the default callback hours
// surface shown in the UI. In production this resolves from the authenticated
// user's profile (Settings page). For demo/dev we default to FL to match
// the seed data. Recipients outside the home state still get their own
// stricter rule applied at call time — that's backend enforcement.
const DEMO_USER_STATE: StateCode = "FL";

// Mock live inbound calls
const LIVE_INBOUND = [
  {
    id: "ib-1",
    name: "Margaret Sullivan",
    address: "1234 Oak St, Jacksonville FL",
    duration: "1:14",
    stage: "Sharing price expectation",
    sentiment: "positive",
  },
];

const TODAY_STATS = {
  inboundHandled: 14,
  callbacksCompleted: 8,
  apptsBooked: 5,
  afterHoursSaves: 3,
};

// Completed calls surface here with AI-extracted disposition + notes
const RECENT_CALLS = [
  {
    id: "r-1",
    name: "Robert Kim",
    address: "890 Pine Rd, Tampa FL",
    minutesAgo: 12,
    source: "inbound" as const,
    disposition: "appt_set",
    sentiment: "positive",
    keyNotes: [
      "Wants to sell due to job relocation (Arizona in 6 weeks)",
      "Asking $310k; willing to negotiate",
      "Property needs new roof + HVAC (~$18k est.)",
      "Walkthrough booked Thursday 2pm",
    ],
  },
  {
    id: "r-2",
    name: "Amanda Lee",
    address: "321 Cedar Ln, Orlando FL",
    minutesAgo: 47,
    source: "callback" as const,
    disposition: "callback",
    sentiment: "neutral",
    keyNotes: [
      "Still undecided — talking to siblings",
      "Timeline 3–6 months",
      "Requested callback Monday afternoon",
    ],
  },
  {
    id: "r-3",
    name: "Unknown caller",
    address: "—",
    minutesAgo: 138,
    source: "inbound" as const,
    disposition: "voicemail",
    sentiment: "neutral",
    keyNotes: [
      "Caller hung up before stating address",
      "AI returned to main menu, no data captured",
    ],
  },
];

const DISPOSITION_LABELS: Record<string, { label: string; className: string }> = {
  appt_set: {
    label: "Appt set",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  interested: {
    label: "Interested",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  callback: {
    label: "Callback",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  },
  not_interested: {
    label: "Not interested",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  },
  voicemail: {
    label: "Voicemail/hang-up",
    className: "bg-muted text-muted-foreground border-border",
  },
  dnc_request: {
    label: "DNC requested",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60",
  },
};

export function Oppenheimer() {
  const [enabled, setEnabled] = useState(true);
  const [personality, setPersonality] = useState<PersonalityPreset>("friendly");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [greeting, setGreeting] = useState(
    "Thanks for calling FlipOps — I'm Alex. How can I help?",
  );
  const [callbacksEnabled, setCallbacksEnabled] = useState(true);
  const [callbackPolicy, setCallbackPolicy] = useState<CallbackPolicy>("five_min");
  const [customPrompt, setCustomPrompt] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const currentPersonality = PERSONALITIES.find((p) => p.id === personality)!;
  const effectivePrompt =
    personality === "custom" ? customPrompt : currentPersonality.prompt;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 pb-4">
          {/* Hero status banner */}
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
                      Inbound AI
                    </Badge>
                    {enabled && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        Live · answering
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Never miss a seller call. AI answers 24/7, qualifies, and hands warm leads to you.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {enabled ? "Active" : "Paused"}
                  </span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    aria-label="Toggle Oppenheimer"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
              <StatCell label="Inbound handled today" value={TODAY_STATS.inboundHandled} />
              <StatCell label="Callbacks today" value={TODAY_STATS.callbacksCompleted} />
              <StatCell label="Appts booked" value={TODAY_STATS.apptsBooked} emphasis />
              <StatCell label="After-hours saves" value={TODAY_STATS.afterHoursSaves} />
            </div>
          </Card>

          {/* Two columns: configuration | live monitor + recent */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
            {/* ---------- CONFIGURATION ---------- */}
            <div className="space-y-4">
              {/* Voice + Personality (side-by-side dropdowns) */}
              <Card className="p-0 gap-0 overflow-hidden">
                <div className="border-b px-5 py-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquareText className="h-4 w-4" />
                    Voice &amp; conversation style
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pick how Oppenheimer should sound and how it should speak.
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                    {/* Conversation style dropdown */}
                    <div className="min-w-0">
                      <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                        <Bot className="h-3 w-3" />
                        How should Oppenheimer sound?
                      </Label>
                      <Select
                        value={personality}
                        onValueChange={(v) => {
                          const next = v as PersonalityPreset;
                          setPersonality(next);
                          // Custom auto-opens Advanced so the prompt editor is immediately visible.
                          if (next === "custom") setAdvancedOpen(true);
                        }}
                      >
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERSONALITIES.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {p.tagline}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Voice dropdown */}
                    <div className="min-w-0">
                      <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                        <AudioLines className="h-3 w-3" />
                        Voice
                      </Label>
                      <Select value={voiceId} onValueChange={setVoiceId}>
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICES.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{v.label}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {v.tone}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Shared preview row below both dropdowns keeps the visual balance even */}
                  <div className="flex items-start gap-3 pt-1 min-h-[24px]">
                    {currentPersonality.id !== "custom" ? (
                      <p className="flex-1 text-[11px] text-foreground/70 italic leading-snug line-clamp-2">
                        "{currentPersonality.sample}"
                      </p>
                    ) : (
                      <span className="flex-1" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Volume2 className="h-3 w-3" />
                      Preview voice
                    </Button>
                  </div>

                  {/* Greeting */}
                  <div className="pt-1">
                    <Label
                      htmlFor="greeting"
                      className="text-xs font-medium mb-1.5 block"
                    >
                      Opening line
                    </Label>
                    <Input
                      id="greeting"
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Oppenheimer auto-appends "This is an automated call" where required by law.
                    </p>
                  </div>
                </div>

                {/* Advanced settings disclosure */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full border-t px-5 py-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors group">
                      <span className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                        <Settings2 className="h-3.5 w-3.5" />
                        Advanced settings
                      </span>
                      {advancedOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 py-3 border-t space-y-3 bg-muted/20">
                      <div>
                        <Label className="text-xs font-medium mb-1.5 block">
                          System prompt
                        </Label>
                        <Textarea
                          value={personality === "custom" ? customPrompt : effectivePrompt}
                          onChange={(e) => {
                            if (personality !== "custom") {
                              setPersonality("custom");
                            }
                            setCustomPrompt(e.target.value);
                          }}
                          className="min-h-[140px] text-xs font-mono resize-none"
                          placeholder={
                            personality !== "custom"
                              ? "Editing switches to Custom preset automatically."
                              : "You are a real estate acquisitions specialist..."
                          }
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Dynamic variables injected per caller: &#123;&#123;caller_name&#125;&#125;, &#123;&#123;property_address&#125;&#125;, &#123;&#123;prior_contact_note&#125;&#125;
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Callback rules */}
              <Card className="p-0 gap-0 overflow-hidden">
                <div className="border-b px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <PhoneForwarded className="h-4 w-4" />
                      Callbacks
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Automatically return missed inbound calls and voicemails. Legally safe — returning a call initiated by the seller doesn't need consent.
                    </p>
                  </div>
                  <Switch
                    checked={callbacksEnabled}
                    onCheckedChange={setCallbacksEnabled}
                    aria-label="Toggle callbacks"
                  />
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs font-medium mb-2 block">
                      When a seller's call is missed
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: "instant", label: "Call back instantly", sub: "Within 30 seconds" },
                        { id: "five_min", label: "After 5 minutes", sub: "Give humans first shot" },
                        { id: "fifteen_min", label: "After 15 minutes", sub: "Conservative" },
                        { id: "human_first", label: "Humans only", sub: "AI never calls back" },
                      ].map((opt) => {
                        const active = callbackPolicy === opt.id;
                        return (
                          <button
                            key={opt.id}
                            disabled={!callbacksEnabled}
                            onClick={() => setCallbackPolicy(opt.id as CallbackPolicy)}
                            className={cn(
                              "rounded-md border px-3 py-2 text-left transition-all",
                              active
                                ? "border-violet-400 bg-violet-50/40 dark:bg-violet-950/30 dark:border-violet-700"
                                : "border-border hover:bg-muted/40",
                              !callbacksEnabled && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{opt.label}</span>
                              {active && (
                                <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {opt.sub}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Callback hours — locked to the user's operating state */}
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-xs font-medium">
                          Callback hours in {STATE_NAMES[DEMO_USER_STATE]}
                        </Label>
                      </div>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                              <Info className="h-3 w-3" />
                              Why can't I change this?
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm text-xs leading-relaxed">
                            Calling hours are set by TCPA + state law. FlipOps pulls your operating state from Settings. If you call into a state with stricter rules, that stricter rule is enforced automatically. You can't widen these — the fine is $500–$1,500 per violating call.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold tabular-nums">
                        {getQuietHoursForState(DEMO_USER_STATE).display}
                      </span>
                      {getQuietHoursForState(DEMO_USER_STATE).stricter && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          state-stricter
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      {getQuietHoursForState(DEMO_USER_STATE).basis}
                      {getQuietHoursForState(DEMO_USER_STATE).note
                        ? ` · ${getQuietHoursForState(DEMO_USER_STATE).note}`
                        : ""}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* ---------- RIGHT RAIL ---------- */}
            <div className="space-y-4">
              {/* Live monitor */}
              <Card className="p-0 gap-0 overflow-hidden">
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-violet-500" />
                    Live right now
                  </h3>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                    {LIVE_INBOUND.length} active
                  </Badge>
                </div>
                <div className="p-3 space-y-2">
                  {LIVE_INBOUND.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No active calls right now.
                    </div>
                  ) : (
                    LIVE_INBOUND.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                          </span>
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                            {c.duration}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.address}
                        </p>
                        <p className="text-[11px] italic text-muted-foreground">
                          → {c.stage}
                        </p>
                        <div className="flex items-center gap-1 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px] flex-1"
                          >
                            <Mic className="h-3 w-3" />
                            Take over
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                          >
                            Listen
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Recent completed calls with AI disposition */}
              <Card className="p-0 gap-0 overflow-hidden">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Recent Oppenheimer calls</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Auto-classified &amp; notes extracted by AI. Click any call to review.
                  </p>
                </div>
                <ScrollArea className="max-h-[420px]">
                  <ul className="divide-y divide-border">
                    {RECENT_CALLS.map((call) => {
                      const disp = DISPOSITION_LABELS[call.disposition] ?? DISPOSITION_LABELS.voicemail;
                      return (
                        <li
                          key={call.id}
                          className="px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {call.source === "inbound" ? (
                                <PhoneIncoming className="h-3 w-3 text-blue-500 shrink-0" />
                              ) : call.source === "callback" ? (
                                <PhoneForwarded className="h-3 w-3 text-violet-500 shrink-0" />
                              ) : (
                                <VoicemailIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <p className="text-sm font-medium truncate">
                                {call.name}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {call.minutesAgo}m ago
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {call.address}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                disp.className,
                              )}
                            >
                              {disp.label}
                            </span>
                            {call.sentiment === "positive" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <Flame className="h-2.5 w-2.5" />
                                hot
                              </span>
                            )}
                          </div>
                          {call.keyNotes.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {call.keyNotes.slice(0, 2).map((n, i) => (
                                <li
                                  key={i}
                                  className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1"
                                >
                                  <span className="text-foreground/40 mt-0.5">•</span>
                                  <span className="truncate">{n}</span>
                                </li>
                              ))}
                              {call.keyNotes.length > 2 && (
                                <li className="text-[10px] text-muted-foreground italic">
                                  +{call.keyNotes.length - 2} more note{call.keyNotes.length - 2 === 1 ? "" : "s"} · click to view
                                </li>
                              )}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
                <div className="border-t px-4 py-2">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Full transcripts &amp; recordings live in the <span className="font-medium">History</span> tab and on each lead's detail page.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="px-5 py-3">
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight",
          emphasis && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}
