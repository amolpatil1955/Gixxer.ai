import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const inputClassName =
  "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-[15px] text-ink-50 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-200 hover:border-line-strong focus:border-white/40 focus:outline-none focus:ring-4 focus:ring-white/[0.06] aria-invalid:border-danger/70 aria-invalid:focus:border-danger aria-invalid:focus:ring-danger/10 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClassName, className)} {...props} />;
});
