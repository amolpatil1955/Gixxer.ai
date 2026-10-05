"use client";

import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/workspace/page-header";
import type { BotDto } from "@/lib/bots/types";
import { workspaceRoutes } from "@/lib/workspace/routes";

export function BotList({ bots }: { bots: BotDto[] }) {
  return (
    <div className="space-y-8">
      {bots.length === 0 ? (
        <EmptyState title="No chatbots yet" description="Create one, feed it your website or documents, then paste one script tag into your site.">
          <Link href={workspaceRoutes.newChatbot} className={buttonClassName()}>
            <Plus className="size-4" aria-hidden="true" />
            Create a chatbot
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Your chatbots">
          {bots.map((bot) => (
            <li key={bot.id}>
              <Link href={workspaceRoutes.chatbot(bot.id)} className="plate spotlight flex items-center gap-4 rounded-2xl p-4 transition-transform hover:-translate-y-0.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-black italic text-ink-950" style={{ background: bot.theme.accent === "#030000" ? "var(--color-ink-50)" : bot.theme.accent }}>
                  {bot.avatarLetter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink-50">{bot.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-400">{bot.businessName || "No business name yet"}</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-300">
                  {bot.status === "live" ? <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> : null}
                  {bot.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-2 text-[12.5px] text-ink-400">
        <Bot className="size-3.5" aria-hidden="true" />
        Bots answer only from the knowledge you give them, and every conversation and lead lands in the dashboard.
      </p>
    </div>
  );
}
