"use client";

import { ArrowUp, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const accent = bot.theme.accent;

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
    <div className="flex h-dvh flex-col bg-ink-950 text-ink-50" data-embed-chat>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: accent }} aria-hidden="true">
          {bot.avatarLetter}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-medium">{bot.name}</p>
          {bot.businessName ? <p className="truncate text-[11.5px] text-ink-400">{bot.businessName}</p> : null}
        </div>
        {bot.collectLeads ? (
          <button
            type="button"
            onClick={() => setLeadOpen((open) => !open)}
            aria-expanded={leadOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-200 hover:border-ink-400"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            Contact
          </button>
        ) : null}
        {framed ? (
          <button type="button" onClick={close} aria-label="Close chat" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-50">
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
            className="mb-4 space-y-2.5 rounded-2xl border border-line bg-ink-900 p-3.5"
            aria-label="Leave your details"
          >
            <p className="text-[13px] font-medium">Leave your details and we will get back to you.</p>
            {leadState === "sent" ? (
              <p role="status" className="text-[13px] text-ink-200">
                Thanks, {lead.name || "we have your email"}. Someone will be in touch.
              </p>
            ) : (
              <>
                <input value={lead.name} onChange={(event) => setLead({ ...lead, name: event.target.value })} placeholder="Your name" aria-label="Your name" maxLength={120} className="h-10 w-full rounded-lg border border-line bg-ink-950 px-3 text-[13.5px] outline-none focus:border-ink-300" />
                <input type="email" required value={lead.email} onChange={(event) => setLead({ ...lead, email: event.target.value })} placeholder="you@example.com" aria-label="Your email" maxLength={254} className="h-10 w-full rounded-lg border border-line bg-ink-950 px-3 text-[13.5px] outline-none focus:border-ink-300" />
                <textarea value={lead.message} onChange={(event) => setLead({ ...lead, message: event.target.value })} placeholder="What can we help with?" aria-label="Message" maxLength={2000} rows={2} className="w-full rounded-lg border border-line bg-ink-950 px-3 py-2 text-[13.5px] outline-none focus:border-ink-300" />
                {leadError ? <p role="alert" className="text-[12.5px] text-danger">{leadError}</p> : null}
                <button type="submit" disabled={leadState === "sending"} className="h-9 rounded-lg px-4 text-[13px] font-medium text-white disabled:opacity-60" style={{ background: accent }}>
                  {leadState === "sending" ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </form>
        ) : null}

        <ol className="space-y-3" aria-live="polite" aria-label="Conversation">
          <li className="flex">
            <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-ink-900 px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-100">{bot.welcomeMessage}</p>
          </li>
          {messages.map((message, index) => (
            <li key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug",
                  message.role === "user" ? "rounded-br-md text-white" : "rounded-bl-md border border-line bg-ink-900 text-ink-100",
                  message.error && "border-danger/40",
                )}
                style={message.role === "user" ? { background: accent } : undefined}
              >
                {message.content || (streaming && index === messages.length - 1 ? <span className="inline-block h-3.5 w-0.5 animate-caret bg-ink-50" aria-hidden="true" /> : "")}
                {message.sources?.length ? <p className="mt-1.5 font-mono text-[10px] text-ink-400">Source: {message.sources.join(", ")}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        {messages.length === 0 && bot.suggestedQuestions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Suggested questions">
            {bot.suggestedQuestions.map((question) => (
              <button key={question} type="button" onClick={() => void send(question)} className="rounded-full border border-line-strong bg-ink-900 px-3 py-1.5 text-[12.5px] text-ink-200 hover:border-ink-400 hover:text-ink-50">
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
        className="flex items-end gap-2 border-t border-line p-3"
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
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-[13.5px] leading-snug outline-none focus:border-ink-300"
        />
        <button type="submit" disabled={!value.trim() || streaming} aria-label="Send" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ background: accent }}>
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      </form>
      <p className="border-t border-line px-3 py-1.5 text-center font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">Powered by Gixxer.ai</p>
    </div>
  );
}
