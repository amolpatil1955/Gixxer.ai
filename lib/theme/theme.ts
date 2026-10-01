/** Client-safe theme constants. No secrets, no environment access. */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "gixxer-theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Runs before first paint, inline in <head>, so the page never flashes the
 * wrong theme. Kept to one statement and written defensively: private-mode
 * browsers throw on localStorage, and the page must still render.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var p=(s==="light"||s==="dark"||s==="system")?s:"system";var r=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var e=document.documentElement;e.dataset.theme=r;e.dataset.themePreference=p;e.style.colorScheme=r;}catch(_){document.documentElement.dataset.theme="dark";}})();`;
