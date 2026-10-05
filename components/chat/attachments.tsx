"use client";

import { FileText, Library, LoaderCircle, Paperclip, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ACCEPT_ATTRIBUTE, formatBytes } from "@/lib/files/validation";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";

export interface PendingAttachment {
  fileId: string;
  name: string;
  status: "uploading" | "indexing" | "indexed" | "failed";
  error?: string;
}

interface LibraryFile {
  id: string;
  name: string;
  size: number;
  status: string;
  kind: string;
}

/** Uploads one file and returns its record, or throws with a message safe to show. */
async function upload(file: File, conversationId: string | null): Promise<{ id: string; name: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  // A file dropped into a chat belongs to that chat, never to the library or another chat.
  form.append("scope", "chat");
  if (conversationId) form.append("conversationId", conversationId);
  const response = await fetch("/api/files", { method: "POST", body: form });
  if (!response.ok) throw new Error(await errorMessageFrom(response, "The upload failed."));
  const json = (await response.json()) as { file: { id: string; name: string; status: string } };
  return json.file;
}

/** A document is only sendable once it is indexed, so indexing attachments poll until the server says so. */
export function useAttachmentPolling(attachments: PendingAttachment[], onChange: Dispatch<SetStateAction<PendingAttachment[]>>) {
  useEffect(() => {
    const pending = attachments.filter((attachment) => attachment.status === "indexing");
    if (pending.length === 0) return;
    const timer = window.setInterval(async () => {
      for (const attachment of pending) {
        try {
          const response = await fetch(`/api/files/${attachment.fileId}?meta=1`);
          if (!response.ok) continue;
          const json = (await response.json()) as { file: { status: string; error: string | null } };
          if (json.file.status === "indexed" || json.file.status === "failed") {
            onChange((current) =>
              current.map((item) =>
                item.fileId === attachment.fileId
                  ? { ...item, status: json.file.status === "indexed" ? "indexed" : "failed", error: json.file.error ?? undefined }
                  : item,
              ),
            );
          }
        } catch {
          // Keep polling; a transient failure is not a verdict.
        }
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [attachments, onChange]);
}

interface AttachMenuProps {
  /** The chat the uploads belong to; null for a chat that has not started yet. */
  conversationId: string | null;
  onChange: Dispatch<SetStateAction<PendingAttachment[]>>;
  disabled?: boolean;
  onError: (message: string | null) => void;
}

/** The composer's "+" button: upload from disk, or pick a file from the library. */
export function AttachMenu({ conversationId, onChange, disabled, onError }: AttachMenuProps) {
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<LibraryFile[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setShowLibrary(false);
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onError(null);
    for (const file of Array.from(files).slice(0, 4)) {
      const temporaryId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      onChange((current) => [...current, { fileId: temporaryId, name: file.name, status: "uploading" }]);
      try {
        const record = await upload(file, conversationId);
        onChange((current) =>
          current.map((item) =>
            item.fileId === temporaryId ? { fileId: record.id, name: record.name, status: record.status === "indexed" ? "indexed" : "indexing" } : item,
          ),
        );
      } catch (caught) {
        onChange((current) => current.filter((item) => item.fileId !== temporaryId));
        onError(caught instanceof Error ? caught.message : "The upload failed.");
      }
    }
  }

  async function openLibrary() {
    setShowLibrary(true);
    if (library) return;
    try {
      const response = await fetch("/api/files");
      if (!response.ok) return;
      const json = (await response.json()) as { files: LibraryFile[] };
      setLibrary(json.files.filter((file) => file.kind !== "image"));
    } catch {
      setLibrary([]);
    }
  }

  function pick(file: LibraryFile) {
    close();
    onChange((current) =>
      current.some((item) => item.fileId === file.id)
        ? current
        : [...current, { fileId: file.id, name: file.name, status: file.status === "indexed" ? "indexed" : file.status === "failed" ? "failed" : "indexing" }],
    );
  }

  return (
    <div ref={root} className="relative">
      <input ref={input} type="file" accept={ACCEPT_ATTRIBUTE} multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Add files"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" aria-label="Add files" className="absolute bottom-full left-0 z-20 mb-2 w-[min(340px,86vw)] overflow-hidden rounded-2xl border border-line bg-ink-900 p-1.5 shadow-lift">
          {showLibrary ? (
            <>
              <p className="px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">Your library</p>
              {library === null ? (
                <p className="px-3 py-3 text-[13px] text-ink-400">Loading…</p>
              ) : library.length === 0 ? (
                <p className="px-3 py-3 text-[13px] text-ink-400">
                  No documents yet. <Upload className="inline size-3.5" aria-hidden="true" /> Upload one to get started.
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {library.map((file) => (
                    <li key={file.id}>
                      <button type="button" role="menuitem" onClick={() => pick(file)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
                        <FileText className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <span className="font-mono text-[10px] text-ink-500">{formatBytes(file.size)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  input.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-ink-100 hover:bg-ink-800"
              >
                <Paperclip className="size-4 text-ink-300" aria-hidden="true" />
                <span>
                  Upload a file
                  <span className="block text-[11.5px] text-ink-400">PDF, DOCX, TXT, CSV, XLS, XLSX, images</span>
                </span>
              </button>
              <button type="button" role="menuitem" onClick={openLibrary} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-ink-100 hover:bg-ink-800">
                <Library className="size-4 text-ink-300" aria-hidden="true" />
                <span>
                  Add from library
                  <span className="block text-[11.5px] text-ink-400">Documents you already indexed</span>
                </span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The chips above the message box. */
export function AttachmentChips({ attachments, onChange }: { attachments: PendingAttachment[]; onChange: Dispatch<SetStateAction<PendingAttachment[]>> }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5 px-1" aria-label="Attachments">
      {attachments.map((attachment) => (
        <li
          key={attachment.fileId}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[12px]",
            attachment.status === "failed" ? "border-danger/40 text-danger" : "border-line bg-ink-900 text-ink-100",
          )}
          title={attachment.error}
        >
          {attachment.status === "uploading" || attachment.status === "indexing" ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="size-3.5 text-ink-300" aria-hidden="true" />
          )}
          <span className="truncate">{attachment.name}</span>
          {attachment.status !== "indexed" ? <span className="font-mono text-[10px] text-ink-400">{attachment.status}</span> : null}
          <button
            type="button"
            onClick={() => onChange((current) => current.filter((item) => item.fileId !== attachment.fileId))}
            aria-label={`Remove ${attachment.name}`}
            className="ml-0.5 rounded p-0.5 text-ink-400 hover:text-ink-50"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
