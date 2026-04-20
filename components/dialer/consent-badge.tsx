"use client";

import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// ConsentBadge — the TCPA compliance indicator rendered next to every phone
// across the Dialer surface. This is a LEGAL signal, not decorative.
//
// The four states map to what's legally permissible:
//   ai_legal     — written/verbal opt-in captured → AI outbound OK
//   human_only   — no consent but not DNC → a human agent may call; AI may not
//   dnc          — DNC-registered or explicit opt-out → NO outbound calls at all
//   unknown      — no DNC check yet → treat as human_only until verified
// ---------------------------------------------------------------------------

export type ConsentState = "ai_legal" | "human_only" | "dnc" | "unknown";

const STATE_META: Record<
  ConsentState,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    short: string;
    color: string;
    tip: string;
  }
> = {
  ai_legal: {
    icon: ShieldCheck,
    label: "AI-callable",
    short: "AI OK",
    color:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    tip: "Prior express written consent on file. AI outbound calls are TCPA-compliant for this lead.",
  },
  human_only: {
    icon: ShieldAlert,
    label: "Human only",
    short: "Human",
    color:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    tip: "No documented consent. A human agent may dial (TCPA's live-caller treatment is lenient), but Oppenheimer (AI) cannot call this lead without consent.",
  },
  dnc: {
    icon: ShieldX,
    label: "Do Not Call",
    short: "DNC",
    color:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60",
    tip: "On DNC registry or explicit opt-out. No outbound calls — human or AI. Violation penalty: $500–$1,500 per call.",
  },
  unknown: {
    icon: ShieldQuestion,
    label: "Unchecked",
    short: "?",
    color:
      "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800",
    tip: "DNC scrub has not run yet. Run a scrub before dialing to avoid TCPA exposure.",
  },
};

interface ConsentBadgeProps {
  state: ConsentState;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ConsentBadge({
  state,
  size = "sm",
  showLabel = true,
  className,
}: ConsentBadgeProps) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
              size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
              meta.color,
              className,
            )}
          >
            <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
            {showLabel ? (size === "sm" ? meta.short : meta.label) : null}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">{meta.label}</p>
          <p>{meta.tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
