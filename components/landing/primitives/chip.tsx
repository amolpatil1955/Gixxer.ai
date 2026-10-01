import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "outline" | "solid" | "ghost" | "glass";

const TONES: Record<Tone, string> = {
  outline: "border border-line bg-ink-900/80 text-ink-300",
  solid: "border border-transparent bg-ink-50 text-ink-950",
  ghost: "border border-transparent bg-ink-800/70 text-ink-200",
  glass: "glass text-ink-200",
};

interface ChipProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  /** Small dot at the left, for "live" or "active" states. */
  dot?: boolean;
  mono?: boolean;
}

/** A small pill of metadata. Mono and uppercase by default, the page's label voice. */
export function Chip({ children, tone = "outline", className, dot = false, mono = true }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1",
        mono ? "font-mono text-[10.5px] uppercase tracking-[0.16em]" : "text-[12.5px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Caret({ className }: { className?: string }) {
  return (
    <span
      className={cn("ml-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 animate-caret bg-ink-50 align-baseline", className)}
      aria-hidden="true"
    />
  );
}
