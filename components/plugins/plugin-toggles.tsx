"use client";

import { Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { PLUGINS, UPCOMING, type PluginEntry, type PluginId } from "@/lib/plugins/catalog";
import { togglePluginAction } from "@/lib/settings/actions";
import { cn } from "@/lib/utils/cn";
import { PluginGlyph } from "./plugin-glyph";

interface PluginTogglesProps {
  enabled: PluginId[];
  onChange?: (enabled: PluginId[]) => void;
  /** Free-text filter from a search field. */
  query?: string;
  /** Show the connectors that are not built yet, labelled as such. */
  showUpcoming?: boolean;
}

function matches(query: string, ...fields: string[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((field) => field.toLowerCase().includes(q));
}

/** The catalogue as toggles. Shared by the Plugins page and the settings dialog. */
export function PluginToggles({ enabled, onChange, query = "", showUpcoming = true }: PluginTogglesProps) {
  const [current, setCurrent] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<PluginId | null>(null);

  function toggle(plugin: PluginEntry) {
    const next = current.includes(plugin.id) ? current.filter((id) => id !== plugin.id) : [...current, plugin.id];
    setCurrent(next);
    setBusy(plugin.id);
    setError(null);
    startTransition(async () => {
      const result = await togglePluginAction({ plugin: plugin.id, enabled: next.includes(plugin.id) });
      setBusy(null);
      if (!result.ok) {
        setCurrent(current);
        setError(result.message);
        return;
      }
      setCurrent(result.settings.plugins);
      onChange?.(result.settings.plugins);
    });
  }

  const available = PLUGINS.filter((plugin) => matches(query, plugin.name, plugin.tagline, plugin.description));
  const upcoming = showUpcoming ? UPCOMING.filter((entry) => matches(query, entry.name, entry.tagline)) : [];

  return (
    <div className="space-y-8">
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="plugins-available">
        <h2 id="plugins-available" className="text-[15px] font-semibold text-ink-50">
          Available
        </h2>
        {available.length === 0 ? <p className="mt-3 text-[13.5px] text-ink-400">Nothing matches.</p> : null}
        <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {available.map((plugin) => {
            const on = current.includes(plugin.id);
            return (
              <li key={plugin.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-ink-900/70">
                <PluginGlyph id={plugin.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink-50">{plugin.name}</p>
                  <p className="truncate text-[12.5px] text-ink-400" title={plugin.description}>
                    {plugin.tagline}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${plugin.name}: ${on ? "enabled" : "disabled"}`}
                  disabled={pending && busy === plugin.id}
                  onClick={() => toggle(plugin)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60",
                    on ? "border-transparent bg-ink-50 text-ink-950 hover:bg-white" : "border-line text-ink-200 hover:border-ink-400 hover:text-ink-50",
                  )}
                >
                  {on ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {showUpcoming && upcoming.length > 0 ? (
        <section aria-labelledby="plugins-upcoming">
          <div className="flex items-baseline gap-3">
            <h2 id="plugins-upcoming" className="text-[15px] font-semibold text-ink-50">
              Coming soon
            </h2>
            <p className="text-[12.5px] text-ink-400">These need an account connection that is not built yet.</p>
          </div>
          <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2" aria-label="Connectors coming soon">
            {upcoming.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 opacity-80">
                <PluginGlyph id={entry.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink-100">{entry.name}</p>
                  <p className="truncate text-[12.5px] text-ink-400">{entry.tagline}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-400">Soon</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
