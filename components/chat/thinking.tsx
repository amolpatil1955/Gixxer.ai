"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface ThinkingProps {
  reasoning: string;
  /** The reply is still streaming and no answer text has arrived yet: the model is thinking right now. */
  thinking: boolean;
}

/**
 * The model's reasoning in Think mode. Open while it thinks, folded once the
 * answer starts, and always a click away afterwards.
 */
export function Thinking({ reasoning, thinking }: ThinkingProps) {
  const [open, setOpen] = useState<boolean | null>(null);
  const [wasThinking, setWasThinking] = useState(thinking);
  // Fold automatically when the answer starts, unless the reader has taken control.
  if (wasThinking !== thinking) {
    setWasThinking(thinking);
    if (open === null || open) setOpen(thinking ? true : null);
  }
  const expanded = open ?? thinking;
  if (!reasoning && !thinking) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-ink-900/60" data-thinking={thinking ? "true" : "false"}>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-ink-200 hover:bg-ink-800/60"
      >
        <Sparkles className={cn("size-3.5", thinking ? "animate-pulse-soft text-ink-50" : "text-ink-400")} aria-hidden="true" />
        {thinking ? <span className="text-thinking animate-thinking font-medium">Booster is thinking</span> : <span className="font-medium">Thought process</span>}
        <ChevronDown className={cn("ml-auto size-4 text-ink-400 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="scrollbar-thin max-h-64 overflow-y-auto border-t border-line px-4 py-3 text-[13px] leading-relaxed text-ink-300 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {reasoning || "…"}
        </div>
      ) : null}
    </div>
  );
}
