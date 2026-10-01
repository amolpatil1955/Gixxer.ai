"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils/cn";

/*
 * The one loader for a picture being made: a box the size of the final image
 * filled with a fine grid of tiny dots. A slow wave of brightness crosses the
 * grid and each dot swells a little as it passes. Drawn on a canvas at 30
 * frames a second, only while mounted and the tab is visible; the percentage
 * is an estimate that completes only when the real image arrives.
 */

const ETA_KEY = "gixxer-image-eta";
const DEFAULT_ETA_MS = 12_000;
const SPACING = 11;
const FRAME_MS = 1000 / 30;

export function readImageEta(): number {
  try {
    const stored = Number(localStorage.getItem(ETA_KEY));
    return Number.isFinite(stored) && stored > 1000 ? stored : DEFAULT_ETA_MS;
  } catch {
    return DEFAULT_ETA_MS;
  }
}

export function writeImageEta(ms: number) {
  try {
    localStorage.setItem(ETA_KEY, String(Math.round(ms)));
  } catch {}
}

/** Rises quickly, then eases toward 92% until the real result arrives. */
export function estimateProgress(elapsedMs: number, etaMs: number): number {
  return Math.min(92, 100 * (1 - Math.exp(-elapsedMs / (etaMs / 2.4))));
}

interface ImageGeneratingProps {
  width: number;
  height: number;
  /** 0 to 100. Omitted: estimated from elapsed time. */
  progress?: number;
  className?: string;
}

export function ImageGenerating({ width, height, progress, className }: ImageGeneratingProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [estimated, setEstimated] = useState(0);

  // Self-estimated progress when the caller has none; a few updates a second is plenty.
  // The estimate keeps running from the loader's own start even if the caller later takes over.
  useEffect(() => {
    if (progress !== undefined) return;
    const started = performance.now();
    const eta = readImageEta();
    const timer = window.setInterval(() => setEstimated(estimateProgress(performance.now() - started, eta)), 250);
    return () => window.clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    let frame = 0;
    let last = 0;
    const started = performance.now();
    const accent = getComputedStyle(element).color || "rgb(59, 124, 246)";
    const [r, g, b] = accent.match(/\d+/g)?.map(Number) ?? [59, 124, 246];

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * ratio);
      const h = Math.round(rect.height * ratio);
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const t = reduceMotion ? 0 : (now - started) / 1000;
      const columns = Math.floor((rect.width - 16) / SPACING);
      const rows = Math.floor((rect.height - 16) / SPACING);
      const offsetX = (rect.width - (columns - 1) * SPACING) / 2;
      const offsetY = (rect.height - (rows - 1) * SPACING) / 2;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          // One slow diagonal wave: dots ahead of it rest small and faint; those under it swell a little.
          const wave = Math.sin((column + row) * 0.22 - t * 1.4);
          const level = Math.max(0, wave) ** 2;
          const radius = 0.55 + level * 0.55;
          context.beginPath();
          context.arc(offsetX + column * SPACING, offsetY + row * SPACING, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.22 + level * 0.7})`;
          context.fill();
        }
      }
      if (reduceMotion) cancelAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion]);

  const value = Math.round(progress ?? estimated);

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border border-line-strong bg-ink-950 text-accent", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label="Creating image"
      data-generating="image"
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <span className="absolute bottom-3 right-3 rounded-full border border-line bg-ink-900/95 px-3 py-1 font-mono text-[12px] font-medium tabular-nums text-accent" data-progress={value}>
        {value}%
      </span>
    </div>
  );
}
