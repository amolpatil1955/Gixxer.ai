"use client";

import { LoaderCircle, Mic, MicOff, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import type { VoiceState } from "./use-voice-input";

interface VoiceModalProps {
  state: VoiceState;
  error: string | null;
  seconds: number;
  maxSeconds: number;
  onStop: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

const TITLES: Record<Exclude<VoiceState, "idle">, string> = {
  requesting: "Allow the microphone",
  listening: "Listening",
  transcribing: "Writing it down",
  denied: "Microphone blocked",
  unsupported: "Voice is not available here",
  error: "Something went wrong",
};

const BODIES: Record<Exclude<VoiceState, "idle">, string> = {
  requesting: "Your browser is asking whether Gixxer may use the microphone. Choose Allow to dictate.",
  listening: "Speak naturally. Press stop when you are done and the words appear in the message box.",
  transcribing: "Turning your recording into text.",
  denied: "Allow the microphone for this site in your browser's address bar or site settings, then try again. Nothing is recorded until you do.",
  unsupported: "This browser or device cannot record audio for dictation. Typing works everywhere.",
  error: "The recording did not go through.",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The centred voice window: one white microphone, one state at a time. */
export function VoiceModal({ state, error, seconds, maxSeconds, onStop, onRetry, onCancel }: VoiceModalProps) {
  const open = state !== "idle";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === " " && state === "listening") {
        event.preventDefault();
        onStop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, state, onCancel, onStop]);

  const key = state === "idle" ? "requesting" : state;
  const listening = state === "listening";
  const busy = state === "requesting" || state === "transcribing";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel} role="presentation">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-title"
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-[min(420px,100%)] rounded-3xl border border-white/10 bg-[#080616] px-6 pb-6 pt-7 text-center text-white shadow-float"
            onClick={(event) => event.stopPropagation()}
            data-voice-state={state}
          >
            <button type="button" onClick={onCancel} aria-label="Close" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
              <X className="size-4.5" aria-hidden="true" />
            </button>

            <div className="relative mx-auto flex size-28 items-center justify-center">
              {listening ? (
                <>
                  <span className="voice-ring" aria-hidden="true" />
                  <span className="voice-ring" style={{ animationDelay: "0.6s" }} aria-hidden="true" />
                  <span className="voice-ring" style={{ animationDelay: "1.2s" }} aria-hidden="true" />
                </>
              ) : null}
              <span
                className={cn(
                  "relative flex size-20 items-center justify-center rounded-full border transition-colors",
                  listening ? "border-white/30 bg-white/10" : state === "denied" ? "border-[#ff8a8a]/40 bg-[#ff8a8a]/10" : "border-white/15 bg-white/5",
                )}
              >
                {busy ? (
                  <LoaderCircle className="size-9 animate-spin text-white" aria-hidden="true" />
                ) : state === "denied" || state === "unsupported" ? (
                  <MicOff className="size-9 text-white" aria-hidden="true" />
                ) : (
                  <Mic className="size-9 text-white" aria-hidden="true" />
                )}
              </span>
            </div>

            <h2 id="voice-title" className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">
              {TITLES[key]}
            </h2>
            <p className="mx-auto mt-1.5 max-w-[320px] text-[13.5px] leading-relaxed text-white/65">{state === "error" && error ? error : BODIES[key]}</p>
            {listening ? (
              <p className="mt-3 font-mono text-[13px] tabular-nums text-white/80" aria-live="polite">
                {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)} <span className="text-white/40">/ {pad(Math.floor(maxSeconds / 60))}:{pad(maxSeconds % 60)}</span>
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-2">
              {listening ? (
                <button type="button" onClick={onStop} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black hover:bg-white/90">
                  <Square className="size-3.5 fill-current" aria-hidden="true" />
                  Stop
                </button>
              ) : null}
              {state === "denied" || state === "error" ? (
                <button type="button" onClick={onRetry} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black hover:bg-white/90">
                  Try again
                </button>
              ) : null}
              {state === "requesting" || state === "transcribing" || state === "unsupported" ? (
                <button type="button" onClick={onCancel} className="inline-flex h-11 items-center rounded-full border border-white/20 px-5 text-[14px] text-white hover:bg-white/10">
                  {state === "unsupported" ? "Close" : "Cancel"}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
