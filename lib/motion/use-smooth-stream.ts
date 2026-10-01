"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/*
 * Tokens arrive in bursts; readers prefer a steady flow. The displayed text
 * advances at a calm reading pace, a word or a line at a time (never a cut
 * word), a little faster when the backlog grows so it never falls far
 * behind, and finishes within a moment of the stream ending rather than
 * all at once.
 */

const BASE_CHARS_PER_SECOND = 42;
const MAX_CHARS_PER_SECOND = 180;
const FINISH_SECONDS = 1.2;

/** The end of the word (or line) that starts at or after `index`, so a reveal never stops mid-word. */
function wordBoundary(text: string, index: number): number {
  if (index >= text.length) return text.length;
  let end = index;
  while (end < text.length && !/\s/.test(text[end]!)) end++;
  while (end < text.length && /[ \t]/.test(text[end]!)) end++;
  return end;
}

export function useSmoothStream(target: string, active: boolean): { text: string; caughtUp: boolean } {
  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(active ? 0 : target.length);
  const carry = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let last = performance.now();
    let done = false;
    const tick = (now: number) => {
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      setShown((value) => {
        const backlog = target.length - value;
        if (backlog <= 0) {
          done = true;
          return value;
        }
        // Reading pace while the stream is live; once it has ended, whatever is left lands within a moment.
        const rate = active ? Math.min(MAX_CHARS_PER_SECOND, BASE_CHARS_PER_SECOND + backlog * 0.35) : Math.max(MAX_CHARS_PER_SECOND, backlog / FINISH_SECONDS);
        carry.current += rate * seconds;
        if (carry.current < 1) return value;
        const next = Math.min(target.length, wordBoundary(target, value + Math.floor(carry.current)));
        carry.current = 0;
        return next;
      });
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, reduceMotion]);

  const count = reduceMotion ? target.length : Math.min(shown, target.length);
  return { text: target.slice(0, count), caughtUp: count >= target.length };
}
