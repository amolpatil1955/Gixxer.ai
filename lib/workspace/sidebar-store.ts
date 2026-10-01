"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Whether the desktop sidebar is collapsed to a rail. A per-viewer
 * convenience kept in localStorage and read through useSyncExternalStore:
 * the server snapshot says "expanded", the client snapshot says what the
 * viewer chose, and React reconciles after hydration without a mismatch.
 */

const KEY = "gixxer-sidebar";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
}

const getServerSnapshot = () => false;

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(KEY, "collapsed");
      else localStorage.removeItem(KEY);
    } catch {
      // Private mode: the choice lasts for this page view only.
    }
    for (const listener of listeners) listener();
  }, []);
  return [collapsed, setCollapsed];
}
