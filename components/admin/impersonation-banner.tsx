"use client";

import { ShieldAlert } from "lucide-react";
import { useTransition } from "react";
import { stopImpersonationAction } from "@/lib/admin/actions";

/*
 * Shown across the top of every page for the whole time an admin is signed in
 * as someone else. It is deliberately impossible to miss and impossible to
 * dismiss: the one thing worse than this feature existing is forgetting it is on.
 */
export function ImpersonationBanner({ email, actorEmail }: { email: string; actorEmail: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="status" data-impersonation-banner={email} className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#ffcf6b]/30 bg-[#ffcf6b]/12 px-4 py-2 text-[12.5px] text-ink-50">
      <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="min-w-0">
        You are signed in as <strong className="font-semibold">{email}</strong>. Everything you do here happens in their account, and this is recorded against {actorEmail}.
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => void stopImpersonationAction())}
        disabled={pending}
        className="ml-auto shrink-0 rounded-full border border-ink-50/30 px-3 py-1 text-[12px] font-medium text-ink-50 transition-colors hover:bg-ink-50/10 disabled:opacity-60"
      >
        {pending ? "Leaving…" : "Leave this account"}
      </button>
    </div>
  );
}
