"use client";

import { FileText, Globe, Loader2, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, inputClassName } from "@/components/ui/input";
import { addFileSourceAction, addTextSourceAction, addUrlSourceAction, removeSourceAction } from "@/lib/bots/actions";
import type { SourceDto } from "@/lib/bots/types";
import { cn } from "@/lib/utils/cn";

interface LibraryFileOption {
  id: string;
  name: string;
}

interface Props {
  botId: string;
  sources: SourceDto[];
  libraryFiles: LibraryFileOption[];
}

type Mode = "url" | "text" | "file";

const ICONS = { file: FileText, url: Globe, text: Type } as const;

/** Add pages, pasted text or library files; each is indexed on the spot and listed with its chunk count. */
export function BotKnowledge({ botId, sources, libraryFiles }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [fileId, setFileId] = useState(libraryFiles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result =
        mode === "url"
          ? await addUrlSourceAction({ botId, url })
          : mode === "text"
            ? await addTextSourceAction({ botId, name, text })
            : await addFileSourceAction({ botId, fileId });
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setUrl("");
      setName("");
      setText("");
      router.refresh();
    });
  }

  function remove(source: SourceDto) {
    if (!window.confirm(`Remove ${source.name} from this bot's knowledge?`)) return;
    startTransition(async () => {
      const result = await removeSourceAction({ botId, sourceId: source.id });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="plate space-y-5 rounded-2xl p-5"
        aria-busy={pending}
        aria-label="Add knowledge"
      >
        <div role="tablist" aria-label="Source type" className="flex gap-1 rounded-xl border border-line p-1">
          {(["url", "text", "file"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={cn("flex-1 rounded-lg px-3 py-1.5 text-[13px] capitalize transition-colors", mode === option ? "bg-ink-50 text-ink-950" : "text-ink-300 hover:text-ink-50")}
            >
              {option === "url" ? "Web page" : option === "text" ? "Text" : "Library file"}
            </button>
          ))}
        </div>

        {error ? <Alert>{error}</Alert> : null}

        {mode === "url" ? (
          <Field id="source-url" label="Page address" error={fieldErrors.url} hint="A public page. We read its text once; re-add it after changes.">
            <Input id="source-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/pricing" {...fieldAria("source-url", fieldErrors.url, true)} />
          </Field>
        ) : null}

        {mode === "text" ? (
          <>
            <Field id="source-name" label="Name" error={fieldErrors.name}>
              <Input id="source-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Opening hours" maxLength={120} />
            </Field>
            <Field id="source-text" label="Text" error={fieldErrors.text} hint="FAQs, policies, anything the bot should know.">
              <textarea id="source-text" value={text} onChange={(event) => setText(event.target.value)} className={`${inputClassName} h-auto min-h-[160px] resize-y py-3 leading-relaxed`} />
            </Field>
          </>
        ) : null}

        {mode === "file" ? (
          <Field id="source-file" label="File from your library" hint={libraryFiles.length === 0 ? "Upload a document in Library first." : undefined}>
            <select id="source-file" value={fileId} onChange={(event) => setFileId(event.target.value)} disabled={libraryFiles.length === 0} className={inputClassName}>
              {libraryFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Button type="submit" loading={pending} loadingLabel="Indexing…" disabled={mode === "file" && !fileId}>
          Add to knowledge
        </Button>
      </form>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">Sources</p>
        {sources.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13.5px] text-ink-400">
            Nothing yet. Add a page, paste your FAQ, or pick a file.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line" aria-label="Knowledge sources">
            {sources.map((source) => {
              const Icon = ICONS[source.type];
              return (
                <li key={source.id} className="flex items-center gap-3 px-4 py-3" data-source-status={source.status}>
                  <Icon className="size-4 shrink-0 text-ink-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink-50">{source.name}</span>
                    <span className="block truncate text-[12px] text-ink-400">
                      {source.status === "indexing" ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Indexing
                        </span>
                      ) : source.status === "failed" ? (
                        <span className="text-danger">{source.error ?? "Failed"}</span>
                      ) : (
                        `${source.chunkCount} passage${source.chunkCount === 1 ? "" : "s"}`
                      )}
                    </span>
                  </span>
                  <button type="button" onClick={() => remove(source)} aria-label={`Remove ${source.name}`} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-danger">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
