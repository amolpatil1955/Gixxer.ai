"use client";

import { ArrowLeft, ArrowRight, Check, Copy, FileText, Globe, MessageCircle, SendHorizontal, ShieldCheck, Type, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/lib/auth/routes";
import { botPurposes, botTones, deploy, landingSections, type BotPurposeKey, type BotToneKey, type PlatformKey } from "@/lib/landing/content";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { useTypewriter } from "@/lib/motion/use-typewriter";
import { cn } from "@/lib/utils/cn";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = deploy.steps;
const MAX_NAME = 18;

interface Setup {
  name: string;
  business: string;
  purpose: BotPurposeKey;
  tone: BotToneKey;
  side: "left" | "right";
}

function displayName(setup: Setup): string {
  return setup.name.trim() || deploy.defaults.name;
}

/** The welcome line the dashboard drafts from the name, business, purpose and tone. */
function welcomeFor(setup: Setup): string {
  const name = displayName(setup);
  const business = setup.business.trim() || deploy.defaults.business;
  const line = botPurposes.find((purpose) => purpose.key === setup.purpose)?.line ?? botPurposes[0].line;
  switch (setup.tone) {
    case "professional":
      return `Good day. This is ${name}, the assistant for ${business}. ${line}`;
    case "concise":
      return `${name}, ${business}. ${line}`;
    default:
      return `Hi! I'm ${name} from ${business}. ${line}`;
  }
}

function snippetFor(platform: PlatformKey): string {
  if (platform === "nextjs") {
    return `import Script from "next/script";\n\n<Script\n  src="https://gixxer.ai/widget.js"\n  data-bot="${deploy.botKey}"\n  strategy="lazyOnload"\n/>`;
  }
  return `<script\n  src="https://gixxer.ai/widget.js"\n  data-bot="${deploy.botKey}"\n  async\n></script>`;
}

const pill = (active: boolean) =>
  cn(
    "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
    active ? "border-transparent bg-ink-50 text-ink-950" : "border-line-strong bg-ink-900 text-ink-200 hover:border-ink-400 hover:text-ink-50",
  );

const label = "font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400";

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function Frame({ url, badge, children, ariaLabel }: { url: string; badge?: ReactNode; children: ReactNode; ariaLabel?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl edge-lit shadow-float" aria-label={ariaLabel} role={ariaLabel ? "region" : undefined}>
      <div className="flex h-10 items-center gap-2 border-b border-line bg-ink-900/70 px-3.5">
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="ml-2 flex min-w-0 items-center gap-1.5 truncate rounded-md border border-line px-2 py-0.5 font-mono text-[10.5px] text-ink-300">
          <ShieldCheck className="size-3 shrink-0 text-ink-400" aria-hidden="true" />
          <span className="truncate">{url}</span>
        </span>
        {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
      </div>
      <div className="bg-ink-950">{children}</div>
    </div>
  );
}

function Avatar({ setup, size = "md" }: { setup: Setup; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-ink-50 font-display font-black italic uppercase text-ink-950",
        size === "sm" ? "size-7 text-[12px]" : "size-10 text-[15px]",
      )}
      aria-hidden="true"
    >
      {displayName(setup)[0]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: name and purpose                                            */
/* ------------------------------------------------------------------ */

function IdentityPanel({ setup, onChange }: { setup: Setup; onChange: (next: Setup) => void }) {
  return (
    <Frame url={`gixxer.ai/app/chatbots/${displayName(setup).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "new"}/settings`}>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="deploy-bot-name" className="block text-[12.5px] font-medium text-ink-200">
                Bot name
              </label>
              <input
                id="deploy-bot-name"
                value={setup.name}
                maxLength={MAX_NAME}
                onChange={(event) => onChange({ ...setup, name: event.target.value })}
                placeholder={deploy.defaults.name}
                className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink-900 px-3 text-[14px] text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-line-strong focus:border-ink-300"
              />
            </div>
            <div>
              <label htmlFor="deploy-business" className="block text-[12.5px] font-medium text-ink-200">
                Business
              </label>
              <input
                id="deploy-business"
                value={setup.business}
                maxLength={40}
                onChange={(event) => onChange({ ...setup, business: event.target.value })}
                placeholder={deploy.defaults.business}
                className="mt-1.5 h-10 w-full rounded-xl border border-line bg-ink-900 px-3 text-[14px] text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-line-strong focus:border-ink-300"
              />
            </div>
          </div>
          <fieldset>
            <legend className="text-[12.5px] font-medium text-ink-200">Purpose</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {botPurposes.map((purpose) => (
                <button key={purpose.key} type="button" aria-pressed={setup.purpose === purpose.key} onClick={() => onChange({ ...setup, purpose: purpose.key })} className={pill(setup.purpose === purpose.key)}>
                  {purpose.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[12.5px] font-medium text-ink-200">Tone</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {botTones.map((tone) => (
                <button key={tone.key} type="button" aria-pressed={setup.tone === tone.key} onClick={() => onChange({ ...setup, tone: tone.key })} className={pill(setup.tone === tone.key)}>
                  {tone.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* What the visitor will read first. */}
        <div className="rounded-2xl border border-line bg-ink-900/60 p-4">
          <p className={label}>Welcome line</p>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar setup={setup} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-medium text-ink-50">{displayName(setup)}</p>
              <p className="truncate text-[11.5px] text-ink-400">{setup.business.trim() || deploy.defaults.business}</p>
            </div>
          </div>
          <p className="mt-3 rounded-xl rounded-tl-sm bg-ink-800 px-3 py-2.5 text-[13px] leading-snug text-ink-100" aria-live="polite">
            {welcomeFor(setup)}
          </p>
          <p className="mt-3 text-[11.5px] leading-snug text-ink-400">Drafted from your answers. You can rewrite it any time.</p>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: train                                                       */
/* ------------------------------------------------------------------ */

const SOURCE_ICONS = { URL: Globe, PDF: FileText, Text: Type } as const;
const INDEX_STEP = 0.45;
const INDEX_DURATION = 1.1;

function TrainPanel({ setup }: { setup: Setup }) {
  const reduceMotion = usePrefersReducedMotion();
  const [finished, setFinished] = useState(false);
  const done = reduceMotion || finished;
  const total = deploy.sources.reduce((sum, source) => sum + source.passages, 0);

  // One timer for the whole indexing run; it never repeats.
  useEffect(() => {
    if (reduceMotion) return;
    const ms = ((deploy.sources.length - 1) * INDEX_STEP + INDEX_DURATION) * 1000 + 150;
    const id = window.setTimeout(() => setFinished(true), ms);
    return () => window.clearTimeout(id);
  }, [reduceMotion]);

  return (
    <Frame url={`gixxer.ai/app/chatbots/${displayName(setup).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "new"}/knowledge`}>
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-hidden="true">
          {[
            { Icon: Globe, title: "Web page", hint: "Paste a URL" },
            { Icon: Upload, title: "Files", hint: "PDF, DOCX, XLSX…" },
            { Icon: Type, title: "Text", hint: "FAQs, policies" },
          ].map(({ Icon, title, hint }) => (
            <div key={title} className="rounded-xl border border-dashed border-line-strong bg-ink-900/50 px-3 py-3 text-center sm:py-4">
              <Icon className="mx-auto size-4 text-ink-300" />
              <p className="mt-2 text-[12.5px] font-medium text-ink-100">{title}</p>
              <p className="mt-0.5 hidden text-[11px] text-ink-400 sm:block">{hint}</p>
            </div>
          ))}
        </div>

        <p className={cn(label, "mt-6")}>Sources</p>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line" aria-label="Knowledge sources">
          {deploy.sources.map((source, index) => {
            const Icon = SOURCE_ICONS[source.type];
            return (
              <li key={source.name} className="px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-ink-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-50">{source.name}</span>
                  <span className={cn("shrink-0 font-mono text-[10.5px]", done ? "text-ink-200" : "text-ink-400")}>
                    {done ? `Indexed · ${source.passages} passages` : "Indexing…"}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
                  <motion.div
                    className="h-full rounded-full bg-ink-50"
                    initial={reduceMotion ? false : { width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: INDEX_DURATION, delay: index * INDEX_STEP, ease: EASE }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className={cn("mt-4 flex items-center gap-2 text-[13px] transition-colors duration-500", done ? "text-ink-100" : "text-ink-500")} aria-live="polite">
          <span className={cn("flex size-5 items-center justify-center rounded-full", done ? "bg-ink-50 text-ink-950" : "border border-line-strong")} aria-hidden="true">
            {done ? <Check className="size-3" /> : null}
          </span>
          {done ? `${deploy.sources.length} sources · ${total} passages · ready to answer` : "Reading your sources…"}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: test and go live                                            */
/* ------------------------------------------------------------------ */

interface Exchange {
  question: string;
  answer: string;
  source: string;
}

function TestPanel({ setup, live, onLive }: { setup: Setup; live: boolean; onLive: (next: boolean) => void }) {
  const [asked, setAsked] = useState<Exchange | null>(null);
  const answer = useTypewriter(asked?.answer ?? "", { active: Boolean(asked), speed: 15 });
  const remaining = useMemo(() => deploy.suggestions.filter((suggestion) => suggestion.question !== asked?.question), [asked]);

  return (
    <Frame
      url={`gixxer.ai/app/chatbots/${displayName(setup).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "new"}/overview`}
      badge={
        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label="Live"
          onClick={() => onLive(!live)}
          className="flex items-center gap-2 rounded-full border border-line-strong bg-ink-900 py-1 pl-1 pr-2.5 text-[11px] font-medium text-ink-100 transition-colors hover:border-ink-400"
        >
          <span className={cn("relative h-4 w-7 rounded-full transition-colors", live ? "bg-success" : "bg-ink-700")} aria-hidden="true">
            <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", live ? "left-3.5" : "left-0.5")} />
          </span>
          {live ? "Live" : "Draft"}
        </button>
      }
    >
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Avatar setup={setup} size="sm" />
          <p className="text-[13.5px] font-medium text-ink-50">Test {displayName(setup)}</p>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Preview</span>
        </div>

        <div className="mt-4 min-h-[210px] space-y-2.5 rounded-2xl border border-line bg-ink-900/40 p-4 text-[13px] leading-snug">
          <p className="w-fit max-w-[88%] rounded-xl rounded-bl-sm bg-ink-800 px-3 py-2 text-ink-100">{welcomeFor(setup)}</p>
          {asked ? (
            <>
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto w-fit max-w-[88%] rounded-xl rounded-br-sm bg-ink-50 px-3 py-2 text-ink-950">
                {asked.question}
              </motion.p>
              <p className="w-fit max-w-[88%] rounded-xl rounded-bl-sm bg-ink-800 px-3 py-2 text-ink-100">{answer.visible}</p>
              {answer.done ? (
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <span className="size-1.5 rounded-full bg-ink-50" aria-hidden="true" />
                  Source: <span className="normal-case tracking-normal text-ink-200">{asked.source}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="pt-6 text-center text-[12.5px] text-ink-500">Ask it what your customers ask.</p>
          )}
        </div>

        <p className={cn(label, "mt-4")}>Try a question</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((suggestion) => (
            <button
              key={suggestion.question}
              type="button"
              onClick={() => setAsked(suggestion)}
              className="rounded-full border border-line-strong bg-ink-900 px-3 py-1.5 text-[12px] text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50"
            >
              {suggestion.question}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-ink-400">
          {live ? "Live. The widget will answer on any page that carries its script tag." : "Draft. The widget stays hidden until you switch it live."}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: install, and how it looks                                   */
/* ------------------------------------------------------------------ */

function SitePreview({ setup }: { setup: Setup }) {
  const { site } = deploy;
  const first = deploy.suggestions[0];
  return (
    <Frame url={deploy.host} ariaLabel="Website preview" badge={<span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-400">Your site</span>}>
      <div className="relative h-[500px] overflow-hidden sm:h-[460px]">
        <div className="px-5 pt-4 sm:px-7" aria-hidden="true">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-[15px] font-black italic tracking-tight text-ink-50">Northwind</span>
            <ul className="hidden gap-5 text-[11.5px] text-ink-300 md:flex">
              {site.nav.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <span className="rounded-full bg-ink-50 px-3 py-1 text-[10.5px] font-medium text-ink-950">{site.cta}</span>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:items-center">
            <div>
              <p className="text-[22px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink-50 sm:text-[30px]">{site.headline}</p>
              <p className="mt-2.5 max-w-xs text-[12.5px] leading-relaxed text-ink-300">{site.sub}</p>
            </div>
            <div className="relative hidden aspect-[5/4] overflow-hidden rounded-xl border border-line md:block" style={{ background: "radial-gradient(circle at 30% 30%, #4a4a4c, #121214 60%)" }}>
              <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="24" cy="42" r="11" />
                <circle cx="76" cy="42" r="11" />
                <path d="M24 42 L40 22 L62 22 L76 42 M40 22 L36 16 L48 16 M62 22 L67 14 L60 12 M48 22 L54 32 L70 32" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {site.products.map((product, index) => (
              <li key={product.name} className="rounded-xl border border-line bg-ink-900/60 p-2.5">
                <div className="h-10 rounded-lg sm:h-12" style={{ background: `linear-gradient(135deg, ${["#3a3a3d", "#2b2b2e", "#4c4c50"][index]}, #131315)` }} />
                <p className="mt-2 truncate text-[10.5px] text-ink-100 sm:text-[11.5px]">{product.name}</p>
                <p className="text-[10px] text-ink-400 sm:text-[11px]">{product.price}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* The widget, exactly where the visitor meets it. */}
        <motion.div
          key={setup.side}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className={cn("glass absolute bottom-[4.5rem] flex w-[min(290px,82%)] flex-col overflow-hidden rounded-2xl shadow-float", setup.side === "right" ? "right-4 sm:right-6" : "left-4 sm:left-6")}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
            <Avatar setup={setup} size="sm" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[12.5px] font-medium text-ink-50">{displayName(setup)}</p>
              <p className="truncate text-[10.5px] text-ink-400">{setup.business.trim() || deploy.defaults.business}</p>
            </div>
            <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Online
            </span>
          </div>
          <div className="space-y-2 p-3 text-[11.5px] leading-snug">
            <p className="w-fit max-w-[92%] rounded-xl rounded-bl-sm bg-ink-800 px-2.5 py-1.5 text-ink-100">{welcomeFor(setup)}</p>
            <p className="ml-auto w-fit max-w-[88%] rounded-xl rounded-br-sm bg-ink-50 px-2.5 py-1.5 text-ink-950">{first.question}</p>
            <p className="w-fit max-w-[92%] rounded-xl rounded-bl-sm bg-ink-800 px-2.5 py-1.5 text-ink-100">{first.answer}</p>
          </div>
          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <span className="flex-1 text-[11px] text-ink-500">Type your question…</span>
            <SendHorizontal className="size-3.5 text-ink-400" aria-hidden="true" />
          </div>
        </motion.div>
        <span
          className={cn("absolute bottom-4 flex size-11 items-center justify-center rounded-full bg-ink-50 text-ink-950 shadow-glow", setup.side === "right" ? "right-4 sm:right-6" : "left-4 sm:left-6")}
          aria-hidden="true"
        >
          <MessageCircle className="size-5" />
        </span>
      </div>
    </Frame>
  );
}

function InstallPanel({ setup, onChange }: { setup: Setup; onChange: (next: Setup) => void }) {
  const [platform, setPlatform] = useState<PlatformKey>("html");
  const [copied, setCopied] = useState(false);
  const snippet = snippetFor(platform);
  const where = deploy.platforms.find((item) => item.key === platform)?.where ?? "";

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the snippet is selectable either way.
    }
  }

  return (
    <div className="space-y-4">
      <div className="plate min-w-0 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Your platform" className="flex flex-wrap gap-1">
            {deploy.platforms.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={platform === item.key}
                onClick={() => setPlatform(item.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[12px] transition-colors",
                  platform === item.key ? "bg-ink-50 text-ink-950" : "text-ink-300 hover:bg-ink-800 hover:text-ink-50",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-ink-900 px-2.5 py-1 text-[12px] text-ink-200 transition-colors hover:border-ink-400 hover:text-ink-50"
          >
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink-950/80 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-ink-200">
          <code>{snippet}</code>
        </pre>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">
          <span className="font-medium text-ink-100">Where it goes: </span>
          {where}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[12px] text-ink-400">Corner</span>
          {(["left", "right"] as const).map((side) => (
            <button key={side} type="button" aria-pressed={setup.side === side} onClick={() => onChange({ ...setup, side })} className={cn(pill(setup.side === side), "px-3 py-1 text-[12px] capitalize")}>
              {side}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? "Embed snippet copied to clipboard" : ""}
        </p>
      </div>
      <SitePreview setup={setup} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The guide                                                           */
/* ------------------------------------------------------------------ */

/**
 * Chatbot Pro, set up in four steps: the same order and the same screens as
 * the dashboard. The visitor's choices carry through: the name typed in step
 * one is the name on the website in step four. Everything is user-driven;
 * the only automatic motion is a one-time indexing run in step two.
 */
export function DeployGuide({ signedIn }: { signedIn: boolean }) {
  const [index, setIndex] = useState(0);
  const [setup, setSetup] = useState<Setup>({ ...deploy.defaults });
  const [live, setLive] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const top = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const step = STEPS[index] ?? STEPS[0]!;
  const next = STEPS[index + 1];

  function go(target: number, focus = false) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, target));
    setIndex(clamped);
    if (focus) tabs.current[clamped]?.focus();
  }

  function goFromButton(target: number) {
    go(target);
    // On phones the steps sit above the stage; bring them back into view.
    const element = top.current;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent) {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    event.preventDefault();
    go((index + (forward ? 1 : -1) + STEPS.length) % STEPS.length, true);
  }

  return (
    <section id={landingSections.deploy} className="relative scroll-mt-24 px-5 py-16 sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-line-strong to-transparent" aria-hidden="true" />
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading index={deploy.index} eyebrow={deploy.eyebrow} title={deploy.title} accent={deploy.accent} description={deploy.description} size="lg" accentBreak />

        <Reveal className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
          {/* The steps */}
          <div ref={top} className="min-w-0 scroll-mt-24 lg:sticky lg:top-28 lg:self-start">
            <ol role="tablist" aria-label="Setup steps" aria-orientation="vertical" onKeyDown={onKeyDown} className="relative grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-0">
              <span className="pointer-events-none absolute bottom-6 left-[19px] top-6 hidden w-px bg-line-strong lg:block" aria-hidden="true" />
              {STEPS.map((item, itemIndex) => {
                const active = itemIndex === index;
                const complete = itemIndex < index;
                return (
                  <li key={item.key} role="presentation" className="relative min-w-0">
                    <button
                      ref={(node) => {
                        tabs.current[itemIndex] = node;
                      }}
                      type="button"
                      role="tab"
                      id={`deploy-tab-${item.key}`}
                      aria-selected={active}
                      aria-controls="deploy-stage"
                      aria-label={`Step ${itemIndex + 1}: ${item.title}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => go(itemIndex)}
                      className={cn(
                        "group flex w-full flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition-colors lg:flex-row lg:items-center lg:gap-4 lg:border-transparent lg:px-0 lg:py-3 lg:text-left",
                        active ? "border-ink-50/40 bg-ink-900 lg:bg-transparent" : "border-line bg-ink-950 hover:border-line-strong lg:bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-colors duration-300 lg:size-10 lg:text-[12px]",
                          active ? "border-transparent bg-ink-50 text-ink-950" : complete ? "border-ink-50/50 bg-ink-950 text-ink-50" : "border-line-strong bg-ink-950 text-ink-400",
                        )}
                        aria-hidden="true"
                      >
                        {complete ? <Check className="size-3.5" /> : item.n}
                      </span>
                      <span className={cn("text-[11.5px] font-medium lg:hidden", active ? "text-ink-50" : "text-ink-400")}>{item.short}</span>
                      <span className={cn("hidden text-[17px] font-semibold tracking-[-0.02em] transition-colors lg:block", active ? "text-ink-50" : "text-ink-400 group-hover:text-ink-200")}>
                        {item.title}
                      </span>
                    </button>
                    {/* Desktop: the active step opens under its title. */}
                    <AnimatePresence initial={false}>
                      {active ? (
                        <motion.div
                          key="detail"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: EASE }}
                          className="hidden overflow-hidden pl-14 lg:block"
                        >
                          <StepDetail step={item} />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>

            {/* Phones: the active step's detail sits under the step pills. */}
            <div className="mt-4 lg:hidden">
              <p className="text-[19px] font-semibold tracking-[-0.02em] text-ink-50">{step.title}</p>
              <StepDetail step={step} />
            </div>
          </div>

          {/* The stage */}
          <div className="min-w-0">
            <div role="tabpanel" id="deploy-stage" aria-labelledby={`deploy-tab-${step.key}`} className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
                  {step.key === "identity" ? <IdentityPanel setup={setup} onChange={setSetup} /> : null}
                  {step.key === "train" ? <TrainPanel setup={setup} /> : null}
                  {step.key === "test" ? <TestPanel setup={setup} live={live} onLive={setLive} /> : null}
                  {step.key === "install" ? <InstallPanel setup={setup} onChange={setSetup} /> : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goFromButton(index - 1)}
                disabled={index === 0}
                className={buttonClassName({ variant: "ghost", size: "sm", className: "disabled:invisible" })}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              {next ? (
                <button type="button" onClick={() => goFromButton(index + 1)} className={buttonClassName({ variant: "primary", size: "sm", className: "btn-sheen" })}>
                  Next: {next.short}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <Link href={signedIn ? routes.app : routes.register} className={buttonClassName({ variant: "primary", size: "sm", className: "btn-sheen" })}>
                  Build your bot
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StepDetail({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="pb-4 pt-1">
      <p className="text-[14px] leading-relaxed text-ink-300">{step.detail}</p>
      <ul className="mt-3 space-y-1.5">
        {step.does.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-ink-200">
            <Check className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">{step.where}</p>
    </div>
  );
}
