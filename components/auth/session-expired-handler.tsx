"use client";

import { useEffect, useRef } from "react";
import { logoutAction } from "@/lib/auth/actions";

/** Clears a stale session cookie by submitting the logout action once on mount. */
export function SessionExpiredHandler() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logoutAction("expired");
  }, []);

  return null;
}
