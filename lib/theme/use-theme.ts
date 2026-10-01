"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

/*
 * The theme lives on <html data-theme data-theme-preference>, written before
 * first paint by THEME_INIT_SCRIPT. React reads it through useSyncExternalStore
 * rather than useState, so the server and the hydrating client agree and the
 * DOM stays the single source of truth.
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", emit);
  // Another tab changing the preference should update this one.
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", emit);
    window.removeEventListener("storage", emit);
  };
}

function readPreference(): ThemePreference {
  const stored = document.documentElement.dataset.themePreference;
  return isThemePreference(stored) ? stored : "system";
}

function readResolved(): ResolvedTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** One string so the snapshot is comparable by value and never re-renders needlessly. */
function getSnapshot(): string {
  return `${readPreference()}:${readResolved()}`;
}

function getServerSnapshot(): string {
  return "system:dark";
}

export interface ThemeState {
  /** What the visitor chose. */
  preference: ThemePreference;
  /** What is actually applied right now. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export function useTheme(): ThemeState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [preference, resolved] = snapshot.split(":") as [ThemePreference, ResolvedTheme];

  const setPreference = useCallback((next: ThemePreference) => {
    const element = document.documentElement;
    const applied = next === "system" ? systemTheme() : next;
    element.dataset.theme = applied;
    element.dataset.themePreference = next;
    element.style.colorScheme = applied;
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice still applies for this page view.
    }
    emit();
  }, []);

  return { preference, resolved, setPreference };
}

/** Just the applied theme, for code that only needs to pick a colour. */
export function useResolvedTheme(): ResolvedTheme {
  return useTheme().resolved;
}
