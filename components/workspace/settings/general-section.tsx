"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Kbd } from "../primitives";
import { SettingRow } from "./settings-dialog";

export function GeneralSection() {
  return (
    <div>
      <SettingRow title="Appearance" description="Glossy black, white, or whatever your system is using.">
        <ThemeToggle />
      </SettingRow>
      <SettingRow title="Motion" description="Animations follow your system's reduce-motion setting. Nothing here overrides it." />
      <SettingRow title="Keyboard shortcuts" stacked>
        <dl className="grid gap-2 text-[13px] text-ink-200 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800/70 px-3 py-2">
            <dt>Send message</dt>
            <dd>
              <Kbd>Enter</Kbd>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800/70 px-3 py-2">
            <dt>New line</dt>
            <dd>
              <Kbd>Shift</Kbd> <Kbd>Enter</Kbd>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800/70 px-3 py-2">
            <dt>Close a menu or this window</dt>
            <dd>
              <Kbd>Esc</Kbd>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800/70 px-3 py-2">
            <dt>Stop a reply</dt>
            <dd>
              <Kbd>Esc</Kbd> while streaming
            </dd>
          </div>
        </dl>
      </SettingRow>
    </div>
  );
}
