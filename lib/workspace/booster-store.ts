"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Whether Booster is on. Remembered per viewer in localStorage so the switch
 * survives the first message of a chat (which mounts the conversation page)
 * and the next visit. Read through useSyncExternalStore: the server says
 * "off", the client says what the viewer chose.
 */

const KEY = "gixxer-booster";
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
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

const getServerSnapshot = () => false;

export function useBooster(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setOn = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(KEY, "on");
      else localStorage.removeItem(KEY);
    } catch {}
    for (const listener of listeners) listener();
  }, []);
  return [on, setOn];
}
