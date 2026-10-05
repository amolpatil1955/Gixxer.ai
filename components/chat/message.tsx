"use client";

import { Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Paperclip, Pencil, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useState } from "react";
import { messageFeedbackAction } from "@/lib/chat/actions";
import type { ArtifactDto, FeedbackDto, ThreadMessageDto } from "@/lib/chat/types";
import { useSmoothStream } from "@/lib/motion/use-smooth-stream";
import { cn } from "@/lib/utils/cn";
import { ImageGenerating } from "@/components/images/image-generating";
import { ArtifactCard } from "./artifact-card";
import { GLoader } from "./g-loader";
import { Markdown } from "./markdown";

interface MessageProps {
  message: ThreadMessageDto;
  streaming: boolean;
  busy: boolean;
  onRegenerate?: (userMessageId: string) => void;
  onEdit?: (message: ThreadMessageDto, content: string) => void;
  onSwitchBranch?: (messageId: string) => void;
  onOpenArtifact?: (artifact: ArtifactDto) => void;
}

const actionClass = "inline-flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 disabled:opacity-40";

function BranchNav({ message, onSwitchBranch }: { message: ThreadMessageDto; onSwitchBranch?: (id: string) => void }) {
  if (message.siblingCount < 2 || !onSwitchBranch) return null;
  const previous = message.siblingIds[message.siblingIndex - 1];
  const next = message.siblingIds[message.siblingIndex + 1];
  return (
    <span className="inline-flex items-center font-mono text-[11px] text-ink-400" aria-label="Branches">
      <button type="button" disabled={!previous} onClick={() => previous && onSwitchBranch(previous)} aria-label="Previous branch" className={cn(actionClass, "size-7")}>
        <ChevronLeft className="size-3.5" aria-hidden="true" />
      </button>
      {message.siblingIndex + 1}/{message.siblingCount}
      <button type="button" disabled={!next} onClick={() => next && onSwitchBranch(next)} aria-label="Next branch" className={cn(actionClass, "size-7")}>
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      aria-label={copied ? "Copied" : "Copy message"}
      title="Copy"
      className={actionClass}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  );
}

function Feedback({ message }: { message: ThreadMessageDto }) {
  const [value, setValue] = useState<FeedbackDto | null>(message.feedback);
  const persisted = /^[a-f0-9]{24}$/i.test(message.id);
  if (!persisted) return null;
  function set(next: FeedbackDto) {
    const chosen = value === next ? null : next;
    setValue(chosen);
    void messageFeedbackAction({ messageId: message.id, feedback: chosen });
  }
  return (
    <>
      <button type="button" onClick={() => set("up")} aria-pressed={value === "up"} aria-label="Good response" title="Good response" className={cn(actionClass, value === "up" && "text-ink-50")}>
        <ThumbsUp className={cn("size-4", value === "up" && "fill-current")} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => set("down")} aria-pressed={value === "down"} aria-label="Bad response" title="Bad response" className={cn(actionClass, value === "down" && "text-ink-50")}>
        <ThumbsDown className={cn("size-4", value === "down" && "fill-current")} aria-hidden="true" />
      </button>
    </>
  );
}

function StreamingBody({ content, streaming }: { content: string; streaming: boolean }) {
  const { text, caughtUp } = useSmoothStream(content, streaming);
  return (
    <div className={cn(!caughtUp && "stream-caret")} data-caught-up={caughtUp ? "true" : "false"}>
      <Markdown content={text} />
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({ message, streaming, busy, onRegenerate, onEdit, onSwitchBranch, onOpenArtifact }: MessageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5" data-message-role="user">
        {editing ? (
          <div className="w-full max-w-[92%] rounded-3xl border border-line-strong bg-ink-900 p-3 sm:max-w-[80%]">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={Math.min(10, Math.max(2, draft.split("\n").length))}
              aria-label="Edit message"
              className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-ink-50 outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.content);
                }}
                className="rounded-full px-3.5 py-1.5 text-[13px] text-ink-200 hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.trim() || busy}
                onClick={() => {
                  setEditing(false);
                  onEdit?.(message, draft.trim());
                }}
                className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
              >
                Save and send
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] leading-relaxed text-on-accent sm:max-w-[72%]">
            {message.content}
          </div>
        )}
        {message.attachments.length > 0 ? (
          <ul className="flex flex-wrap justify-end gap-1.5" aria-label="Attachments">
            {message.attachments.map((attachment) => (
              <li key={attachment.fileId} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-2 py-1 font-mono text-[11px] text-ink-300">
                <Paperclip className="size-3" aria-hidden="true" />
                {attachment.name}
              </li>
            ))}
          </ul>
        ) : null}
        {!editing ? (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100 [.group:hover_&]:opacity-100">
            <BranchNav message={message} onSwitchBranch={onSwitchBranch} />
            <CopyText text={message.content} />
            {onEdit ? (
              <button type="button" disabled={busy} onClick={() => setEditing(true)} aria-label="Edit message" title="Edit" className={actionClass}>
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const making = message.working === "image" || message.working === "image-done";
  const waiting = streaming && !message.content && message.artifacts.length === 0 && !making;

  return (
    <div className="min-w-0" data-message-role="assistant" data-message-status={message.status}>
      {making ? (
        <ImageGenerating width={1024} height={768} progress={message.working === "image-done" ? 100 : undefined} className="mt-1 max-w-md" />
      ) : waiting ? (
        <div className="py-1" data-loader>
          <GLoader />
        </div>
      ) : message.content ? (
        <div className="animate-fade-in motion-reduce:animate-none">
          <StreamingBody content={message.content} streaming={streaming} />
        </div>
      ) : null}
      {making
        ? null
        : message.artifacts.map((artifact) => <ArtifactCard key={`${artifact.kind}-${artifact.refId}`} artifact={artifact} onOpen={(item) => onOpenArtifact?.(item)} />)}

      {message.status === "error" ? (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-ink-50">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          {message.errorMessage ?? "The reply failed."}
        </p>
      ) : null}

      {message.citations.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sources">
          {message.citations.map((citation) => (
            <li key={`${citation.fileId}-${citation.locator}`}>
              <a
                href={`/api/files/${citation.fileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-ink-900 px-2.5 py-1 font-mono text-[11px] text-ink-200 hover:border-ink-400"
              >
                <span className="size-1.5 rounded-full bg-ink-50" aria-hidden="true" />
                {citation.fileName} <span className="text-ink-400">· {citation.locator}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {!streaming && !making ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
          <BranchNav message={message} onSwitchBranch={onSwitchBranch} />
          {message.content ? <CopyText text={message.content} /> : null}
          {message.content ? <Feedback message={message} /> : null}
          {onRegenerate && message.parentId ? (
            <button type="button" disabled={busy} onClick={() => onRegenerate(message.parentId!)} aria-label={message.status === "error" ? "Retry" : "Regenerate"} title={message.status === "error" ? "Retry" : "Regenerate"} className={actionClass}>
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          {message.status === "stopped" ? <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">stopped</span> : null}
        </div>
      ) : null}
    </div>
  );
});

export function messageClassName(role: "user" | "assistant"): string {
  return cn("group", role === "user" ? "pl-6 sm:pl-16" : "pr-2");
}
