"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteBotAction, setBotStatusAction } from "@/lib/bots/actions";
import type { BotDto } from "@/lib/bots/types";
import { cn } from "@/lib/utils/cn";
import { BOT_TAB_LABELS, BOT_TABS, workspaceRoutes } from "@/lib/workspace/routes";

export function BotHeader({ bot }: { bot: BotDto }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleStatus() {
    setError(null);
    startTransition(async () => {
      const result = await setBotStatusAction({ botId: bot.id, status: bot.status === "live" ? "draft" : "live" });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete ${bot.name}, its knowledge, conversations and leads? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteBotAction({ botId: bot.id });
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full font-display text-[17px] font-black italic text-ink-950" style={{ background: bot.theme.accent === "#030000" ? "var(--color-ink-50)" : bot.theme.accent }}>
            {bot.avatarLetter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-ink-400">Chatbot Pro</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.03em] text-ink-50">{bot.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
              {bot.status === "live" ? <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> : null}
              {bot.status}
            </span>
            <Button size="sm" variant={bot.status === "live" ? "secondary" : "primary"} onClick={toggleStatus} loading={pending} loadingLabel="Saving…">
              {bot.status === "live" ? "Take offline" : "Go live"}
            </Button>
            {bot.status === "live" ? (
              <Link href={`/embed/${bot.publicKey}`} target="_blank" rel="noopener noreferrer" aria-label="Open the bot in a new tab" className="rounded-lg p-2 text-ink-300 hover:bg-ink-800 hover:text-ink-50">
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            <button type="button" onClick={remove} aria-label="Delete bot" className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-danger">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <nav aria-label="Bot sections" className="-mb-px overflow-x-auto">
          <ul className="flex gap-1">
            {BOT_TABS.map((tab) => {
              const href = workspaceRoutes.chatbot(bot.id, tab);
              const active = pathname === href;
              return (
                <li key={tab}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors",
                      active ? "border-ink-50 text-ink-50" : "border-transparent text-ink-400 hover:text-ink-50",
                    )}
                  >
                    {BOT_TAB_LABELS[tab]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
