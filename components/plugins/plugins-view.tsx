"use client";

import { useState } from "react";
import { SearchField } from "@/components/workspace/primitives";
import { PLUGINS, type PluginId } from "@/lib/plugins/catalog";
import { PluginGlyph } from "./plugin-glyph";
import { PluginToggles } from "./plugin-toggles";

/** The Plugins page: what is installed, what is available, what is coming. */
export function PluginsView({ enabled }: { enabled: PluginId[] }) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(enabled);
  const installed = PLUGINS.filter((plugin) => current.includes(plugin.id));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <section aria-labelledby="plugins-installed" className="min-w-0">
          <h2 id="plugins-installed" className="text-[13px] font-medium text-ink-300">
            Installed
          </h2>
          <ul className="mt-2 flex items-center gap-2" aria-label="Installed plugins">
            {installed.length === 0 ? <li className="text-[13px] text-ink-400">None yet. Switch one on below.</li> : null}
            {installed.map((plugin) => (
              <li key={plugin.id} title={plugin.name}>
                <PluginGlyph id={plugin.id} className="size-11 rounded-full" />
                <span className="sr-only">{plugin.name}</span>
              </li>
            ))}
          </ul>
        </section>
        <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins" aria-label="Search plugins" className="w-44 shrink-0 sm:w-64" />
      </div>
      <PluginToggles enabled={current} onChange={setCurrent} query={query} />
    </div>
  );
}
