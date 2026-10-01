"use client";

import Link from "next/link";
import { PluginToggles } from "@/components/plugins/plugin-toggles";
import type { PluginId } from "@/lib/plugins/catalog";
import type { UserSettingsDto } from "@/lib/settings/types";
import { workspaceRoutes } from "@/lib/workspace/routes";

export function PluginsSection({ settings, onChange }: { settings: UserSettingsDto; onChange: (plugins: PluginId[]) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-ink-300">
        Plugins run around every chat turn. Switch one on here or on the{" "}
        <Link href={workspaceRoutes.plugins} className="text-ink-50 underline underline-offset-4">
          Plugins page
        </Link>
        .
      </p>
      <PluginToggles enabled={settings.plugins} onChange={onChange} showUpcoming={false} />
    </div>
  );
}
