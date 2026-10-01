"use client";

import { getPasswordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils/cn";

/** Monochrome ramp: colour in this product means "error", never "score". */
const BAR_COLOURS = ["bg-ink-600", "bg-ink-500", "bg-ink-400", "bg-ink-200", "bg-ink-50"] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = getPasswordStrength(password);
  if (password.length === 0) return null;

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              step <= score ? BAR_COLOURS[score] : "bg-ink-600",
            )}
          />
        ))}
      </div>
      <p className="text-[12px] text-ink-400">
        Password strength: <span className="text-ink-200">{label}</span>
      </p>
    </div>
  );
}
