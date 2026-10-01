"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, disabled, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(inputClassName, "pr-12", className)}
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink-400 transition-colors hover:text-ink-50 focus-visible:text-ink-50 disabled:pointer-events-none"
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
});
