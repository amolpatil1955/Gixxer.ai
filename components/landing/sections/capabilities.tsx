"use client";

import { Bot, Download, FileSpreadsheet, ImageIcon, MessageSquare, RefreshCw, Shuffle, Zap } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { capabilities, landingSections, type CapabilityKey } from "@/lib/landing/content";
import { useTypewriter } from "@/lib/motion/use-typewriter";
import { cn } from "@/lib/utils/cn";
import { BRAND_MARKS, BrandMark, type BrandMarkKey } from "../primitives/brand-marks";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

const EASE = [0.22, 1, 0.36, 1] as const;
const ITEMS = capabilities.items;
const ICONS: Record<CapabilityKey, typeof MessageSquare> = { chat: MessageSquare, images: ImageIcon, files: FileSpreadsheet, bots: Bot };

/*
 * Everything inside the stage sits on a photograph, so it uses fixed light-on-dark
 * styling rather than theme tokens: the picture is dark in both themes.
 */
const hud = "border border-white/12 bg-black/55 text-white backdrop-blur-md";

/* ------------------------------------------------------------------ */
/* The live demo for each capability, shown on the stage              */
/* ------------------------------------------------------------------ */

function ChatDemo({ active }: { active: boolean }) {
  const { chat } = capabilities;
  const reply = useTypewriter(chat.reply, { active, speed: 17, delay: 350 });
  return (
    <div className="space-y-2.5">
      <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-[13px] leading-snug text-black">{chat.question}</p>
      <div className="max-w-[94%]">
        <motion.span
          initial={false}
          animate={reply.done ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/80"
        >
          <Zap className="size-2.5" aria-hidden="true" />
          {chat.handover}
        </motion.span>
        <p className="min-h-[3.2em] text-[14px] leading-relaxed text-white/90">{reply.visible}</p>
      </div>
    </div>
  );
}

function ImagesDemo() {
  const { images } = capabilities;
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55">Prompt</p>
      <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-white/90">{images.prompt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {[
          { label: images.actions[0], Icon: Download },
          { label: images.actions[1], Icon: RefreshCw },
          { label: images.actions[2], Icon: Shuffle },
        ].map(({ label, Icon }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11.5px] text-white/85">
            <Icon className="size-3" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[10px] text-white/55">{images.meta}</p>
    </div>
  );
}

function FilesDemo() {
  const { files } = capabilities;
  return (
    <div>
      <p className="flex items-center gap-2 text-[12px] text-white/80">
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        {files.file}
      </p>
      <table className="mt-2 w-full border-collapse font-mono text-[11.5px] tabular-nums">
        <thead>
          <tr className="text-left text-[9.5px] uppercase tracking-[0.16em] text-white/50">
            {files.columns.map((column) => (
              <th key={column} scope="col" className="border-b border-white/10 px-2 py-1.5 font-normal">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {files.rows.map((row, index) => {
            const lit = index === files.highlight;
            return (
              <tr key={row[0]} className={lit ? "bg-white/12 text-white" : "text-white/65"}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn("relative border-b border-white/10 px-2 py-1.5", cellIndex === 0 && "font-sans")}>
                    {lit && cellIndex === 0 ? <span className="absolute inset-y-0 left-0 w-0.5 bg-white" aria-hidden="true" /> : null}
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 flex items-center gap-2 font-mono text-[10.5px] text-white/75">
        <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
        Cited: {files.citation}
      </p>
    </div>
  );
}

function BotsDemo() {
  const { bots } = capabilities;
  return (
    <div className="space-y-2 text-[13px] leading-snug">
      <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-black">{bots.visitor}</p>
      <p className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-white/12 px-3.5 py-2 text-white/90">{bots.reply}</p>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
        Source: <span className="normal-case tracking-normal text-white/80">{bots.source}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

function MarkTile({ mark, tone }: { mark: BrandMarkKey; tone: "stage" | "page" }) {
  const name = BRAND_MARKS[mark].name;
  return (
    <li className="group/mark relative" title={name}>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl border transition-[transform,background-color] duration-300 group-hover/mark:-translate-y-0.5",
          tone === "stage" ? "border-white/12 bg-white/8 text-white/85 group-hover/mark:bg-white/15" : "plate text-ink-100",
        )}
      >
        <BrandMark mark={mark} className="size-[18px]" />
      </span>
      {tone === "stage" ? (
        <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] text-white opacity-0 transition-[opacity,transform] duration-200 group-hover/mark:translate-x-0 group-hover/mark:opacity-100">
          {name}
        </span>
      ) : (
        <span className="mt-1.5 block text-center text-[10.5px] text-ink-400">{name}</span>
      )}
      <span className="sr-only">{name}</span>
    </li>
  );
}

/** A vertical rail on the stage (desktop) or two rows under it (phones). */
function Integrations({ tone }: { tone: "stage" | "page" }) {
  const { embedsOn, connectors } = capabilities;
  const labelClass = tone === "stage" ? "text-white/55" : "text-ink-400";
  return (
    <div className={cn(tone === "stage" ? cn(hud, "flex flex-col items-center gap-2.5 rounded-2xl px-2 py-3") : "grid gap-5 sm:grid-cols-2")}>
      <div className={cn(tone === "stage" && "flex flex-col items-center gap-2")}>
        <p className={cn("font-mono text-[9px] uppercase tracking-[0.18em]", labelClass, tone === "stage" && "text-center leading-tight")}>
          {tone === "stage" ? "Embeds" : embedsOn.label}
        </p>
        <ul className={cn(tone === "stage" ? "flex flex-col gap-2" : "mt-2.5 flex gap-3")} aria-label={embedsOn.label}>
          {embedsOn.marks.map((mark) => (
            <MarkTile key={mark} mark={mark} tone={tone} />
          ))}
        </ul>
      </div>
      {tone === "stage" ? <span className="h-px w-8 bg-white/15" aria-hidden="true" /> : null}
      <div className={cn(tone === "stage" && "flex flex-col items-center gap-2")}>
        <p className={cn("flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em]", labelClass, tone === "stage" && "flex-col gap-1 text-center leading-tight")}>
          {connectors.label}
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[8.5px]", tone === "stage" ? "border-white/20 text-white/70" : "border-line text-ink-300")}>
            {tone === "stage" ? "Soon" : connectors.badge}
          </span>
        </p>
        <ul className={cn(tone === "stage" ? "flex flex-col gap-2" : "mt-2.5 flex gap-3")} aria-label={`${connectors.label}, ${connectors.badge.toLowerCase()}`}>
          {connectors.marks.map((mark) => (
            <MarkTile key={mark} mark={mark} tone={tone} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The section                                                         */
/* ------------------------------------------------------------------ */

/**
 * The product in one screen. On the left, the four capabilities as a real
 * tablist; on the right, a generated robot portrait as the stage, with a
 * status readout, the integrations rail and a live demo of the selected
 * capability. Nothing runs on a timer: the demo plays once when chosen.
 * On desktop the section fills the viewport height.
 */
export function Capabilities() {
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const inView = useInView(stage, { once: true, amount: 0.35 });
  const [active, setActive] = useState<CapabilityKey>("chat");
  const current = ITEMS.find((item) => item.key === active) ?? ITEMS[0]!;
  const { status } = capabilities;

  function onKeyDown(event: KeyboardEvent) {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    event.preventDefault();
    const index = ITEMS.findIndex((item) => item.key === active);
    const next = (index + (forward ? 1 : -1) + ITEMS.length) % ITEMS.length;
    const key = ITEMS[next]?.key;
    if (!key) return;
    setActive(key);
    tabs.current[next]?.focus();
  }

  return (
    <section
      id={landingSections.capabilities}
      className="relative scroll-mt-24 overflow-hidden px-5 py-16 sm:px-8 sm:py-24 lg:flex lg:min-h-svh lg:scroll-mt-0 lg:items-center lg:py-20"
    >
      <div className="pointer-events-none absolute right-[-10%] top-1/2 h-[80vmin] w-[80vmin] -translate-y-1/2 rounded-full glow-warm blur-2xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklab, var(--color-ink-50) 10%, transparent) 1px, transparent 1.3px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 60% 70% at 70% 50%, black, transparent 75%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14">
        {/* Left: the capabilities */}
        <div className="min-w-0">
          <SectionHeading
            index={capabilities.index}
            eyebrow={capabilities.eyebrow}
            title={capabilities.title}
            accent={capabilities.accent}
            description={capabilities.description}
            accentBreak
          />

          <Reveal delay={0.08} className="mt-8 sm:mt-10">
            <div role="tablist" aria-label="Capabilities" aria-orientation="vertical" onKeyDown={onKeyDown} className="space-y-1.5">
              {ITEMS.map((item, index) => {
                const Icon = ICONS[item.key];
                const selected = item.key === active;
                return (
                  <button
                    key={item.key}
                    ref={(node) => {
                      tabs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`cap-tab-${item.key}`}
                    aria-selected={selected}
                    aria-controls="cap-stage"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(item.key)}
                    className={cn(
                      "group relative flex w-full items-center gap-4 rounded-2xl border px-3.5 py-3 text-left transition-[background-color,border-color] duration-300",
                      selected ? "plate border-line-strong" : "border-transparent hover:bg-ink-900/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300",
                        selected ? "border-transparent bg-ink-50 text-ink-950" : "border-line bg-ink-900 text-ink-300 group-hover:text-ink-50",
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2.5">
                        <span className={cn("text-[15.5px] font-semibold tracking-[-0.015em] transition-colors", selected ? "text-ink-50" : "text-ink-200")}>{item.title}</span>
                        <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500 sm:inline">{item.label}</span>
                      </span>
                      <AnimatePresence initial={false}>
                        {selected ? (
                          <motion.span
                            key="detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="block overflow-hidden"
                          >
                            <span className="block pt-1 text-[13.5px] leading-snug text-ink-300">{item.detail}</span>
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.12} className="mt-7 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">Runs on</span>
            {capabilities.providers.map((provider) => (
              <span key={provider} className="rounded-full border border-line bg-ink-900/70 px-3 py-1 text-[12.5px] font-medium text-ink-100">
                {provider}
              </span>
            ))}
          </Reveal>
        </div>

        {/* Right: the stage */}
        <Reveal delay={0.05} className="min-w-0">
          <div
            ref={stage}
            className="relative h-[580px] overflow-hidden rounded-[28px] border border-line-strong bg-black shadow-float sm:h-[640px] lg:h-[min(740px,calc(100svh-9rem))] lg:min-h-[560px]"
          >
            <Image
              src="/robot-hero.webp"
              alt={capabilities.alt}
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover object-[50%_28%]"
            />
            {/* Light and depth over the photograph */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_35%,rgba(0,0,0,0.55)_100%)]" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-linear-to-t from-black via-black/70 to-transparent" aria-hidden="true" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 0.8px, transparent 1.1px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(to bottom, black, transparent 55%)" }}
              aria-hidden="true"
            />
            {/* Viewfinder corners */}
            {["left-4 top-4 border-l border-t", "right-4 top-4 border-r border-t", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((corner) => (
              <span key={corner} className={cn("pointer-events-none absolute size-5 rounded-[3px] border-white/40", corner)} aria-hidden="true" />
            ))}

            {/* Status */}
            <div className="absolute left-7 top-7 flex flex-wrap items-center gap-2" aria-hidden="true">
              <span className={cn(hud, "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px] font-medium")}>
                <span className="relative size-6 overflow-hidden rounded-full border border-white/20">
                  <Image src="/robot-hero.webp" alt="" fill sizes="24px" className="object-cover object-[45%_30%]" />
                </span>
                {status.name}
                <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/70">
                  <span className="size-1.5 rounded-full bg-[#28c840]" />
                  {status.state}
                </span>
              </span>
              <span className={cn(hud, "hidden rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] sm:inline-flex")}>{status.models}</span>
            </div>

            {/* Integrations rail, desktop */}
            <div className="absolute right-7 top-7 hidden lg:block">
              <Integrations tone="stage" />
            </div>

            {/* The live demo of the selected capability */}
            <div
              role="tabpanel"
              id="cap-stage"
              aria-labelledby={`cap-tab-${current.key}`}
              className={cn(hud, "absolute inset-x-4 bottom-4 rounded-2xl p-4 sm:inset-x-7 sm:bottom-7 sm:p-5 lg:right-auto lg:w-[min(440px,calc(100%-9.5rem))]")}
            >
              <p className="mb-3 flex items-center justify-between gap-3 font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/55">
                <span>{current.label}</span>
                {current.key === "images" ? <span className="normal-case tracking-normal text-white/50">{capabilities.images.note}</span> : null}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={current.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE }}>
                  {current.key === "chat" ? <ChatDemo active={inView} /> : null}
                  {current.key === "images" ? <ImagesDemo /> : null}
                  {current.key === "files" ? <FilesDemo /> : null}
                  {current.key === "bots" ? <BotsDemo /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Integrations, phones and tablets */}
          <div className="mt-6 lg:hidden">
            <Integrations tone="page" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
