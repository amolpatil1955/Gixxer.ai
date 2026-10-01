import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Rendered on the right of the label row, e.g. a helper link. */
  trailing?: ReactNode;
  /** Rendered after the hint or error, e.g. a strength meter. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, with the aria wiring every form needs. */
export function Field({ id, label, error, hint, trailing, footer, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-200">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-[13px] text-ink-400">
          {hint}
        </div>
      ) : null}
      {footer}
    </div>
  );
}

/** aria attributes to spread on the control inside a Field. */
export function fieldAria(id: string, error?: string, hasHint = false) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}
