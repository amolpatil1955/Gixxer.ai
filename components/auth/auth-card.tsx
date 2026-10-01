"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[420px]"
      aria-labelledby="auth-title"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-400">{eyebrow}</p>
      <h1 id="auth-title" className="mt-3 text-balance text-[28px] font-semibold leading-tight tracking-tight text-ink-50 sm:text-[32px]">
        {title}
      </h1>
      <p className="mt-2 text-[15px] text-ink-300">{description}</p>
      <div className="mt-8">{children}</div>
    </motion.section>
  );
}
