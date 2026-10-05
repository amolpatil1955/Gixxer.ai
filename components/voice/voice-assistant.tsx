"use client";

import { Mic, MicOff, PhoneOff, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GMark } from "@/components/brand/g-mark";
import { liveVoiceSessions, VoiceSessionManager } from "@/lib/voice/session-manager";
import type { VoiceState, VoiceTurnDto } from "@/lib/voice/types";
import { cn } from "@/lib/utils/cn";

/*
 * The voice window: the G at the centre, rings that breathe while Gixxer
 * listens, turn while it thinks and pulse while it speaks, the words of the
 * conversation underneath, and three controls. Every animation is a CSS
 * transform or opacity; the only script-driven motion is one CSS variable,
 * the loudness, written a few times a second.
 */

interface VoiceAssistantProps {
  open: boolean;
  conversationId: string | null;
  projectId: string | null;
  onConversation: (turn: VoiceTurnDto) => void;
  onClose: () => void;
}

/** The animated orb at the centre of the window. Drop the GIF at public/voice/orb.gif. */
const ORB_GIF = "/voice/orb.gif";

const TITLES: Record<VoiceState, string> = {
  idle: "Talk to Gixxer",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  reconnecting: "Reconnecting",
  denied: "Microphone blocked",
  unsupported: "Voice is not available here",
  error: "Something went wrong",
  ended: "Conversation ended",
};

const BODIES: Record<VoiceState, string> = {
  idle: "Speak naturally. Gixxer listens, answers out loud, and stops the moment you start talking.",
  connecting: "Opening the microphone and the line.",
  listening: "Go ahead. Pause when you are done and Gixxer will answer.",
  thinking: "Working on an answer.",
  speaking: "Start talking any time to interrupt.",
  reconnecting: "The connection dropped. Picking the conversation back up.",
  denied: "Allow the microphone for this site in your browser's address bar or site settings, then try again.",
  unsupported: "This browser or device cannot hold a voice conversation. Typing works everywhere.",
  error: "The call did not go through.",
  ended: "Everything you said is in the chat.",
};

export function VoiceAssistant({ open, conversationId, projectId, onConversation, onClose }: VoiceAssistantProps) {
  // One manager per window; it lives as long as the window is mounted.
  const [manager] = useState(() => new VoiceSessionManager());
  const [orbMissing, setOrbMissing] = useState(false);
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const orb = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLOListElement>(null);
  const latest = useRef({ onConversation, onClose, conversationId, projectId });
  useEffect(() => {
    latest.current = { onConversation, onClose, conversationId, projectId };
  });

  // Loudness goes straight to a CSS variable, never through React state.
  useEffect(() => {
    manager.setLevelListener((level) => orb.current?.style.setProperty("--level", level.toFixed(3)));
    return () => manager.setLevelListener(null);
  }, [manager]);

  // Opening the window starts the conversation; closing it ends it and frees the microphone.
  useEffect(() => {
    if (!open) return;
    void manager.start({
      conversationId: latest.current.conversationId,
      projectId: latest.current.projectId,
      onConversation: (turn) => latest.current.onConversation(turn),
    });
    return () => manager.stop();
  }, [open, manager]);

  useEffect(() => () => manager.dispose(), [manager]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // The newest words stay in view.
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [snapshot.lines]);

  const { state, message, muted, lines } = snapshot;
  const active = state === "listening" || state === "thinking" || state === "speaking" || state === "reconnecting" || state === "connecting";
  const failed = state === "denied" || state === "unsupported" || state === "error";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="voice-assistant"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[66] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-assistant-title"
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="relative flex w-[min(480px,100%)] flex-col rounded-[28px] border border-white/10 bg-[#07060f] px-5 pb-5 pt-6 text-white shadow-float sm:px-7"
            data-voice-assistant
            data-voice-state={state}
            data-voice-sessions={liveVoiceSessions()}
          >
            <button type="button" onClick={onClose} aria-label="Close voice window" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <X className="size-4.5" aria-hidden="true" />
            </button>

            <div ref={orb} className={cn("va-orb mx-auto mt-2", `va-${state}`)} aria-hidden="true">
              <span className="va-ring" />
              <span className="va-ring" />
              <span className="va-ring" />
              <span className="va-core">
                {/* The owner's own animated orb; the G stands in only if the file is missing. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- a GIF, animated by the browser, from our own /public */}
                {orbMissing ? <GMark className="size-9" /> : <img src={ORB_GIF} alt="" className="va-gif" onError={() => setOrbMissing(true)} />}
              </span>
            </div>
            <div className={cn("va-bars mx-auto mt-4", state === "speaking" ? "opacity-100" : "opacity-0")} aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} style={{ animationDelay: `${(index % 5) * 0.11}s` }} />
              ))}
            </div>

            <h2 id="voice-assistant-title" className="mt-4 text-center text-[18px] font-semibold tracking-[-0.01em]">
              {TITLES[state]}
            </h2>
            <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[13.5px] leading-relaxed text-white/65" role="status">
              {message ?? BODIES[state]}
            </p>

            {lines.length > 0 ? (
              <ol ref={transcript} className="scrollbar-thin mt-5 max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" aria-label="Transcript" aria-live="polite">
                {lines.map((line) => (
                  <li key={line.id} className={cn("text-[13.5px] leading-snug", line.role === "user" ? "text-white" : "text-white/75")} data-transcript-role={line.role}>
                    <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{line.role === "user" ? "You" : "Gixxer"}</span>
                    {line.text}
                    {line.partial ? <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 animate-caret bg-white/70" aria-hidden="true" /> : null}
                  </li>
                ))}
              </ol>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-2.5">
              {active ? (
                <>
                  <button
                    type="button"
                    onClick={() => manager.setMuted(!muted)}
                    aria-pressed={muted}
                    aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                    className={cn("flex size-12 items-center justify-center rounded-full border transition-colors", muted ? "border-white/40 bg-white text-black" : "border-white/20 text-white hover:bg-white/10")}
                  >
                    {muted ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => manager.stop()} aria-label="End conversation" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black transition-colors hover:bg-white/90">
                    <PhoneOff className="size-4.5" aria-hidden="true" />
                    End
                  </button>
                </>
              ) : null}
              {failed || state === "ended" ? (
                <>
                  {state !== "unsupported" ? (
                    <button
                      type="button"
                      onClick={() => void manager.start({ conversationId: latest.current.conversationId, projectId: latest.current.projectId, onConversation: (turn) => latest.current.onConversation(turn) })}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black hover:bg-white/90"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {state === "ended" ? "Start again" : "Try again"}
                    </button>
                  ) : null}
                  <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-full border border-white/20 px-5 text-[14px] text-white hover:bg-white/10">
                    Close
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
