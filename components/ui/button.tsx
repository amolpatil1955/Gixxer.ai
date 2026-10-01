import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-ink-50 text-ink-950 hover:bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-glow disabled:hover:bg-ink-50",
  secondary:
    "border border-line-strong bg-ink-900 text-ink-50 hover:border-white/30 hover:bg-ink-800 disabled:hover:bg-ink-900",
  ghost: "text-ink-200 hover:bg-ink-800 hover:text-ink-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

interface ButtonStyleOptions {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Shared styles, so links can look like buttons without becoming buttons. */
export function buttonClassName({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium tracking-tight transition-[background-color,box-shadow,border-color,transform,opacity] duration-200 ease-out",
    "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  /** Shows a spinner and blocks interaction while true. */
  loading?: boolean;
  /** Text announced and shown while loading. Defaults to the children. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, loading = false, loadingLabel, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});
