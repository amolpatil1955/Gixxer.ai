"use client";

import { Bot, Calendar, FolderKanban, ImageIcon, Library, MessageSquarePlus, Puzzle, Search, Settings } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { landingSections, showcase, workspaceViews, type WorkspaceViewKey } from "@/lib/landing/content";
import { useGsapEffect } from "@/lib/motion/gsap";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { SectionHeading } from "../primitives/section-heading";
import { ChatPanel, ChatbotPanel, FilesPanel, ImagesPanel, vs } from "./workspace-panels";

const PANELS: Record<WorkspaceViewKey, () => React.JSX.Element> = { chat: ChatPanel, images: ImagesPanel, files: FilesPanel, chatbot: ChatbotPanel };

const ICONS: Record<WorkspaceViewKey, typeof MessageSquarePlus> = { chat: MessageSquarePlus, images: ImageIcon, files: Library, chatbot: Bot };

/** Sidebar entries the product has but this demo does not drive. Decorative only. */
const STATIC_NAV = [
  { label: "Search", Icon: Search },
  { label: "Scheduled", Icon: Calendar },
  { label: "Plugins", Icon: Puzzle },
  { label: "Projects", Icon: FolderKanban },
] as const;

const KEYS = workspaceViews.map((view) => view.key);
const AUTO_ADVANCE_MS = 6500;

/**
 * The workspace on a laptop. The sidebar is a real tablist: click or
 * arrow-key through it and the panel changes. It shows each view once on
 * its own, then stops; the visitor can always take over. The laptop settles
 * from a recline as it scrolls in, and nothing else here moves on its own.
 */
export function WorkspaceShowcase() {
  const stage = useRef<HTMLDivElement>(null);
  const laptop = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inView = useInView(stage, { amount: 0.3 });
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<WorkspaceViewKey>("chat");
  const [tookOver, setTookOver] = useState(false);
  const [shown, setShown] = useState(1);

  const select = useCallback((key: WorkspaceViewKey) => {
    setActive(key);
    setTookOver(true);
  }, []);

  // One tour through the views, then rest.
  useEffect(() => {
    if (tookOver || !inView || reduceMotion || shown >= KEYS.length) return;
    const id = window.setTimeout(() => {
      setActive((current) => KEYS[(KEYS.indexOf(current) + 1) % KEYS.length] ?? "chat");
      setShown((value) => value + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [active, inView, tookOver, reduceMotion, shown]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    event.preventDefault();
    const current = KEYS.indexOf(active);
    const next = (current + (forward ? 1 : -1) + KEYS.length) % KEYS.length;
    const key = KEYS[next];
    if (!key) return;
    select(key);
    tabRefs.current[next]?.focus();
  };

  useGsapEffect(stage, ({ gsap, reduceMotion }) => {
    if (reduceMotion || !laptop.current) return;
    gsap.fromTo(
      laptop.current,
      { rotateX: 16, y: 70, scale: 0.94, transformPerspective: 1800, transformOrigin: "50% 100%" },
      { rotateX: 0, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: stage.current, start: "top 90%", end: "top 30%", scrub: 0.6 } },
    );
  });

  const Panel = PANELS[active];
  const activeView = workspaceViews.find((view) => view.key === active);

  return (
    <section id={landingSections.workspace} className="relative scroll-mt-24 overflow-x-clip px-5 pb-16 pt-16 sm:px-8 sm:pb-32 sm:pt-32">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading index={showcase.index} eyebrow={showcase.eyebrow} title={showcase.title} accent={showcase.accent} description={showcase.description} align="center" size="lg" />

        <div ref={stage} className="relative mx-auto mt-14 max-w-6xl sm:mt-20">
          <div className="pointer-events-none absolute inset-x-[-10%] -top-24 bottom-0 glow-warm opacity-90" aria-hidden="true" />

          {/* The laptop */}
          <div ref={laptop} className="relative">
            <div className="relative rounded-[20px] border border-ink-700 bg-[#0c0c0e] p-[9px] shadow-float sm:rounded-[26px] sm:p-3">
              {/* Camera notch */}
              <div className="absolute left-1/2 top-0 z-10 hidden h-4 w-28 -translate-x-1/2 rounded-b-xl bg-[#0c0c0e] sm:block" aria-hidden="true">
                <span className="absolute left-1/2 top-1.5 size-1.5 -translate-x-1/2 rounded-full bg-[#2b2b2f]" />
              </div>
              <div className="relative overflow-hidden rounded-[12px] sm:rounded-[16px]" style={{ background: vs.editor }}>
                {/* Title bar */}
                <div className="flex h-9 items-center gap-2 px-3" style={{ background: vs.bar }}>
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 hidden font-mono text-[11px] sm:block" style={{ color: vs.muted }}>
                    Gixxer Workspace — gixxer.ai/app
                  </span>
                  <span className="ml-auto rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em]" style={{ borderColor: vs.border, color: vs.muted }}>
                    Preview
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[52px_212px_1fr] lg:grid-cols-[52px_224px_1fr_200px]">
                  {/* Activity bar */}
                  <div className="hidden flex-col items-center gap-3 py-3 md:flex" style={{ background: vs.bar }} aria-hidden="true">
                    {[MessageSquarePlus, Search, ImageIcon, Library, Bot].map((Icon, index) => (
                      <span key={index} className="flex size-9 items-center justify-center rounded-md" style={{ color: index === 0 ? "#fff" : vs.muted, background: index === 0 ? vs.panel : "transparent" }}>
                        <Icon className="size-[18px]" />
                      </span>
                    ))}
                    <span className="mt-auto flex size-9 items-center justify-center" style={{ color: vs.muted }}>
                      <Settings className="size-[18px]" />
                    </span>
                  </div>

                  {/* Explorer: the four demo views are tabs, the rest is decoration. */}
                  <aside className="border-b p-2.5 md:border-b-0 md:border-r" style={{ background: vs.panel, borderColor: vs.border }}>
                    <p className="hidden px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] md:block" style={{ color: vs.muted }}>
                      Workspace
                    </p>
                    <div role="tablist" aria-label="Workspace areas" aria-orientation="vertical" onKeyDown={onKeyDown} className="grid grid-cols-4 gap-1 md:flex md:flex-col">
                      {workspaceViews.map((view, index) => {
                        const Icon = ICONS[view.key];
                        const selected = view.key === active;
                        return (
                          <button
                            key={view.key}
                            ref={(node) => {
                              tabRefs.current[index] = node;
                            }}
                            role="tab"
                            aria-label={view.label}
                            id={`ws-tab-${view.key}`}
                            aria-selected={selected}
                            aria-controls="ws-panel"
                            tabIndex={selected ? 0 : -1}
                            onClick={() => select(view.key)}
                            className="relative flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] transition-colors md:w-full md:flex-row md:gap-2.5 md:whitespace-nowrap md:px-2.5 md:py-1.5 md:text-[12.5px]"
                            style={{ color: selected ? "#fff" : vs.text, background: selected ? "#37373d" : "transparent" }}
                          >
                            <Icon className="size-4 shrink-0" style={{ color: selected ? vs.accent : vs.muted }} aria-hidden="true" />
                            <span className="md:hidden">{view.short}</span>
                            <span className="hidden md:inline">{view.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <ul className="mt-1 hidden space-y-0.5 md:block" aria-hidden="true">
                      {STATIC_NAV.map(({ label, Icon }) => (
                        <li key={label} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px]" style={{ color: vs.muted }}>
                          <Icon className="size-4 shrink-0" />
                          {label}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 hidden px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] md:block" style={{ color: vs.muted }}>
                      Recent
                    </p>
                    <ul className="hidden space-y-0.5 md:block" aria-hidden="true">
                      {showcase.recent.map((item) => (
                        <li key={item} className="truncate rounded-md px-2.5 py-1 text-[12px]" style={{ color: vs.text }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </aside>

                  {/* Editor */}
                  <div role="tabpanel" id="ws-panel" aria-labelledby={`ws-tab-${active}`} tabIndex={-1} className="flex min-h-[420px] min-w-0 flex-col sm:min-h-[480px]">
                    <div className="flex h-9 items-end gap-0.5 px-2" style={{ background: "#2d2d2d" }}>
                      <span className="flex h-8 items-center gap-2 rounded-t-md px-3 text-[12px]" style={{ background: vs.editor, color: vs.text }}>
                        <span className="size-1.5 rounded-full" style={{ background: vs.accent }} />
                        {activeView?.tab}
                      </span>
                      <span className="hidden h-8 items-center px-3 text-[12px] sm:flex" style={{ color: vs.muted }}>
                        {activeView?.caption}
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="absolute inset-0">
                          <Panel />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Assistant panel: the robot, live and listening. */}
                  <aside className="hidden border-l lg:flex lg:flex-col" style={{ background: vs.panel, borderColor: vs.border }} aria-hidden="true">
                    <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: vs.muted }}>
                      Assistant
                    </p>
                    <div className="relative mx-3 mt-2 aspect-[4/5] overflow-hidden rounded-lg border" style={{ borderColor: vs.border }}>
                      <Image src="/robot.webp" alt="" fill sizes="200px" className="object-cover" />
                      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white">
                        <span className="size-1.5 rounded-full bg-[#28c840]" />
                        Listening
                      </span>
                    </div>
                    <dl className="mx-3 mt-3 space-y-1.5 text-[11.5px]">
                      {[
                        ["Model", showcase.status.model],
                        ["Fallback", showcase.status.fallback],
                        ["Session", showcase.status.session],
                      ].map(([term, value]) => (
                        <div key={term} className="flex justify-between gap-2">
                          <dt style={{ color: vs.muted }}>{term}</dt>
                          <dd className="truncate" style={{ color: vs.text }}>
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </aside>
                </div>

                {/* Status bar */}
                <div className="flex h-6 items-center gap-4 px-3 font-mono text-[10px] text-white" style={{ background: vs.status }} aria-hidden="true">
                  <span>{showcase.status.model}</span>
                  <span className="hidden sm:inline">{showcase.status.fallback}</span>
                  <span className="ml-auto hidden sm:inline">UTF-8</span>
                  <span>{showcase.sidebar.length} areas</span>
                </div>
              </div>
            </div>
            {/* Deck and foot */}
            <div className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-2xl border-x border-b border-ink-700 bg-linear-to-b from-ink-600 to-ink-800 sm:h-4" aria-hidden="true">
              <span className="mx-auto block h-1 w-24 rounded-b-md bg-ink-900 sm:h-1.5 sm:w-32" />
            </div>
            <div className="mx-auto h-10 w-[70%] rounded-[100%] bg-black/50 blur-2xl" aria-hidden="true" />
          </div>
        </div>

        <p className="mt-2 text-center text-[12.5px] text-ink-400 sm:mt-4">{showcase.sidebar.length} areas in the app. Pick one above to see how it behaves.</p>
      </div>
    </section>
  );
}
