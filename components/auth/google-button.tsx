import { GoogleIcon } from "@/components/brand/google-icon";
import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/auth/features";
import { cn } from "@/lib/utils/cn";

interface GoogleButtonProps {
  label: string;
  className?: string;
}

/**
 * Rendered in its final position so the layout is settled, but inert until
 * Google OAuth is switched on. No handler exists yet, so nothing can be triggered.
 */
export function GoogleButton({ label, className }: GoogleButtonProps) {
  const enabled = GOOGLE_SIGN_IN_ENABLED;
  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={!enabled}
        aria-disabled={!enabled}
        aria-describedby={enabled ? undefined : "google-soon"}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-ink-900 text-sm font-medium text-ink-50 transition-colors",
          enabled ? "hover:border-white/30 hover:bg-ink-800" : "cursor-not-allowed opacity-55",
        )}
      >
        <GoogleIcon className="size-[18px]" />
        <span>{label}</span>
        {!enabled ? (
          <span className="ml-1 rounded-full border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Soon
          </span>
        ) : null}
      </button>
      {!enabled ? (
        <p id="google-soon" className="text-center text-[12px] text-ink-500">
          Google sign-in is coming soon.
        </p>
      ) : null}
    </div>
  );
}
