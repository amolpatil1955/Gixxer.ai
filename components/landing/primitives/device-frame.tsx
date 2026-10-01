import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DeviceFrameProps {
  /** Address shown in the chrome. */
  url: string;
  /** A small badge at the right of the chrome. Pass null to hide it. */
  badge?: string | null;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A browser window: three dots, an address, a badge. Every product mockup on
 * the page sits inside one, so they read as the same product.
 */
export function DeviceFrame({ url, badge = "Preview", children, className, bodyClassName }: DeviceFrameProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl edge-lit shadow-float sm:rounded-[22px]", className)}>
      <div className="flex h-11 items-center gap-2 border-b border-line bg-ink-900/60 px-4">
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="size-2.5 rounded-full bg-ink-600" />
        <span className="ml-3 hidden truncate font-mono text-[11px] tracking-wide text-ink-400 sm:block">{url}</span>
        {badge ? (
          <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </div>
  );
}
