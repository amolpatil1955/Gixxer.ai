"use client";

import { ChevronRight, CircleHelp, LogOut, Puzzle, Settings, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";
import type { SettingsSection } from "./settings/settings-dialog";

export interface ShellUser {
  name: string;
  email: string;
  image: string | null;
  /** ISO date the account was created. */
  createdAt: string;
  provider: "credentials" | "google";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** A stable hue per person, so avatars differ without storing a colour. */
function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

export function Avatar({ user, className }: { user: Pick<ShellUser, "name" | "email" | "image">; className?: string }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element -- a remote OAuth avatar, tiny, no optimisation needed
    return <img src={user.image} alt="" className={cn("size-8 rounded-full object-cover", className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white", className)}
      style={{ background: `oklch(0.62 0.13 ${hueOf(user.email)})` }}
    >
      {initialsOf(user.name)}
    </span>
  );
}

interface AccountMenuProps {
  user: ShellUser;
  onOpenSettings: (section: SettingsSection) => void;
  /** Icon only, for the collapsed rail. */
  compact?: boolean;
}

/** The account button at the foot of the sidebar and the menu it opens. */
export function AccountMenu({ user, onOpenSettings, compact = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(section: SettingsSection) {
    setOpen(false);
    onOpenSettings(section);
  }

  const items: { label: string; Icon: typeof Settings; section: SettingsSection }[] = [
    { label: "Personalization", Icon: SlidersHorizontal, section: "personalization" },
    { label: "Plugins", Icon: Puzzle, section: "plugins" },
    { label: "Profile", Icon: UserRound, section: "profile" },
    { label: "Settings", Icon: Settings, section: "general" },
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${user.name}` : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl text-left transition-colors hover:bg-ink-800",
          compact ? "size-10 justify-center" : "px-2 py-2",
        )}
      >
        <Avatar user={user} />
        {compact ? null : (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-ink-50">{user.name}</span>
            <span className="block truncate text-[11.5px] text-ink-400">{user.email}</span>
          </span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className={cn("absolute bottom-full z-30 mb-2 w-[272px] overflow-hidden rounded-2xl border border-line bg-ink-900 p-1.5 shadow-lift", compact ? "left-0" : "left-0 right-0 w-auto")}
        >
          <button type="button" role="menuitem" onClick={() => pick("profile")} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink-800">
            <Avatar user={user} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink-50">{user.name}</span>
              <span className="block truncate text-[11.5px] text-ink-400">{user.email}</span>
            </span>
            <ChevronRight className="size-4 text-ink-400" aria-hidden="true" />
          </button>
          <div className="my-1.5 border-t border-line" />
          {items.map((item) => (
            <button key={item.section} type="button" role="menuitem" onClick={() => pick(item.section)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink-100 hover:bg-ink-800">
              <item.Icon className="size-4 text-ink-300" aria-hidden="true" />
              {item.label}
            </button>
          ))}
          <div className="my-1.5 border-t border-line" />
          <Link href="/#faq" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink-100 hover:bg-ink-800">
            <CircleHelp className="size-4 text-ink-300" aria-hidden="true" />
            Help
            <ChevronRight className="ml-auto size-4 text-ink-400" aria-hidden="true" />
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => startTransition(() => logoutAction())}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink-100 hover:bg-ink-800 disabled:opacity-60"
          >
            {pending ? <Spinner className="size-4" /> : <LogOut className="size-4 text-ink-300" aria-hidden="true" />}
            {pending ? "Signing out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
