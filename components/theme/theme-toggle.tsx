"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/use-theme";
import type { ThemePreference } from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
];

/**
 * A three-way segmented control rather than a two-state switch, because
 * "follow my system" is a real preference and a toggle cannot express it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-ink-900 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors duration-200",
              active ? "bg-ink-50 text-ink-950" : "text-ink-400 hover:text-ink-100",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
