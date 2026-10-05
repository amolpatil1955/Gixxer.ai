"use client";

import { CircleAlert, CircleCheck, FileText, Globe, LoaderCircle, PencilLine, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, inputClassName } from "@/components/ui/input";
import {
  addFileSourceAction,
  addTextSourceAction,
  addWebsiteSourceAction,
  advanceSourceAction,
  recrawlSourceAction,
  removeSourceAction,
} from "@/lib/bots/actions";
import { sourceWorking, type SourceDto } from "@/lib/bots/types";
import { ACCEPT_ATTRIBUTE } from "@/lib/files/validation";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";

interface LibraryFileOption {
  id: string;
  name: string;
}

interface Props {
  botId: string;
  sources: SourceDto[];
  libraryFiles: LibraryFileOption[];
  /** False when no crawler key is configured, so the website option is not offered rather than failing. */
  crawlingAvailable: boolean;
  /** Inside the creation wizard the panel is one column and reports progress upward. */
  compact?: boolean;
  onSourcesChange?: (sources: SourceDto[]) => void;
}

type Mode = "website" | "upload" | "manual";

const MODES: { id: Mode; label: string; hint: string; Icon: typeof Globe }[] = [
  { id: "website", label: "Website URL", hint: "Crawl your site and learn its pages", Icon: Globe },
  { id: "upload", label: "Upload documents", hint: "PDF, Word, text or a spreadsheet", Icon: Upload },
  { id: "manual", label: "Add details manually", hint: "Paste your FAQ, policies or notes", Icon: PencilLine },
];

const STATUS_LABELS: Record<SourceDto["status"], string> = {
  pending: "Pending",
  crawling: "Crawling",
  processing: "Processing",
  indexing: "Processing",
  indexed: "Ready",
  failed: "Failed",
};

/** How often an unfinished crawl is nudged along. A crawl takes tens of seconds. */
const POLL_MS = 2500;

function StatusLine({ source }: { source: SourceDto }) {
  if (source.status === "failed") {
    return (
      <span className="flex items-start gap-1.5 text-danger">
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {source.error ?? "Failed"}
      </span>
    );
  }
  if (sourceWorking(source.status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-300">
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        {STATUS_LABELS[source.status]}
        {source.status === "crawling" ? " the site, this takes a moment" : null}
      </span>
    );
  }
  const pages = source.pageCount > 0 ? `${source.pageCount} page${source.pageCount === 1 ? "" : "s"} · ` : "";
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-400">
      <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
      {pages}
      {source.chunkCount} passage{source.chunkCount === 1 ? "" : "s"}
    </span>
  );
}

/**
 * The knowledge step: a website to crawl, documents to upload, or details typed
 * by hand. Crawls run on the server; this screen advances them until each source
 * is ready or has failed, and stops polling as soon as nothing is working.
 */
export function BotKnowledge({ botId, sources, libraryFiles, crawlingAvailable, compact = false, onSourcesChange }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(crawlingAvailable ? "website" : "upload");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [fileId, setFileId] = useState(libraryFiles[0]?.id ?? "");
  const [uploading, setUploading] = useState<string[]>([]);
  const [live, setLive] = useState<SourceDto[]>(sources);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  // The server's list wins whenever it changes. Adjusted during render, as React recommends.
  const [adopted, setAdopted] = useState(sources);
  if (adopted !== sources) {
    setAdopted(sources);
    setLive(sources);
  }

  const report = useCallback(
    (next: SourceDto[]) => {
      setLive(next);
      onSourcesChange?.(next);
    },
    [onSourcesChange],
  );

  const workingIds = live.filter((source) => sourceWorking(source.status)).map((source) => source.id);
  const workingKey = workingIds.join(",");

  // Advance every unfinished source on a timer, and stop the moment none are left.
  useEffect(() => {
    if (!workingKey) return;
    const ids = workingKey.split(",");
    let cancelled = false;
    const timer = window.setInterval(async () => {
      for (const id of ids) {
        if (cancelled) return;
        const result = await advanceSourceAction({ botId, sourceId: id });
        if (cancelled || !result.ok || !result.source) continue;
        const updated = result.source;
        setLive((current) => {
          const next = current.map((source) => (source.id === updated.id ? updated : source));
          onSourcesChange?.(next);
          return next;
        });
        if (!sourceWorking(updated.status)) router.refresh();
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [botId, workingKey, onSourcesChange, router]);

  async function uploadDocuments(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (const file of Array.from(files).slice(0, 5)) {
      setUploading((current) => [...current, file.name]);
      try {
        const form = new FormData();
        form.append("file", file);
        // A chatbot's upload belongs to the bot, never to the owner's library or a chat.
        form.append("scope", "bot");
        const response = await fetch("/api/files", { method: "POST", body: form });
        if (!response.ok) {
          setError(await errorMessageFrom(response, "The upload failed."));
          continue;
        }
        const json = (await response.json()) as { file: { id: string } };
        const result = await addFileSourceAction({ botId, fileId: json.file.id });
        if (!result.ok) setError(result.message);
        if (result.source) {
          const added = result.source;
          setLive((current) => {
            const next = [added, ...current.filter((item) => item.id !== added.id)];
            onSourcesChange?.(next);
            return next;
          });
        }
      } catch {
        setError("The connection dropped during the upload.");
      } finally {
        setUploading((current) => current.filter((item) => item !== file.name));
      }
    }
    router.refresh();
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      if (mode === "website") {
        const result = await addWebsiteSourceAction({ botId, url });
        if (!result.ok) {
          setError(result.message);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        setUrl("");
        if (result.source) report([result.source, ...live]);
        router.refresh();
        return;
      }
      if (mode === "manual") {
        const result = await addTextSourceAction({ botId, name, text });
        if (!result.ok) {
          setError(result.message);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        setName("");
        setText("");
        if (result.source) report([result.source, ...live]);
        router.refresh();
        return;
      }
      const result = await addFileSourceAction({ botId, fileId });
      if (!result.ok) setError(result.message);
      if (result.source) report([result.source, ...live.filter((item) => item.id !== result.source!.id)]);
      router.refresh();
    });
  }

  async function remove(source: SourceDto) {
    if (!(await confirm({ title: `Remove ${source.name}?`, body: "The bot stops answering from it.", confirmLabel: "Remove" }))) return;
    startTransition(async () => {
      const result = await removeSourceAction({ botId, sourceId: source.id });
      if (!result.ok) setError(result.message);
      else report(live.filter((item) => item.id !== source.id));
      router.refresh();
    });
  }

  function recrawl(source: SourceDto) {
    startTransition(async () => {
      const result = await recrawlSourceAction({ botId, sourceId: source.id });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const updated = result.source;
      if (updated) report(live.map((item) => (item.id === updated.id ? updated : item)));
    });
  }

  const modes = MODES.filter((item) => item.id !== "website" || crawlingAvailable);

  return (
    <div className={cn("grid gap-8", compact ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
      <div className="space-y-5">
        <div role="tablist" aria-label="How to add knowledge" className="grid gap-2 sm:grid-cols-3">
          {modes.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(item.id)}
                className={cn("rounded-2xl border p-3 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}
              >
                <item.Icon className={cn("size-4", active ? "text-accent" : "text-ink-300")} aria-hidden="true" />
                <span className={cn("mt-2 block text-[13.5px] font-medium", active ? "text-ink-50" : "text-ink-100")}>{item.label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-400">{item.hint}</span>
              </button>
            );
          })}
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="plate space-y-4 rounded-2xl p-5"
          aria-busy={pending}
          aria-label="Add knowledge"
        >
          {mode === "website" ? (
            <>
              <Field id="source-url" label="Website address" error={fieldErrors.url} hint="We read the public pages at this address and keep their text. Up to 25 pages.">
                <Input id="source-url" type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" {...fieldAria("source-url", fieldErrors.url, true)} />
              </Field>
              <Button type="submit" loading={pending} loadingLabel="Starting…" disabled={!url.trim()}>
                Start crawling
              </Button>
            </>
          ) : null}

          {mode === "upload" ? (
            <>
              <input ref={input} type="file" accept={ACCEPT_ATTRIBUTE} multiple className="hidden" onChange={(event) => void uploadDocuments(event.target.files)} />
              <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center transition-colors hover:border-ink-400">
                <Upload className="size-5 text-ink-300" aria-hidden="true" />
                <span className="mt-2.5 text-[14px] font-medium text-ink-50">Choose documents</span>
                <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">PDF · DOCX · TXT · CSV · XLSX · 20 MB each</span>
              </button>
              {uploading.length > 0 ? (
                <p className="flex items-center gap-2 text-[12.5px] text-ink-300" role="status">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  Uploading {uploading.join(", ")}
                </p>
              ) : null}
              {libraryFiles.length > 0 ? (
                <div className="border-t border-line pt-4">
                  <Field id="source-file" label="Or pick one from your library">
                    <select id="source-file" value={fileId} onChange={(event) => setFileId(event.target.value)} className={inputClassName}>
                      {libraryFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button type="submit" className="mt-3" loading={pending} loadingLabel="Reading…" disabled={!fileId}>
                    Add to knowledge
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "manual" ? (
            <>
              <Field id="source-name" label="Name" error={fieldErrors.name}>
                <Input id="source-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Opening hours" maxLength={120} />
              </Field>
              <Field id="source-text" label="Details" error={fieldErrors.text} hint="FAQs, policies, prices, anything the bot should know.">
                <textarea id="source-text" value={text} onChange={(event) => setText(event.target.value)} className={`${inputClassName} h-auto min-h-40 resize-y py-3 leading-relaxed`} />
              </Field>
              <Button type="submit" loading={pending} loadingLabel="Reading…" disabled={!name.trim() || text.trim().length < 20}>
                Add to knowledge
              </Button>
            </>
          ) : null}
        </form>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">Sources{workingIds.length > 0 ? ` · ${workingIds.length} working` : ""}</p>
        {live.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13.5px] text-ink-400">
            Nothing yet. Crawl your website, upload a document, or type the details in.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line" aria-label="Knowledge sources">
            {live.map((source) => {
              const Icon = source.type === "url" ? Globe : source.type === "file" ? FileText : PencilLine;
              return (
                <li key={source.id} className="flex items-center gap-3 px-4 py-3" data-source-status={source.status}>
                  <Icon className="size-4 shrink-0 text-ink-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink-50">{source.title ?? source.name}</span>
                    <span className="block truncate text-[12px]">
                      <StatusLine source={source} />
                    </span>
                  </span>
                  {source.type === "url" && !sourceWorking(source.status) ? (
                    <button type="button" onClick={() => recrawl(source)} aria-label={`Re-crawl ${source.name}`} title="Read the site again" className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-50">
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void remove(source)} aria-label={`Remove ${source.name}`} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-danger">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dialog}
    </div>
  );
}
