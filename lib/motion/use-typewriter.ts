"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

interface TypewriterOptions {
  /** Start typing. Typically "is in view". */
  active: boolean;
  /** Milliseconds per character. */
  speed?: number;
  /** Delay before the first character, in milliseconds. */
  delay?: number;
}

/** Reveals text character by character, or all at once for reduced motion. */
export function useTypewriter(text: string, { active, speed = 16, delay = 0 }: TypewriterOptions) {
  const reduceMotion = usePrefersReducedMotion();
  const [typed, setTyped] = useState(0);
  const [typedFor, setTypedFor] = useState(text);

  // A new text starts from its first character, never from the old count.
  // Adjusted during render, as React recommends for state that derives from a prop.
  if (typedFor !== text) {
    setTypedFor(text);
    setTyped(0);
  }

  useEffect(() => {
    if (!active || reduceMotion) return;
    let frame = 0;
    let shown = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const target = Math.max(0, Math.min(text.length, Math.floor((now - start) / speed)));
      if (target !== shown) {
        shown = target;
        setTyped(shown);
      }
      if (shown < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, text, speed, delay, reduceMotion]);

  // Reduced motion shows the whole text immediately; nothing to animate, nothing to store.
  const count = reduceMotion ? text.length : typed;
  return { visible: text.slice(0, count), started: count > 0, done: count >= text.length };
}
