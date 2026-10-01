"use client";

import { useSyncExternalStore } from "react";

/**
 * Hydration-safe media query. The server and the first client render both
 * return `serverValue`, so markup matches; the real answer arrives right
 * after hydration and again whenever the query flips.
 *
 * Use this whenever rendered output depends on a device fact (hover
 * capability, pointer type, viewport width). Never read `matchMedia`
 * during render directly.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** True on devices with a real hover pointer (a mouse or trackpad), false on touch. */
export function useCanHover(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}
