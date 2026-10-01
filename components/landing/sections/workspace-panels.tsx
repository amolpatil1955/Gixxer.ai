"use client";

import { ArrowUpRight, Check, Download, FileSpreadsheet, FileText, Paperclip, RefreshCw, Send, Shuffle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { showcase } from "@/lib/landing/content";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { useTypewriter } from "@/lib/motion/use-typewriter";
import { cn } from "@/lib/utils/cn";

/*
 * The four workspace views, drawn in an editor's dark palette because they
 * live on a laptop screen. These colours are the mockup's content, like a
 * photograph would be, and do not follow the page theme.
 */
export const vs = {
  editor: "#1e1e1e",
  panel: "#252526",
  bar: "#333333",
  border: "#3c3c3c",
  text: "#d4d4d4",
  muted: "#8b8b8b",
  accent: "#3794ff",
  status: "#007acc",
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

function Row({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px]"
      style={{ borderColor: vs.border, color: accent ? "#fff" : vs.muted, background: accent ? vs.accent : "transparent" }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function ChatPanel() {
  const { chat } = showcase;
  const reply = useTypewriter(chat.assistantMessage, { active: true, speed: 13, delay: 600 });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 p-4 sm:p-6">
        <Row className="ml-auto max-w-[88%] sm:max-w-[70%]">
          <div className="rounded-xl rounded-br-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-white" style={{ background: vs.accent }}>
            {chat.userMessage}
          </div>
          <div className="mt-1.5 flex justify-end">
            <Chip>
              <Paperclip className="size-3" aria-hidden="true" />
              {chat.attachment}
            </Chip>
          </div>
        </Row>

        <Row delay={0.35} className="flex max-w-[94%] gap-3 sm:max-w-[82%]">
          <span className="relative mt-0.5 size-7 shrink-0 overflow-hidden rounded-md" style={{ background: vs.bar }}>
            <Image src="/robot.webp" alt="" fill sizes="28px" className="object-cover" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: vs.muted }}>
              Gixxer · {chat.models[0]} <span style={{ color: vs.border }}>·</span> {chat.models[1]} standby
            </p>
            <p className="mt-1.5 min-h-20 text-[13px] leading-relaxed" style={{ color: vs.text }}>
              {reply.visible}
            </p>
            <motion.div initial={false} animate={reply.done ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }} transition={{ duration: 0.35 }} className="mt-2.5">
              <Chip>
                <span className="size-1.5 rounded-full" style={{ background: vs.accent }} />
                Source: {chat.citation}
              </Chip>
            </motion.div>
          </div>
        </Row>
      </div>

      <div className="p-3 sm:p-4" aria-hidden="true">
        <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5" style={{ borderColor: vs.border, background: vs.panel }}>
          <Paperclip className="size-4" style={{ color: vs.muted }} />
          <span className="flex-1 text-[12.5px]" style={{ color: vs.muted }}>
            Message Gixxer…
          </span>
          <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: vs.accent }}>
            <Send className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ImagesPanel() {
  const { images } = showcase;
  const reduceMotion = usePrefersReducedMotion();
  const [resolved, setResolved] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setResolved(true), 1500);
    return () => window.clearTimeout(id);
  }, [reduceMotion]);

  return (
    <div className="flex h-full flex-col p-4 sm:p-6">
      <Row>
        <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5" style={{ borderColor: vs.border, background: vs.panel }}>
          <Sparkles className="size-4 shrink-0" style={{ color: vs.accent }} aria-hidden="true" />
          <span className="flex-1 truncate text-[12.5px]" style={{ color: vs.text }}>
            {images.prompt}
          </span>
          <Chip>{images.size}</Chip>
        </div>
      </Row>

      <Row delay={0.12} className="mt-4 flex flex-1 items-center justify-center gap-4">
        {/* The frame is the final size from the first frame, so nothing moves when the image arrives. */}
        <div className="relative aspect-[4/5] h-full max-h-[300px] overflow-hidden rounded-lg border" style={{ borderColor: vs.border, background: vs.panel }}>
          <motion.div initial={false} animate={{ opacity: resolved ? 1 : 0, scale: resolved ? 1 : 1.04 }} transition={{ duration: 0.9, ease: EASE }} className="absolute inset-0">
            <Image src="/robot.webp" alt={images.alt} fill sizes="(min-width: 640px) 240px, 60vw" className="object-cover" priority={false} />
          </motion.div>
          {!resolved ? (
            <div className="absolute inset-x-0 top-0 h-px overflow-hidden" style={{ background: vs.border }}>
              <motion.span className="block h-full" style={{ background: vs.accent }} initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.5, ease: "linear" }} />
            </div>
          ) : null}
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
            {resolved ? <Check className="size-3" aria-hidden="true" /> : null}
            {resolved ? images.size : "Generating"}
          </span>
        </div>
        <div className="hidden w-40 space-y-2 sm:block">
          {[
            { label: images.actions[0], Icon: Download },
            { label: images.actions[1], Icon: RefreshCw },
            { label: images.actions[2], Icon: Shuffle },
          ].map(({ label, Icon }) => (
            <span key={label} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]" style={{ borderColor: vs.border, color: vs.text }}>
              <Icon className="size-3.5" style={{ color: vs.muted }} aria-hidden="true" />
              {label}
            </span>
          ))}
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: vs.muted }}>
            {images.meta.join(" · ")}
          </p>
        </div>
      </Row>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function FilesPanel() {
  const { files } = showcase;
  const answer = useTypewriter(files.answer, { active: true, speed: 13, delay: 800 });

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="border-b p-4 lg:border-b-0 lg:border-r lg:p-5" style={{ borderColor: vs.border }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: vs.muted }}>
          Library
        </p>
        <ul className="mt-3 space-y-1.5">
          {files.items.map((item, index) => {
            const Icon = item.name.endsWith(".pdf") ? FileText : FileSpreadsheet;
            return (
              <motion.li
                key={item.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.07, ease: EASE }}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
                style={{ background: vs.panel }}
              >
                <Icon className="size-4 shrink-0" style={{ color: vs.accent }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]" style={{ color: vs.text }}>
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px]" style={{ color: vs.muted }}>
                    {item.detail}
                  </span>
                </span>
                <Chip>{item.state}</Chip>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col p-4 lg:p-5">
        <Row delay={0.15}>
          <p className="ml-auto w-fit max-w-[90%] rounded-xl rounded-br-sm px-3.5 py-2 text-[12.5px] text-white" style={{ background: vs.accent }}>
            {files.question}
          </p>
        </Row>
        <Row delay={0.45} className="mt-4">
          <p className="min-h-14 text-[13px] leading-relaxed" style={{ color: vs.text }}>
            {answer.visible}
          </p>
        </Row>
        <motion.ul initial={false} animate={answer.done ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }} transition={{ duration: 0.35 }} className="mt-auto space-y-1.5 pt-4">
          {files.citations.map((citation) => (
            <li key={citation} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10.5px]" style={{ borderColor: vs.border, color: vs.text }}>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: vs.accent }} />
              <span className="truncate">{citation}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ChatbotPanel() {
  const { chatbot } = showcase;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="border-b p-4 lg:border-b-0 lg:border-r lg:p-5" style={{ borderColor: vs.border }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: vs.muted }}>
          Your bots
        </p>
        <ul className="mt-3 space-y-1.5">
          {chatbot.bots.map((bot, index) => {
            const active = bot.name === chatbot.activeBot;
            return (
              <motion.li
                key={bot.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.07, ease: EASE }}
                className="flex items-center gap-2.5 rounded-md border px-2.5 py-2"
                style={{ borderColor: active ? vs.accent : vs.border, background: vs.panel }}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: active ? vs.accent : vs.bar }}>
                  {bot.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]" style={{ color: vs.text }}>
                    {bot.name}
                  </span>
                  <span className="block truncate text-[11px]" style={{ color: vs.muted }}>
                    {bot.business}
                  </span>
                </span>
                <Chip accent={bot.status === "Live"}>{bot.status}</Chip>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col p-4 lg:p-5">
        <div className="flex items-center gap-2">
          <p className="text-[12.5px] font-medium" style={{ color: vs.text }}>
            {chatbot.activeBot}
          </p>
          <Chip>{chatbot.bots[0]?.conversations}</Chip>
          <ArrowUpRight className="ml-auto size-4" style={{ color: vs.muted }} aria-hidden="true" />
        </div>
        <div className="mt-4 space-y-2">
          {chatbot.transcript.map((line, index) => (
            <Row key={line.text} delay={0.15 + index * 0.22}>
              <p
                className={cn("w-fit max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-snug", line.from === "visitor" ? "ml-auto rounded-br-sm text-white" : "rounded-bl-sm")}
                style={line.from === "visitor" ? { background: vs.accent } : { background: vs.panel, color: vs.text }}
              >
                {line.text}
              </p>
            </Row>
          ))}
        </div>
        <Row delay={0.65} className="mt-auto pt-4">
          <Chip>
            <span className="size-1.5 rounded-full" style={{ background: vs.accent }} />
            {chatbot.sourceNote}
          </Chip>
        </Row>
      </div>
    </div>
  );
}
