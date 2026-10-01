"use client";

import { Search } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/*
 * Small controls the workspace pages share: the segmented pill tabs, the
 * round icon button, the search field and the page title row. Their look is
 * the chat app's: quiet greys, rounded, and the accent only where the reader
 * acts.
 */

export function PillTabs<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex items-center gap-0.5 rounded-full bg-ink-800 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
              active ? "bg-ink-600 text-ink-50 shadow-[inset_0_1px_0_var(--gloss-high)]" : "text-ink-300 hover:text-ink-50",
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className={cn("font-mono text-[10.5px]", active ? "text-ink-200" : "text-ink-400")}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  tone?: "quiet" | "accent" | "solid";
}

export function IconButton({ label, size = "md", tone = "quiet", className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "sm" ? "size-8" : "size-9",
        tone === "quiet" && "text-ink-300 hover:bg-ink-800 hover:text-ink-50",
        tone === "accent" && "bg-accent text-on-accent hover:bg-accent-hover disabled:hover:bg-accent",
        tone === "solid" && "bg-ink-50 text-ink-950 hover:bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input
        type="search"
        {...props}
        className="h-10 w-full rounded-full border border-line bg-ink-900 pl-9 pr-4 text-[13.5px] text-ink-50 outline-none transition-colors placeholder:text-ink-400 hover:border-line-strong focus:border-ink-400"
      />
    </label>
  );
}

export function PageTitle({ title, description, actions, className }: { title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-50 sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** The chat app's rounded surface for a list or a table. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("overflow-hidden rounded-2xl border border-line bg-ink-900/40", className)}>{children}</div>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-200">{children}</kbd>;
}

/** "2d ago", "3h ago", "just now": the library's and projects' modified column. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
