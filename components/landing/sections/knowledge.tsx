"use client";

import { useRef, useState } from "react";
import { knowledge, landingSections } from "@/lib/landing/content";
import { useGsapEffect } from "@/lib/motion/gsap";
import { cn } from "@/lib/utils/cn";
import { Reveal, RevealGroup, RevealItem } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

const RADIUS = 37; // percent of the stage
const NODES = knowledge.sources.map((source, index) => {
  const angle = (index / knowledge.sources.length) * Math.PI * 2 - Math.PI / 2;
  return { ...source, x: 50 + Math.cos(angle) * RADIUS, y: 50 + Math.sin(angle) * RADIUS };
});

/**
 * A constellation: six sources orbit the bot and each one is wired to it.
 * The wires draw as the section scrolls in; hovering a source holds its wire
 * lit. Beside it, what the workspace keeps for you and what it keeps for
 * your bots, as two short lists.
 */
export function Knowledge() {
  const stage = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useGsapEffect(stage, ({ gsap, reduceMotion }) => {
    if (reduceMotion) return;
    gsap.fromTo(
      "[data-wire]",
      { strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        ease: "none",
        stagger: 0.08,
        scrollTrigger: { trigger: stage.current, start: "top 85%", end: "top 35%", scrub: 0.5 },
      },
    );
    gsap.from("[data-node]", {
      scale: 0.6,
      opacity: 0,
      stagger: 0.07,
      duration: 0.6,
      ease: "power3.out",
      scrollTrigger: { trigger: stage.current, start: "top 75%", once: true },
    });
  });

  return (
    <section id={landingSections.knowledge} className="relative scroll-mt-24 overflow-x-clip px-5 py-16 sm:px-8 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
        <div className="order-2 lg:order-1">
          <Reveal>
            <div ref={stage} className="relative mx-auto aspect-square w-full max-w-[560px]">
              <div className="pointer-events-none absolute inset-[10%] rounded-full glow-warm blur-2xl" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[13%] rounded-full border border-line" aria-hidden="true" />

              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {NODES.map((node, index) => {
                  const lit = hovered === null || hovered === index;
                  return (
                    <g key={node.label}>
                      <line x1="50" y1="50" x2={node.x} y2={node.y} stroke="var(--color-line-strong)" strokeWidth="0.3" />
                      <line
                        data-wire
                        x1="50"
                        y1="50"
                        x2={node.x}
                        y2={node.y}
                        pathLength={1}
                        stroke="var(--color-ink-50)"
                        strokeWidth={hovered === index ? 0.7 : 0.35}
                        strokeDasharray="1"
                        strokeDashoffset="1"
                        className={cn("transition-opacity duration-300", lit ? "opacity-90" : "opacity-15")}
                      />
                      <circle cx={node.x} cy={node.y} r="1.4" fill="var(--color-ink-950)" stroke="var(--color-ink-50)" strokeWidth="0.35" />
                    </g>
                  );
                })}
                <circle cx="50" cy="50" r="7" fill="var(--color-ink-950)" stroke="var(--color-line-strong)" strokeWidth="0.3" />
              </svg>

              {/* The hub */}
              <div className="absolute left-1/2 top-1/2 flex size-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                <span className="glass flex size-full flex-col items-center justify-center rounded-full shadow-lift">
                  <span className="font-display text-[22px] font-black italic leading-none text-ink-50 sm:text-[26px]">{knowledge.hub[0]}</span>
                  <span className="mt-0.5 hidden font-mono text-[8px] uppercase tracking-[0.18em] text-ink-400 sm:block">{knowledge.hub}</span>
                </span>
              </div>

              {/* Sources */}
              <ul aria-label="Knowledge sources">
                {NODES.map((node, index) => (
                  <li
                    key={node.label}
                    data-node
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <button
                      type="button"
                      onPointerEnter={() => setHovered(index)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={() => setHovered(index)}
                      onBlur={() => setHovered(null)}
                      className={cn(
                        "plate flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-left transition-[transform,opacity] duration-300 hover:-translate-y-0.5",
                        hovered !== null && hovered !== index && "opacity-50",
                      )}
                    >
                      <span className="rounded-full bg-ink-800 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-300">
                        {node.kind}
                      </span>
                      <span className="whitespace-nowrap text-[11.5px] text-ink-50 sm:text-[12.5px]">{node.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            index={knowledge.index}
            eyebrow={knowledge.eyebrow}
            title={knowledge.title}
            accent={knowledge.accent}
            description={knowledge.description}
            accentBreak
          />

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">For you</p>
              <RevealGroup as="ul" className="mt-3 divide-y divide-line border-t border-line">
                {knowledge.forYou.map((item) => (
                  <RevealItem as="li" key={item.title} className="py-4">
                    <p className="text-[15.5px] font-medium text-ink-50">{item.title}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-300">{item.detail}</p>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">For your bots</p>
              <RevealGroup as="ul" className="mt-3 divide-y divide-line border-t border-line" delay={0.1}>
                {knowledge.forBots.map((item) => (
                  <RevealItem as="li" key={item.title} className="py-4">
                    <p className="text-[15.5px] font-medium text-ink-50">{item.title}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-300">{item.detail}</p>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
