"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/*
 * The app's own confirmation window, in place of the browser's confirm():
 * small, centred, one question, Cancel and the action. Escape or a click on
 * the backdrop cancels. `useConfirm` returns a promise-based `confirm` and
 * the element to render.
 */

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the red button. */
  tone?: "danger" | "default";
}

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
  const settle = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );
  return { confirm, dialog: <ConfirmDialog pending={pending} onSettle={settle} /> };
}

function ConfirmDialog({ pending, onSettle }: { pending: Pending | null; onSettle: (value: boolean) => void }) {
  const titleId = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const settle = useRef(onSettle);
  useEffect(() => {
    settle.current = onSettle;
  });

  useEffect(() => {
    if (!pending) return;
    cancelButton.current?.focus();
    // Captured first, so Escape closes only this window and not a settings window beneath it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      event.preventDefault();
      settle.current(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending]);

  return (
    <AnimatePresence>
      {pending ? (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          onClick={() => onSettle(false)}
          role="presentation"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ scale: 0.96, y: 6 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="w-[min(400px,100%)] rounded-2xl border border-line-strong bg-ink-900 p-5 shadow-float"
          >
            <h2 id={titleId} className="text-[16px] font-semibold tracking-[-0.01em] text-ink-50">
              {pending.title}
            </h2>
            {pending.body ? <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">{pending.body}</div> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancelButton} type="button" onClick={() => onSettle(false)} className="h-9 rounded-full border border-line-strong px-4 text-[13px] text-ink-100 transition-colors hover:bg-ink-800">
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => onSettle(true)}
                className={cn(
                  "h-9 rounded-full px-4 text-[13px] font-medium transition-colors",
                  pending.tone === "default" ? "bg-ink-50 text-ink-950 hover:bg-white" : "bg-[#e5484d] text-white hover:bg-[#d93d42]",
                )}
              >
                {pending.confirmLabel ?? "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
