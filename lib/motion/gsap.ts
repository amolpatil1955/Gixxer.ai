"use client";

import gsap from "gsap";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, type DependencyList, type RefObject } from "react";

let registered = false;

/** Registers the plugins once, on the client only. */
export function getGsap() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return { gsap, ScrollTrigger };
}

export interface GsapSetupContext {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  /** True when the visitor asked for less motion. Effects should be skipped or made instant. */
  reduceMotion: boolean;
}

/**
 * Runs GSAP code scoped to an element and reverts everything it created on
 * cleanup, including ScrollTriggers. Selectors inside `setup` resolve relative
 * to `scope`. `setup` may return its own cleanup for anything GSAP does not
 * track, such as event listeners or a `matchMedia` it created.
 */
export function useGsapEffect(
  scope: RefObject<HTMLElement | null>,
  setup: (context: GsapSetupContext) => void | (() => void),
  deps: DependencyList = [],
): void {
  useEffect(() => {
    if (!scope.current) return;
    const { gsap, ScrollTrigger } = getGsap();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cleanup: void | (() => void);
    const context = gsap.context(() => {
      cleanup = setup({ gsap, ScrollTrigger, reduceMotion });
    }, scope);
    return () => {
      cleanup?.();
      context.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
