"use client";

import { ArrowUp, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tokensFor } from "@/lib/bots/themes";
import type { PublicBotDto, WidgetWireEvent } from "@/lib/bots/types";
import { errorMessageFrom, readNdjson } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  error?: boolean;
}

function sessionIdFor(key: string): string {
  const storageKey = `gixxer-session-${key}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const fresh = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

interface Props {
  bot: PublicBotDto;
  host: string | null;
  /** True inside the iframe; shows the close control and posts messages to the parent. */
  framed: boolean;
}

/**
 * The visitor-facing chat, rendered inside the widget iframe or on its own
 * page. It carries no account: a random session id in the visitor's
 * browser is the only identity.
 */
export function EmbedChat({ bot, host, framed }: Props) {
  const session = useRef<string | null>(null);
  const sessionId = () => (session.current ??= sessionIdFor(bot.key));
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState({ name: "", email: "", message: "" });
  const [leadState, setLeadState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [leadError, setLeadError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  // Every colour, radius and font comes from the bot's theme, so the live widget
  // looks exactly like the preview its owner approved.
  const t = tokensFor(bot.theme.preset, bot.theme.accent);
  const accent = t.accent;

  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must
  // return nothing or a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setValue("");
    setMessages((current) => [...current, { role: "user", content }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const url = `/api/widget/${encodeURIComponent(bot.key)}/chat${host ? `?host=${encodeURIComponent(host)}` : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), message: content }),
      });
      if (!response.ok) {
        const message = await errorMessageFrom(response, "Sorry, something went wrong. Please try again.");
        setMessages((current) => current.map((item, index) => (index === current.length - 1 ? { ...item, content: message, error: true } : item)));
        return;
      }
      await readNdjson<WidgetWireEvent>(response, (event) => {
        setMessages((current) => {
          const last = current[current.length - 1];
          if (!last || last.role !== "assistant") return current;
          const updated =
            event.type === "token"
              ? { ...last, content: last.content + event.text }
              : event.type === "sources"
                ? { ...last, sources: event.items }
                : event.type === "error"
                  ? { ...last, content: event.message, error: true }
                  : last;
          return [...current.slice(0, -1), updated];
        });
      });
    } catch {
      setMessages((current) => current.map((item, index) => (index === current.length - 1 ? { ...item, content: "The connection dropped. Please try again.", error: true } : item)));
    } finally {
      setStreaming(false);
    }
  }

  async function submitLead() {
    setLeadState("sending");
    setLeadError(null);
    try {
      const response = await fetch(`/api/widget/${encodeURIComponent(bot.key)}/lead`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), ...lead }),
      });
      if (!response.ok) {
        setLeadError(await errorMessageFrom(response, "Please check the form."));
        setLeadState("error");
        return;
      }
      setLeadState("sent");
    } catch {
      setLeadError("The connection dropped. Please try again.");
      setLeadState("error");
    }
  }

  function close() {
    if (framed) window.parent.postMessage({ source: "gixxer-widget", type: "close" }, "*");
  }

  return (
    <div className="flex h-dvh flex-col" style={{ background: t.surface, color: t.bubbleText, fontFamily: t.font }} data-embed-chat data-theme-preset={bot.theme.preset}>
      <header className="flex items-center gap-3 px-4 py-3" style={{ background: t.header, color: t.headerText, borderBottom: `1px solid ${t.border}` }}>
        <span className="flex size-9 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: accent, color: t.onAccent }} aria-hidden="true">
          {bot.avatarLetter}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px]" style={{ fontWeight: t.headingWeight }}>
            {bot.name}
          </p>
          {bot.businessName ? (
            <p className="truncate text-[11.5px]" style={{ color: t.muted }}>
              {bot.businessName}
            </p>
          ) : null}
        </div>
        {bot.collectLeads ? (
          <button
            type="button"
            onClick={() => setLeadOpen((open) => !open)}
            aria-expanded={leadOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]"
            style={{ border: `1px solid ${t.border}`, borderRadius: Math.max(6, Math.round(t.bubbleRadius / 2)), color: t.headerText }}
          >
            <Mail className="size-3.5" aria-hidden="true" />
            Contact
          </button>
        ) : null}
        {framed ? (
          <button type="button" onClick={close} aria-label="Close chat" className="rounded-lg p-1.5 opacity-70 hover:opacity-100" style={{ color: t.headerText }}>
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {leadOpen ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitLead();
            }}
            className="mb-4 space-y-2.5 p-3.5"
            style={{ background: t.bubble, border: `1px solid ${t.border}`, borderRadius: t.radius }}
            aria-label="Leave your details"
          >
            <p className="text-[13px] font-medium">Leave your details and we will get back to you.</p>
            {leadState === "sent" ? (
              <p role="status" className="text-[13px]">
                Thanks, {lead.name || "we have your email"}. Someone will be in touch.
              </p>
            ) : (
              <>
                <input value={lead.name} onChange={(event) => setLead({ ...lead, name: event.target.value })} placeholder="Your name" aria-label="Your name" maxLength={120} className="h-10 w-full px-3 text-[13.5px] outline-none" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: Math.max(6, Math.round(t.bubbleRadius / 2)), color: t.bubbleText }} />
                <input type="email" required value={lead.email} onChange={(event) => setLead({ ...lead, email: event.target.value })} placeholder="you@example.com" aria-label="Your email" maxLength={254} className="h-10 w-full px-3 text-[13.5px] outline-none" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: Math.max(6, Math.round(t.bubbleRadius / 2)), color: t.bubbleText }} />
                <textarea value={lead.message} onChange={(event) => setLead({ ...lead, message: event.target.value })} placeholder="What can we help with?" aria-label="Message" maxLength={2000} rows={2} className="w-full px-3 py-2 text-[13.5px] outline-none" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: Math.max(6, Math.round(t.bubbleRadius / 2)), color: t.bubbleText }} />
                {leadError ? <p role="alert" className="text-[12.5px]" style={{ color: "#d93d42" }}>{leadError}</p> : null}
                <button type="submit" disabled={leadState === "sending"} className="h-9 px-4 text-[13px] font-medium disabled:opacity-60" style={{ background: accent, color: t.onAccent, borderRadius: Math.max(6, Math.round(t.bubbleRadius / 2)) }}>
                  {leadState === "sending" ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </form>
        ) : null}

        <ol className="space-y-3" aria-live="polite" aria-label="Conversation">
          <li className="flex">
            <p
              className="max-w-[88%] px-3.5 py-2.5 text-[13.5px] leading-snug"
              style={{ background: t.bubble, color: t.bubbleText, borderRadius: t.bubbleRadius, borderBottomLeftRadius: Math.max(4, Math.round(t.bubbleRadius / 3)) }}
            >
              {bot.welcomeMessage}
            </p>
          </li>
          {messages.map((message, index) => (
            <li key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className="max-w-[88%] whitespace-pre-wrap px-3.5 py-2.5 text-[13.5px] leading-snug"
                style={
                  message.role === "user"
                    ? { background: accent, color: t.onAccent, borderRadius: t.bubbleRadius, borderBottomRightRadius: Math.max(4, Math.round(t.bubbleRadius / 3)) }
                    : {
                        background: t.bubble,
                        color: t.bubbleText,
                        borderRadius: t.bubbleRadius,
                        borderBottomLeftRadius: Math.max(4, Math.round(t.bubbleRadius / 3)),
                        border: message.error ? "1px solid #d93d42" : `1px solid ${t.border}`,
                      }
                }
              >
                {message.content || (streaming && index === messages.length - 1 ? <span className="inline-block h-3.5 w-0.5 animate-caret" style={{ background: t.bubbleText }} aria-hidden="true" /> : "")}
                {message.sources?.length ? (
                  <p className="mt-1.5 text-[10px]" style={{ color: t.muted }}>
                    Source: {message.sources.join(", ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {messages.length === 0 && bot.suggestedQuestions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Suggested questions">
            {bot.suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void send(question)}
                className="px-3 py-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-90"
                style={{ background: accent, color: t.onAccent, borderRadius: t.bubbleRadius }}
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(value);
        }}
        className="flex items-end gap-2 p-3"
        style={{ borderTop: `1px solid ${t.border}` }}
      >
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, 2000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(value);
            }
          }}
          rows={1}
          placeholder="Type your question…"
          aria-label="Your message"
          className="max-h-32 min-h-10 flex-1 resize-none px-3 py-2.5 text-[13.5px] leading-snug outline-none"
          style={{ background: t.bubble, border: `1px solid ${t.border}`, borderRadius: Math.max(8, Math.round(t.bubbleRadius * 0.75)), color: t.bubbleText }}
        />
        <button
          type="submit"
          disabled={!value.trim() || streaming}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center disabled:opacity-40"
          style={{ background: accent, color: t.onAccent, borderRadius: Math.max(8, Math.round(t.bubbleRadius * 0.75)) }}
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      </form>
      <p className="px-3 py-1.5 text-center text-[9.5px] uppercase tracking-[0.18em]" style={{ borderTop: `1px solid ${t.border}`, color: t.muted }}>
        Powered by Gixxer.ai
      </p>
    </div>
  );
}
