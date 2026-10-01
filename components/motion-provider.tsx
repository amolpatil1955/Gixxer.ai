"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion honours the visitor's reduced-motion setting everywhere: transform
 * and layout animations become instant while opacity still fades, which is
 * the behaviour WCAG asks for. Applied once, at the root.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
