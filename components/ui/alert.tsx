import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AlertProps {
  tone?: "error" | "info";
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = "error", children, className }: AlertProps) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug",
        tone === "error"
          ? "border-danger/30 bg-danger-soft text-ink-50"
          : "border-line-strong bg-ink-800 text-ink-100",
        className,
      )}
    >
      <Icon className={cn("mt-px size-4 shrink-0", tone === "error" ? "text-danger" : "text-ink-300")} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
