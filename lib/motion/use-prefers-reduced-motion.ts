"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/**
 * Hydration-safe reduced-motion preference. The server and the first client
 * render both say `false`, so markup matches; the real value arrives right
 * after hydration and again whenever the visitor changes the setting.
 *
 * Use this when the *rendered output* depends on the preference (skipping a
 * typewriter, showing a demo's final state). Motion's own animations are
 * handled by MotionConfig in `components/motion-provider.tsx`.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
