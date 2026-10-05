"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils/cn";

/*
 * The voice visualiser: several thin lines flowing across the middle in white,
 * blue and violet. It cycles through four movements, a few seconds each, so the
 * window never looks static: flowing, a tighter pulse, a circular ripple, then
 * flowing again.
 *
 * One canvas, one requestAnimationFrame loop capped at 30 frames a second, and
 * nothing allocated per frame. The loop stops when the tab is hidden, when the
 * caller is not listening, and on unmount; `level` arrives through a ref so a
 * changing voice level never re-renders React.
 */

export type WaveMood = "idle" | "listening" | "thinking" | "speaking";

const LINES = 5;
const FRAME_MS = 1000 / 30;
/** How long each movement holds before easing into the next. */
const PHASE_MS = 4200;
const BLEND_MS = 1100;

/** White, blue, violet: the line colours, back to front. */
const COLOURS = [
  [255, 255, 255],
  [150, 190, 255],
  [120, 140, 255],
  [165, 130, 255],
  [205, 175, 255],
] as const;

interface VoiceWavesProps {
  mood: WaveMood;
  /** 0 to 1, read every frame without re-rendering. */
  levelRef: React.RefObject<number>;
  className?: string;
}

/** Smooth step between two phases. */
function ease(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

export function VoiceWaves({ mood, levelRef, className }: VoiceWavesProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  // The loop reads the state through a ref, so a change of state never restarts it.
  const moodRef = useRef(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d", { alpha: true });
    if (!context) return;

    let frame = 0;
    let last = 0;
    const started = performance.now();
    let width = 0;
    let height = 0;
    let ratio = 1;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      ratio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * ratio);
      const h = Math.round(rect.height * ratio);
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
      width = rect.width;
      height = rect.height;
      return true;
    };

    /*
     * The four movements. Each returns the vertical offset of one line at a
     * horizontal position, so switching movement is a blend between two numbers
     * rather than a different drawing routine.
     */
    const flowing = (x: number, line: number, t: number, amp: number) =>
      Math.sin(x * 2.1 + t * 0.9 + line * 0.7) * amp * 0.5 + Math.sin(x * 3.7 - t * 0.6 + line * 1.3) * amp * 0.22;

    const pulsing = (x: number, line: number, t: number, amp: number) => {
      // Tighter, faster waves that swell together on a shared beat.
      const beat = 0.55 + 0.45 * Math.sin(t * 2.6);
      const taper = Math.cos((x - 0.5) * Math.PI) ** 2;
      return Math.sin(x * 7.5 + t * 2.4 + line * 0.45) * amp * 0.5 * beat * taper;
    };

    const rippling = (x: number, line: number, t: number, amp: number) => {
      // Rings opening out from the centre: a standing wave that fades at the edges.
      const d = Math.abs(x - 0.5) * 2;
      const ring = Math.sin(d * 7 - t * 2.1 + line * 0.5);
      return ring * amp * 0.52 * (1 - d * 0.65) * (0.65 + line * 0.07);
    };

    const SHAPES = [flowing, pulsing, rippling, flowing] as const;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      if (!resize()) return;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      /*
       * The frame's timestamp is when the frame began, which can be a moment
       * before `started` was read, so elapsed time is clamped: a negative value
       * would index the movement list from the wrong end.
       */
      const elapsed = Math.max(0, now - started);
      const t = elapsed / 1000;
      const currentMood = moodRef.current;
      const level = Math.max(0, Math.min(1, levelRef.current ?? 0));

      // Which movement, and how far into the change to the next one.
      const cycle = elapsed / PHASE_MS;
      const index = Math.floor(cycle) % SHAPES.length;
      const within = (cycle - Math.floor(cycle)) * PHASE_MS;
      const blend = ease((within - (PHASE_MS - BLEND_MS)) / BLEND_MS);
      const shapeA = SHAPES[index]!;
      const shapeB = SHAPES[(index + 1) % SHAPES.length]!;

      // How tall the lines run, and how fast, for the state the window is in.
      const base = height * 0.3;
      const amp =
        currentMood === "speaking"
          ? base * (0.5 + level * 0.75)
          : currentMood === "listening"
            ? base * (0.22 + level * 0.9)
            : currentMood === "thinking"
              ? base * 0.42
              : base * 0.2;
      const speed = currentMood === "thinking" ? 1.45 : currentMood === "speaking" ? 1.2 : 1;
      const time = t * speed;
      const middle = height / 2;
      const steps = Math.max(28, Math.min(72, Math.round(width / 7)));

      context.lineCap = "round";
      context.globalCompositeOperation = "lighter";

      for (let line = 0; line < LINES; line++) {
        const [r, g, b] = COLOURS[line]!;
        const depth = line / (LINES - 1);
        context.beginPath();
        for (let step = 0; step <= steps; step++) {
          const x = step / steps;
          // Lines fade out towards both ends so they never collide with the window's edge.
          const fade = Math.sin(x * Math.PI) ** 0.75;
          const a = shapeA(x, line, time, amp);
          const bb = shapeB(x, line, time, amp);
          const y = middle + (a + (bb - a) * blend) * fade;
          const px = x * width;
          if (step === 0) context.moveTo(px, y);
          else context.lineTo(px, y);
        }
        context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(0.5 - depth * 0.26) * (0.55 + level * 0.45)})`;
        context.lineWidth = 1.5 - depth * 0.55;
        context.stroke();
      }
      context.globalCompositeOperation = "source-over";
    };

    /** A still frame, for a reader who asked for less motion. */
    const still = () => {
      if (!resize()) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const middle = height / 2;
      for (let line = 0; line < LINES; line++) {
        const [r, g, b] = COLOURS[line]!;
        const offset = (line - (LINES - 1) / 2) * 4;
        context.beginPath();
        context.moveTo(0, middle + offset);
        context.lineTo(width, middle + offset);
        context.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        context.lineWidth = 1;
        context.stroke();
      }
    };

    if (reduceMotion) {
      still();
      return;
    }

    const start = () => {
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(draw);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion, levelRef]);

  return <canvas ref={canvas} className={cn("block h-full w-full", className)} aria-hidden="true" data-voice-waves={mood} />;
}
