"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { faqSection, faqs, landingSections } from "@/lib/landing/content";
import { cn } from "@/lib/utils/cn";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id={landingSections.faq} className="relative scroll-mt-24 px-5 py-16 sm:px-8 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <SectionHeading index={faqSection.index} eyebrow={faqSection.eyebrow} title={faqSection.title} accent={faqSection.accent} accentBreak />

        <Reveal delay={0.05}>
          <ul className="divide-y divide-line border-y border-line">
            {faqs.map((faq, index) => {
              const expanded = open === index;
              return (
                <li key={faq.question}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`faq-panel-${index}`}
                      id={`faq-button-${index}`}
                      onClick={() => setOpen(expanded ? null : index)}
                      className="group flex w-full items-center justify-between gap-6 py-6 text-left transition-colors hover:text-ink-50"
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="font-mono text-[10.5px] text-ink-500">0{index + 1}</span>
                        <span className={cn("text-[17px] font-medium transition-colors sm:text-[19px]", expanded ? "text-ink-50" : "text-ink-100")}>
                          {faq.question}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-400 transition-[transform,border-color] duration-300 group-hover:border-ink-400",
                          expanded && "rotate-180",
                        )}
                        aria-hidden="true"
                      >
                        <ChevronDown className="size-4" />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        key="panel"
                        id={`faq-panel-${index}`}
                        role="region"
                        aria-labelledby={`faq-button-${index}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-7 pl-9 pr-10 text-pretty text-[15.5px] leading-relaxed text-ink-300">{faq.answer}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
