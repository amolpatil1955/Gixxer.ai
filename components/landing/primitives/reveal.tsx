"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

const variants: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
};

type Tag = "div" | "li" | "article" | "figure" | "section" | "span" | "p";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds. Use for stagger between sibling reveals. */
  delay?: number;
  /** Render as a different block element. */
  as?: Tag;
  /** How much of the element must be visible before it enters. */
  amount?: number;
}

/**
 * Enters once when scrolled into view: a short rise that settles.
 * Under reduced motion, MotionConfig makes the movement instant and keeps the fade.
 * No blur filter here on purpose: animating `filter` on dozens of elements is
 * the single most expensive thing a landing page can do to a mid-range phone.
 */
export function Reveal({ children, className, delay = 0, as = "div", amount }: RevealProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px", amount }}
      transition={{ duration: 0.85, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

interface GroupProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each child. */
  stagger?: number;
  delay?: number;
  as?: Tag | "ul" | "ol";
}

/**
 * A parent that staggers its `RevealItem` children as it scrolls into view.
 * The children declare the variants; the parent only orchestrates timing.
 */
export function RevealGroup({ children, className, stagger = 0.07, delay = 0, as = "div" }: GroupProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {children}
    </Component>
  );
}

export function RevealItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: Tag }) {
  const Component = motion[as];
  return (
    <Component className={className} variants={variants} transition={{ duration: 0.8, ease: EASE }}>
      {children}
    </Component>
  );
}
