"use client";

import { ChevronLeft, Ellipsis, Maximize2, Paperclip, Send, Smile, X } from "lucide-react";
import { tokensFor, type BotThemeTokens } from "@/lib/bots/themes";
import { cn } from "@/lib/utils/cn";

/*
 * What a visitor sees, drawn from a theme's tokens: a white (or dark) card with a
 * header, a greeting, the quick-reply buttons and a message box, plus the round
 * launcher. The same tokens drive the real widget, so this preview is accurate
 * rather than decorative. Nothing here talks to a server.
 */

export interface PreviewContent {
  name: string;
  businessName: string;
  avatarLetter: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  position: "left" | "right";
}

export function WidgetCard({ content, tokens, className }: { content: PreviewContent; tokens: BotThemeTokens; className?: string }) {
  return (
    <div
      className={cn("flex w-full flex-col overflow-hidden", className)}
      style={{ background: tokens.surface, borderRadius: tokens.radius, boxShadow: tokens.shadow, fontFamily: tokens.font, border: `1px solid ${tokens.border}` }}
      data-widget-preview
    >
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: tokens.header, color: tokens.headerText, borderBottom: `1px solid ${tokens.border}` }}>
        <ChevronLeft className="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: tokens.accent, color: tokens.onAccent }} aria-hidden="true">
          {content.avatarLetter}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px]" style={{ fontWeight: tokens.headingWeight }}>
            {content.name}
          </span>
          {content.businessName ? (
            <span className="block truncate text-[10.5px]" style={{ color: tokens.muted }}>
              {content.businessName}
            </span>
          ) : null}
        </span>
        <Maximize2 className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        <Ellipsis className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3.5">
        <p
          className="max-w-[90%] px-3 py-2.5 text-[12.5px] leading-snug"
          style={{
            background: tokens.bubble,
            color: tokens.bubbleText,
            borderRadius: tokens.bubbleRadius,
            borderBottomLeftRadius: Math.max(4, Math.round(tokens.bubbleRadius / 3)),
          }}
        >
          {content.welcomeMessage}
        </p>
        <div className="mt-1 flex flex-col items-start gap-1.5">
          {content.suggestedQuestions.slice(0, 3).map((question) => (
            <span key={question} className="px-3 py-1.5 text-[12px] font-medium" style={{ background: tokens.accent, color: tokens.onAccent, borderRadius: tokens.bubbleRadius }}>
              {question}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: `1px solid ${tokens.border}` }}>
        <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: tokens.muted }}>
          Hit the buttons to respond
        </span>
        <Paperclip className="size-3.5 shrink-0" style={{ color: tokens.muted }} aria-hidden="true" />
        <Smile className="size-3.5 shrink-0" style={{ color: tokens.muted }} aria-hidden="true" />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ background: tokens.accent, color: tokens.onAccent }} aria-hidden="true">
          <Send className="size-3" />
        </span>
      </div>
      <p className="px-3 pb-2 text-center text-[9px] uppercase tracking-[0.16em]" style={{ color: tokens.muted }}>
        Powered by Gixxer.ai
      </p>
    </div>
  );
}

/**
 * The card on a stand-in web page, the way it appears on a real site: the
 * launcher in its corner and the panel above it.
 */
export function WidgetOnPage({ content, preset, accent, className }: { content: PreviewContent; preset: string; accent?: string | null; className?: string }) {
  const tokens = tokensFor(preset, accent);
  const left = content.position === "left";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-ink-900/50", className)} aria-label="How the chatbot appears on a website">
      {/* A stand-in page behind the widget: a browser bar and some grey lines, never a real brand. */}
      <div className="flex items-center gap-1.5 border-b border-line bg-ink-800/70 px-3 py-2" aria-hidden="true">
        <span className="size-2 rounded-full bg-ink-500" />
        <span className="size-2 rounded-full bg-ink-500" />
        <span className="size-2 rounded-full bg-ink-500" />
        <span className="ml-2 h-3 flex-1 rounded-full bg-ink-700" />
      </div>
      <div className="relative h-[430px] p-5" aria-hidden="true">
        <div className="h-3 w-24 rounded bg-ink-600" />
        <div className="mt-4 h-5 w-2/3 rounded bg-ink-500" />
        <div className="mt-2.5 h-3 w-1/2 rounded bg-ink-700" />
        <div className="mt-2 h-3 w-3/5 rounded bg-ink-700" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="h-16 rounded-lg bg-ink-800" />
          <div className="h-16 rounded-lg bg-ink-800" />
          <div className="h-16 rounded-lg bg-ink-800" />
        </div>

        <div className={cn("absolute bottom-4 flex flex-col gap-2.5", left ? "left-4 items-start" : "right-4 items-end")}>
          <WidgetCard content={content} tokens={tokens} className="w-[270px]" />
          <span className="flex size-12 items-center justify-center rounded-full shadow-lift" style={{ background: tokens.accent, color: tokens.onAccent }}>
            <X className="size-5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
