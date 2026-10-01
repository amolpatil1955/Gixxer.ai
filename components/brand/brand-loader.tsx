import { cn } from "@/lib/utils/cn";
import { Wordmark } from "./wordmark";

interface BrandLoaderProps {
  label: string;
  /** Fills the viewport rather than its container. Use outside an app shell. */
  fullScreen?: boolean;
}

/** Branded loading state: wordmark, sweeping progress bar, quiet caption. */
export function BrandLoader({ label, fullScreen = false }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-ink-950 px-6",
        fullScreen ? "min-h-dvh" : "min-h-[60vh]",
      )}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.035] blur-3xl" />
      </div>
      <Wordmark size="lg" className="relative" />
      <div className="relative mt-12 h-1.25 w-full max-w-sm overflow-hidden rounded-full bg-ink-700">
        <div className="h-full w-2/3 animate-progress rounded-full bg-linear-to-r from-transparent via-ink-50 to-transparent shadow-glow" />
      </div>
      <p className="relative mt-6 font-mono text-[11px] uppercase tracking-[0.35em] text-ink-400">{label}…</p>
    </div>
  );
}
