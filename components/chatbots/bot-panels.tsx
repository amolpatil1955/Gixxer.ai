"use client";

import { Check, Copy, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sparkline } from "@/components/landing/primitives/sparkline";
import type { BotDto } from "@/lib/bots/types";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

export interface AnalyticsDto {
  conversations: number;
  messages: number;
  leads: number;
  perDay: { day: string; count: number }[];
  topSources: { name: string; count: number }[];
}

export interface ConversationDto {
  id: string;
  sessionId: string;
  origin: string | null;
  lastMessageAt: string;
  messages: { role: "user" | "assistant"; content: string; sources: string[]; createdAt: string }[];
}

export interface LeadDto {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

const label = "font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400";
const card = "rounded-2xl border border-line bg-ink-900/60 p-5";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function Overview({ bot, analytics, sourceCount, latest }: { bot: BotDto; analytics: AnalyticsDto; sourceCount: number; latest: ConversationDto[] }) {
  const steps = [
    { done: sourceCount > 0, label: "Add knowledge", href: workspaceRoutes.chatbot(bot.id, "knowledge") },
    { done: bot.instructions.length > 0 || bot.businessInfo.length > 0, label: "Describe the business and set instructions", href: workspaceRoutes.chatbot(bot.id, "instructions") },
    { done: bot.status === "live", label: "Go live", href: workspaceRoutes.chatbot(bot.id, "embed") },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={card}>
        <p className={label}>Conversations</p>
        <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink-50">{analytics.conversations}</p>
      </div>
      <div className={card}>
        <p className={label}>Leads</p>
        <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink-50">{analytics.leads}</p>
      </div>
      <div className={card}>
        <p className={label}>Knowledge</p>
        <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink-50">{sourceCount}</p>
        <p className="mt-1 text-[12px] text-ink-400">source{sourceCount === 1 ? "" : "s"}</p>
      </div>
      <div className={cn(card, "lg:col-span-2")}>
        <p className={label}>Conversations per day, last 14 days</p>
        <div className="mt-3">
          <Sparkline data={analytics.perDay.map((day) => day.count)} label="Conversations per day, last 14 days" />
        </div>
      </div>
      <div className={card}>
        <p className={label}>Set-up</p>
        <ol className="mt-3 space-y-2">
          {steps.map((step) => (
            <li key={step.label}>
              <Link href={step.href} className="flex items-center gap-2.5 text-[13.5px] text-ink-200 hover:text-ink-50">
                <span className={cn("flex size-5 items-center justify-center rounded-full border", step.done ? "border-transparent bg-ink-50 text-ink-950" : "border-line-strong text-transparent")}>
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className={cn(card, "lg:col-span-3")}>
        <p className={label}>Latest conversations</p>
        {latest.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-ink-400">No visitors yet. Once the bot is live on your site, conversations appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {latest.slice(0, 5).map((conversation) => (
              <li key={conversation.id} className="py-2.5 text-[13.5px]">
                <span className="line-clamp-1 text-ink-100">{conversation.messages.find((message) => message.role === "user")?.content ?? "(empty)"}</span>
                <span className="font-mono text-[10.5px] text-ink-400">{when(conversation.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Conversations({ conversations }: { conversations: ConversationDto[] }) {
  const [open, setOpen] = useState<string | null>(conversations[0]?.id ?? null);
  if (conversations.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[13.5px] text-ink-400">No conversations yet.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Conversations">
      {conversations.map((conversation) => {
        const expanded = open === conversation.id;
        return (
          <li key={conversation.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : conversation.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-900/60"
            >
              <MessageSquare className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[14px] text-ink-50">{conversation.messages.find((message) => message.role === "user")?.content ?? "(empty)"}</span>
                <span className="font-mono text-[10.5px] text-ink-400">
                  {conversation.messages.length} messages · {when(conversation.lastMessageAt)}
                  {conversation.origin ? ` · ${conversation.origin}` : ""}
                </span>
              </span>
            </button>
            {expanded ? (
              <ol className="space-y-2.5 border-t border-line bg-ink-950/60 px-4 py-4">
                {conversation.messages.map((message, index) => (
                  <li key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug", message.role === "user" ? "bg-ink-50 text-ink-950" : "border border-line bg-ink-900 text-ink-100")}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.sources.length ? <p className="mt-1 font-mono text-[10px] text-ink-400">Sources: {message.sources.join(", ")}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Leads({ leads }: { leads: LeadDto[] }) {
  if (leads.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[13.5px] text-ink-400">
        <Users className="mx-auto mb-2 size-5 text-ink-400" aria-hidden="true" />
        No leads yet. Visitors can leave their details from the widget.
      </p>
    );
  }
  const csv = ["name,email,message,when", ...leads.map((lead) => [lead.name, lead.email, lead.message, lead.createdAt].map((value) => `"${value.replace(/"/g, '""')}"`).join(","))].join("\n");
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full text-left text-[13.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
            <th scope="col" className="border-b border-line px-4 py-2.5 font-normal">Name</th>
            <th scope="col" className="border-b border-line px-4 py-2.5 font-normal">Email</th>
            <th scope="col" className="border-b border-line px-4 py-2.5 font-normal">Message</th>
            <th scope="col" className="border-b border-line px-4 py-2.5 font-normal">When</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="text-ink-200">
              <td className="border-b border-line px-4 py-3 text-ink-50">{lead.name || "—"}</td>
              <td className="border-b border-line px-4 py-3">
                <a href={`mailto:${lead.email}`} className="hover:underline">
                  {lead.email}
                </a>
              </td>
              <td className="max-w-xs border-b border-line px-4 py-3">
                <span className="line-clamp-2">{lead.message || "—"}</span>
              </td>
              <td className="border-b border-line px-4 py-3 font-mono text-[11px] text-ink-400">{when(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-ink-400">
        <span>{leads.length} lead{leads.length === 1 ? "" : "s"}</span>
        <a href={href} download="leads.csv" className="rounded-md border border-line px-2 py-1 font-mono text-[10.5px] text-ink-200 hover:border-ink-400">
          Export CSV
        </a>
      </div>
    </div>
  );
}

export function Analytics({ analytics }: { analytics: AnalyticsDto }) {
  const max = Math.max(1, ...analytics.perDay.map((day) => day.count));
  const sourceMax = Math.max(1, ...analytics.topSources.map((source) => source.count));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className={card}>
        <p className={label}>Conversations started per day</p>
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label={`Conversations per day over the last 14 days, ${analytics.conversations} in total`}>
          {analytics.perDay.map((day) => (
            <div key={day.day} className="flex flex-1 flex-col items-center gap-1.5" title={`${day.day}: ${day.count}`}>
              <span className="w-full rounded-t-[4px] bg-ink-50" style={{ height: `${Math.max(2, (day.count / max) * 100)}%` }} />
              <span className="font-mono text-[8.5px] text-ink-500">{day.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <p className={label}>Sources cited in replies</p>
        {analytics.topSources.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-400">No cited replies yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {analytics.topSources.map((source) => (
              <li key={source.name} className="grid grid-cols-[110px_1fr_36px] items-center gap-3 text-[12.5px]">
                <span className="truncate text-ink-200">{source.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-ink-800">
                  <span className="block h-full rounded-full bg-ink-50" style={{ width: `${(source.count / sourceMax) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[11px] text-ink-300">{source.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={cn(label, "mt-6")}>Totals</p>
        <p className="mt-2 text-[13px] text-ink-200">
          {analytics.messages} messages across {analytics.conversations} conversations, {analytics.leads} leads.
        </p>
      </div>
    </div>
  );
}

export function Embed({ bot, origin }: { bot: BotDto; origin: string }) {
  const snippet = `<script src="${origin}/widget.js" data-bot="${bot.publicKey}" async></script>`;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={label}>Install</p>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-ink-900 px-2.5 py-1 text-[12px] text-ink-200 hover:border-ink-400 hover:text-ink-50">
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink-950/70 px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-200">
          <code>{snippet}</code>
        </pre>
        <p aria-live="polite" className="sr-only">
          {copied ? "Embed snippet copied" : ""}
        </p>
        <ol className="mt-4 space-y-1.5 text-[13.5px] text-ink-300">
          <li>1. Paste the tag before the closing body tag of any page.</li>
          <li>2. Set the bot to Live. Until then the launcher shows nothing.</li>
          <li>3. Optionally restrict it to your domains under Settings.</li>
        </ol>
      </div>
      <div className={card}>
        <p className={label}>Status</p>
        <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-50">
          <span className={cn("size-2 rounded-full", bot.status === "live" ? "bg-success" : "bg-ink-500")} aria-hidden="true" />
          {bot.status === "live" ? "Live and answering" : "Draft: the widget is hidden"}
        </p>
        <p className="mt-2 text-[12.5px] text-ink-400">
          Public key <code className="font-mono text-ink-200">{bot.publicKey}</code>. It only identifies the bot; it cannot read anything else.
        </p>
        {bot.status === "live" ? (
          <Link href={`/embed/${bot.publicKey}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-100 hover:border-ink-400">
            Open the chat page
          </Link>
        ) : null}
      </div>
    </div>
  );
}
