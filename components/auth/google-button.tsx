import { GoogleIcon } from "@/components/brand/google-icon";
import { googleSignInAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

interface GoogleButtonProps {
  label: string;
  /** Whether the server has the Google provider mounted. Pages compute this server-side. */
  available: boolean;
  /** Internal path to land on after Google, validated again server-side. */
  nextPath?: string;
  className?: string;
}

/**
 * A plain form posting to a server action, so it works before hydration and never needs a
 * client-side handler. When the provider is not configured the button is disabled and says so.
 */
export function GoogleButton({ label, available, nextPath, className }: GoogleButtonProps) {
  return (
    <form action={googleSignInAction} className={cn("space-y-2", className)}>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <button
        type="submit"
        disabled={!available}
        aria-disabled={!available}
        aria-describedby={available ? undefined : "google-unavailable"}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-ink-900 text-sm font-medium text-ink-50 transition-colors",
          available ? "hover:border-white/30 hover:bg-ink-800" : "cursor-not-allowed opacity-55",
        )}
      >
        <GoogleIcon className="size-[18px]" />
        <span>{label}</span>
      </button>
      {!available ? (
        <p id="google-unavailable" className="text-center text-[12px] text-ink-500">
          Google sign-in is not available right now.
        </p>
      ) : null}
    </form>
  );
}
