"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { routes } from "@/lib/auth/routes";
import { Wordmark } from "./wordmark";

const CAPABILITIES = ["Multi-model chat", "Image generation", "File intelligence", "Business chatbots"];

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/** Left-hand panel on the auth screens. Establishes the visual language before the product exists. */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-line bg-ink-950 lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 surface-grid" />
        <div className="absolute -left-1/4 top-1/4 h-[70vh] w-[70vh] animate-drift rounded-full bg-ink-50/[0.04] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-ink-950 to-transparent" />
      </div>

      <div className="relative px-12 pt-12">
        <Link href={routes.home} aria-label="Gixxer.ai home" className="inline-block">
          <Wordmark size="sm" />
        </Link>
      </div>

      <div className="relative px-12 pb-16">
        <motion.div {...enter(0.05)}>
          <Wordmark size="xl" />
        </motion.div>
        <motion.p {...enter(0.2)} className="mt-8 max-w-md text-balance text-lg leading-relaxed text-ink-200">
          One workspace for every kind of intelligence. Chat with the best models, generate images, read
          your documents, and put a chatbot on your website.
        </motion.p>
        <motion.ul {...enter(0.35)} className="mt-8 flex flex-wrap gap-2" aria-label="Capabilities">
          {CAPABILITIES.map((capability) => (
            <li
              key={capability}
              className="rounded-full border border-line-strong bg-ink-900/70 px-3.5 py-1.5 text-xs font-medium tracking-wide text-ink-100"
            >
              {capability}
            </li>
          ))}
        </motion.ul>
      </div>
    </aside>
  );
}
