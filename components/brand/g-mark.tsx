import { cn } from "@/lib/utils/cn";

/** The Gixxer "G" icon: a heavy geometric G, open on the right, with its bar reaching the centre. */
export function GMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-5", className)} aria-hidden="true" focusable="false">
      <path d="M36.2 12.2 A17 17 0 1 0 41 24 H 25" fill="none" stroke="currentColor" strokeWidth="8.5" strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}
