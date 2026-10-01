import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** The heading block every workspace page starts with. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-ink-400">{eyebrow}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink-50 sm:text-[34px]">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-[16px] font-medium text-ink-50">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-400">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
