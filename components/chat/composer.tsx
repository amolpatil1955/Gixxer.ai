"use client";

import { ArrowUp, Mic, Square, Zap } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { MESSAGE_MAX_LENGTH } from "@/lib/chat/validation";
import { cn } from "@/lib/utils/cn";
import { AttachMenu, AttachmentChips, useAttachmentPolling, type PendingAttachment } from "./attachments";
import { useVoiceInput } from "./use-voice-input";
import { VoiceModal } from "./voice-modal";

interface ComposerProps {
  onSend: (content: string, attachmentIds: string[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  attachments: PendingAttachment[];
  onAttachmentsChange: Dispatch<SetStateAction<PendingAttachment[]>>;
  think: boolean;
  onThinkChange: (think: boolean) => void;
  /** The glowing edge while Booster is activating or working. */
  boosterGlow?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** The flowing rim around the composer while Booster is activating or working. */
function BoosterRing() {
  return (
    <>
      <div className="booster-halo-blur" aria-hidden="true">
        <div className="booster-ring-halo">
          <div className="booster-spin" />
        </div>
      </div>
      <div className="booster-ring" aria-hidden="true" data-booster-ring>
        <div className="booster-spin" />
      </div>
    </>
  );
}

/**
 * The message box: a rounded pill with the "+" for files on the left and
 * Think, the microphone and send on the right. Enter sends, Shift+Enter
 * breaks a line, and send becomes stop while a reply streams.
 */
export function Composer({ onSend, onStop, streaming, disabled, attachments, onAttachmentsChange, think, onThinkChange, boosterGlow = false, autoFocus, placeholder }: ComposerProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useAttachmentPolling(attachments, onAttachmentsChange);

  const voice = useVoiceInput((text) => {
    setValue((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text).slice(0, MESSAGE_MAX_LENGTH));
    textarea.current?.focus();
  });

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(220, element.scrollHeight)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textarea.current?.focus();
  }, [autoFocus]);

  const settling = attachments.some((attachment) => attachment.status === "uploading" || attachment.status === "indexing");
  const failed = attachments.some((attachment) => attachment.status === "failed");
  const canSend = value.trim().length > 0 && !streaming && !disabled && !settling && !failed;

  function submit() {
    if (!canSend) return;
    onSend(
      value.trim(),
      attachments.filter((attachment) => attachment.status === "indexed").map((attachment) => attachment.fileId),
    );
    setValue("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  const notice = error ?? (failed ? "Remove the failed attachment to send." : settling ? "Reading your file… you can send as soon as it is indexed." : null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn("raised rounded-[28px] px-2.5 pb-2 pt-2.5 transition-[border-color,box-shadow,background-color] duration-300 focus-within:border-line-strong", boosterGlow && "booster-glow")}
      aria-label="Message"
      data-booster={think ? "on" : "off"}
    >
      {boosterGlow ? <BoosterRing /> : null}
      <AttachmentChips attachments={attachments} onChange={onAttachmentsChange} />
      <textarea
        ref={textarea}
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={disabled}
        placeholder={placeholder ?? "Ask anything"}
        aria-label="Message"
        className="block max-h-[220px] w-full resize-none bg-transparent px-2.5 py-1.5 text-[15.5px] leading-relaxed text-ink-50 outline-none placeholder:text-ink-400"
      />
      <div className="mt-1 flex items-center gap-1">
        <AttachMenu onChange={onAttachmentsChange} disabled={disabled || streaming} onError={setError} />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onThinkChange(!think)}
            aria-pressed={think}
            aria-label={think ? "Booster on" : "Booster off"}
            title="Booster: Gixxer thinks it through before answering"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
              think ? "bg-accent-soft text-accent" : "text-ink-200 hover:bg-ink-700 hover:text-ink-50",
            )}
          >
            <Zap className={cn("size-4", think && "fill-current")} aria-hidden="true" />
            Booster
          </button>
          {voice.supported ? (
            <button
              type="button"
              disabled={disabled || streaming}
              onClick={() => void voice.start()}
              aria-label="Dictate"
              title="Dictate"
              className="flex size-9 items-center justify-center rounded-full text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40"
            >
              <Mic className="size-4.5" aria-hidden="true" />
            </button>
          ) : null}
          {streaming ? (
            <button type="button" onClick={onStop} aria-label="Stop generating" title="Stop" className="flex size-9 items-center justify-center rounded-full bg-ink-50 text-ink-950 transition-colors hover:bg-white">
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-[background-color,transform] active:scale-95",
                canSend ? "bg-accent text-on-accent hover:bg-accent-hover" : "bg-ink-600 text-ink-300",
              )}
            >
              <ArrowUp className="size-4.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {notice ? (
        <p role={error ? "alert" : "status"} className={cn("px-3 pb-1 pt-1.5 text-[11.5px]", error || failed ? "text-danger" : "text-ink-400")}>
          {notice}
        </p>
      ) : null}
      <VoiceModal state={voice.state} error={voice.error} seconds={voice.seconds} maxSeconds={voice.maxSeconds} onStop={voice.stop} onRetry={() => void voice.start()} onCancel={voice.cancel} />
    </form>
  );
}
