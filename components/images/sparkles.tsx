"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

/*
 * Twinkling four-point stars over a generating image, and a burst of them
 * when the image lands. Positions come from a small seeded generator so a
 * re-render never reshuffles the sky.
 */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_PATH = "M12 0C12 6.6 17.4 12 24 12C17.4 12 12 17.4 12 24C12 17.4 6.6 12 0 12C6.6 12 12 6.6 12 0Z";

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-3", className)} aria-hidden="true" focusable="false">
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

interface SparklesProps {
  count?: number;
  seed?: number;
  className?: string;
}

/** A field of twinkling stars. Absolutely positioned; the parent must be `relative`. */
export function Sparkles({ count = 28, seed = 7, className }: SparklesProps) {
  const stars = useMemo(() => {
    const rand = mulberry(seed);
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      left: rand() * 100,
      top: rand() * 100,
      size: 6 + rand() * 10,
      delay: rand() * 1.8,
      duration: 1.4 + rand() * 1.6,
      drift: 2.4 + rand() * 1.6,
      bright: rand() > 0.6,
    }));
  }, [count, seed]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute animate-drift-up motion-reduce:animate-none"
          style={{ left: `${star.left}%`, top: `${star.top}%`, animationDuration: `${star.drift}s`, animationDelay: `${star.delay}s`, animationDirection: "alternate" }}
        >
          <Star
            className={cn("animate-twinkle motion-reduce:animate-none motion-reduce:opacity-60", star.bright ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" : "text-white/70")}
            // Inline sizes vary per star; the animation timing does too, so the sky never pulses in unison.
            {...{ style: { width: star.size, height: star.size, animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` } }}
          />
        </span>
      ))}
    </div>
  );
}

/** Twelve stars flung outward once, for the moment a finished image appears. */
export function SparkleBurst({ seed = 3 }: { seed?: number }) {
  const stars = useMemo(() => {
    const rand = mulberry(seed);
    return Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2 + rand() * 0.4;
      const distance = 36 + rand() * 24;
      return { id: index, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: 8 + rand() * 8, delay: rand() * 0.12 };
    });
  }, [seed]);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {stars.map((star) => (
        <span key={star.id} className="absolute animate-burst motion-reduce:hidden" style={{ animationDelay: `${star.delay}s`, transform: `translate(${star.x}%, ${star.y}%)` }}>
          <Star className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" {...{ style: { width: star.size, height: star.size } }} />
        </span>
      ))}
    </div>
  );
}
