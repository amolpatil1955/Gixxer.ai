"use client";

import { Database, Puzzle, Settings, Shield, SlidersHorizontal, UserRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UserSettingsDto } from "@/lib/settings/types";
import { cn } from "@/lib/utils/cn";
import type { ShellUser } from "../account-menu";
import { DataSection } from "./data-section";
import { GeneralSection } from "./general-section";
import { PersonalizationSection } from "./personalization-section";
import { PluginsSection } from "./plugins-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";

export type SettingsSection = "general" | "personalization" | "plugins" | "profile" | "security" | "data";

const SECTIONS: { id: SettingsSection; label: string; Icon: LucideIcon }[] = [
  { id: "general", label: "General", Icon: Settings },
  { id: "personalization", label: "Personalization", Icon: SlidersHorizontal },
  { id: "plugins", label: "Plugins", Icon: Puzzle },
  { id: "profile", label: "Profile", Icon: UserRound },
  { id: "security", label: "Security and login", Icon: Shield },
  { id: "data", label: "Data controls", Icon: Database },
];

interface SettingsDialogProps {
  user: ShellUser;
  initialSettings: UserSettingsDto;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
}

/** The settings window: a section list on the left, the section on the right. */
export function SettingsDialog({ user, initialSettings, section, onSectionChange, onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState(initialSettings);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The listener is registered once; the latest onClose is read through a ref.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]!;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative flex h-[min(680px,92dvh)] w-[min(960px,100%)] flex-col overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-float sm:flex-row"
      >
        <div className="flex shrink-0 flex-col border-b border-line sm:w-60 sm:border-b-0 sm:border-r">
          <div className="flex items-center gap-2 px-3 pt-3">
            <button ref={closeButton} type="button" onClick={onClose} aria-label="Close settings" className="flex size-9 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-ink-50">
              <X className="size-4.5" aria-hidden="true" />
            </button>
            <span id="settings-title" className="text-[13px] font-medium text-ink-300 sm:sr-only">
              Settings
            </span>
          </div>
          <nav aria-label="Settings sections" className="scrollbar-thin overflow-x-auto px-3 pb-3 pt-2 sm:overflow-visible sm:pt-4">
            <ul className="flex gap-1 sm:flex-col">
              {SECTIONS.map((item) => {
                const active = item.id === section;
                return (
                  <li key={item.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onSectionChange(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13.5px] transition-colors",
                        active ? "bg-ink-700 text-ink-50" : "text-ink-200 hover:bg-ink-800 hover:text-ink-50",
                      )}
                    >
                      <item.Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-50">{current.label}</h2>
          <div className="mt-5">
            {section === "general" ? <GeneralSection /> : null}
            {section === "personalization" ? <PersonalizationSection settings={settings} onSaved={setSettings} /> : null}
            {section === "plugins" ? <PluginsSection settings={settings} onChange={(plugins) => setSettings((value) => ({ ...value, plugins }))} /> : null}
            {section === "profile" ? <ProfileSection user={user} /> : null}
            {section === "security" ? <SecuritySection user={user} /> : null}
            {section === "data" ? <DataSection /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A labelled row inside a settings section: title and description on the left, the control on the right. */
export function SettingRow({ title, description, children, stacked = false }: { title: string; description?: string; children?: React.ReactNode; stacked?: boolean }) {
  return (
    <div className={cn("border-b border-line py-4 last:border-b-0", stacked ? "space-y-3" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-ink-50">{title}</p>
        {description ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{description}</p> : null}
      </div>
      {children ? <div className={cn("shrink-0", stacked ? "" : "sm:ml-6")}>{children}</div> : null}
    </div>
  );
}
