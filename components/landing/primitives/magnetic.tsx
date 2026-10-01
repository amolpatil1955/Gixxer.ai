"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { useCanHover } from "@/lib/motion/use-media-query";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils/cn";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** How far the child follows the pointer, as a fraction of the offset. */
  strength?: number;
}

/**
 * Pulls its child a few pixels toward the pointer while hovered, then
 * springs back. A small thing that makes the primary buttons feel alive.
 */
export function Magnetic({ children, className, strength = 0.22 }: MagneticProps) {
  const enabled = useCanHover();
  const reduceMotion = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 20, mass: 0.5 });

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}
