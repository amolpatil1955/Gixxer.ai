"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { CircleAlert, Download, Ellipsis, FileSpreadsheet, FileText, ImageIcon, LayoutGrid, List, LoaderCircle, MessageSquare, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { IconButton, Panel, PillTabs, SearchField, timeAgo } from "@/components/workspace/primitives";
import { deleteFileAction, reindexFileAction } from "@/lib/files/actions";
import { ACCEPT_ATTRIBUTE, formatBytes } from "@/lib/files/validation";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

export interface FileDto {
  id: string;
  /** `chat` files belong to one conversation and are not offered to other chats. */
  scope: "library" | "chat" | "bot";
  name: string;
  size: number;
  kind: string;
  status: "uploaded" | "indexing" | "indexed" | "failed";
  pages: number | null;
  sheets: string[];
  chunkCount: number;
  preview: string;
  error: string | null;
  createdAt: string;
}

type Filter = "all" | "documents" | "sheets" | "images";
type View = "list" | "grid";

const SHEET_KINDS = new Set(["csv", "xls", "xlsx"]);

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "image") return <ImageIcon className={className} aria-hidden="true" />;
  if (SHEET_KINDS.has(kind)) return <FileSpreadsheet className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}

function matchesFilter(file: FileDto, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "images") return file.kind === "image";
  if (filter === "sheets") return SHEET_KINDS.has(file.kind);
  return file.kind !== "image" && !SHEET_KINDS.has(file.kind);
}

function Thumb({ file, className }: { file: FileDto; className?: string }) {
  if (file.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- bytes come from our own authenticated route
    return <img src={`/api/files/${file.id}`} alt="" className={cn("rounded-lg border border-line object-cover", className)} loading="lazy" />;
  }
  return (
    <span className={cn("flex items-center justify-center rounded-lg border border-line bg-ink-800 text-ink-300", className)} aria-hidden="true">
      <KindIcon kind={file.kind} className="size-[45%]" />
    </span>
  );
}

function StatusChip({ file }: { file: FileDto }) {
  const busy = file.status === "indexing" || file.status === "uploaded";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em]",
        file.status === "indexed" ? "border-line-strong text-ink-200" : file.status === "failed" ? "border-danger/40 text-danger" : "border-line text-ink-300",
      )}
    >
      {busy ? <LoaderCircle className="size-2.5 animate-spin" aria-hidden="true" /> : null}
      {busy ? "Indexing" : file.status}
    </span>
  );
}

/** Upload, browse, filter, and hand a file to a chat. Indexing status polls until it settles. */
export function LibraryView({ initialFiles }: { initialFiles: FileDto[] }) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    const busy = files.filter((file) => file.status === "indexing" || file.status === "uploaded");
    if (busy.length === 0) return;
    const timer = window.setInterval(async () => {
      for (const file of busy) {
        try {
          const response = await fetch(`/api/files/${file.id}?meta=1`);
          if (!response.ok) continue;
          const json = (await response.json()) as { file: FileDto & { createdAt: string } };
          if (json.file.status !== "indexing" && json.file.status !== "uploaded") {
            setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, ...json.file } : item)));
          }
        } catch {
          // Keep polling.
        }
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [files]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-file-menu]")) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    setError(null);
    for (const file of Array.from(list).slice(0, 6)) {
      setUploading((current) => [...current, file.name]);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/files", { method: "POST", body: form });
        if (!response.ok) {
          setError(await errorMessageFrom(response, "The upload failed."));
          continue;
        }
        const json = (await response.json()) as { file: FileDto };
        setFiles((current) => [json.file, ...current]);
      } catch {
        setError("The connection dropped during the upload.");
      } finally {
        setUploading((current) => current.filter((name) => name !== file.name));
      }
    }
    router.refresh();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  async function remove(file: FileDto) {
    setMenu(null);
    if (!(await confirm({ title: `Delete ${file.name}?`, body: "Chats that cite it keep their citations, but the file is gone." }))) return;
    startTransition(async () => {
      const result = await deleteFileAction({ fileId: file.id });
      if (result.ok) setFiles((current) => current.filter((item) => item.id !== file.id));
      else setError(result.message);
    });
  }

  function reindex(file: FileDto) {
    setMenu(null);
    setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, status: "indexing", error: null } : item)));
    startTransition(async () => {
      const result = await reindexFileAction({ fileId: file.id });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  const counts = {
    all: files.length,
    documents: files.filter((file) => matchesFilter(file, "documents")).length,
    sheets: files.filter((file) => matchesFilter(file, "sheets")).length,
    images: files.filter((file) => matchesFilter(file, "images")).length,
  };
  const visible = files.filter((file) => matchesFilter(file, filter) && (!query.trim() || file.name.toLowerCase().includes(query.trim().toLowerCase())));

  const actionsFor = (file: FileDto) => (
    <div data-file-menu className="relative">
      <IconButton label={`Options for ${file.name}`} size="sm" aria-haspopup="menu" aria-expanded={menu === file.id} onClick={() => setMenu((current) => (current === file.id ? null : file.id))}>
        <Ellipsis className="size-4" aria-hidden="true" />
      </IconButton>
      {menu === file.id ? (
        <div role="menu" aria-label={`Options for ${file.name}`} className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-ink-900 p-1 shadow-lift">
          <a href={`/api/files/${file.id}?download=1`} role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </a>
          {file.status === "failed" ? (
            <button type="button" role="menuitem" onClick={() => reindex(file)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Retry indexing
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => remove(file)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-danger hover:bg-ink-800">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );

  const chatLink = (file: FileDto, className?: string) =>
    file.scope === "chat" ? (
      <span className={cn("inline-flex h-6 items-center rounded-full border border-line px-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400", className)} title="This file belongs to the chat it was added to">
        In a chat
      </span>
    ) : file.kind !== "image" && file.status === "indexed" ? (
      <Link href={`${workspaceRoutes.home}?attach=${file.id}`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-ink-900 px-3 text-[12px] text-ink-100 hover:border-ink-400", className)}>
        <MessageSquare className="size-3.5" aria-hidden="true" />
        Chat
      </Link>
    ) : null;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="relative space-y-6"
    >
      <input ref={input} type="file" accept={ACCEPT_ATTRIBUTE} multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PillTabs
          value={filter}
          onChange={setFilter}
          label="Library filters"
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "documents", label: "Documents", count: counts.documents },
            { value: "sheets", label: "Spreadsheets", count: counts.sheets },
            { value: "images", label: "Images", count: counts.images },
          ]}
        />
        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" aria-label="Search library" className="w-full sm:w-56" />
          <div role="radiogroup" aria-label="View" className="hidden items-center rounded-full bg-ink-800 p-1 sm:flex">
            <button type="button" role="radio" aria-checked={view === "list"} aria-label="List view" onClick={() => setView("list")} className={cn("flex size-8 items-center justify-center rounded-full", view === "list" ? "bg-ink-600 text-ink-50" : "text-ink-300 hover:text-ink-50")}>
              <List className="size-4" aria-hidden="true" />
            </button>
            <button type="button" role="radio" aria-checked={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")} className={cn("flex size-8 items-center justify-center rounded-full", view === "grid" ? "bg-ink-600 text-ink-50" : "text-ink-300 hover:text-ink-50")}>
              <LayoutGrid className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => input.current?.click()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink-50 pl-3.5 pr-4 text-[13px] font-medium text-ink-950 transition-colors hover:bg-white">
            <Plus className="size-4" aria-hidden="true" />
            New
          </button>
        </div>
      </div>

      {uploading.length > 0 ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-300" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          Uploading {uploading.join(", ")}
        </p>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}

      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-ink-300 bg-ink-900" : "border-line-strong hover:border-ink-400",
          )}
        >
          <Upload className="size-5 text-ink-300" aria-hidden="true" />
          <span className="mt-3 text-[15px] font-medium text-ink-50">Drop files here, or click to choose</span>
          <span className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-400">PDF · DOCX · TXT · CSV · XLS · XLSX · images · 20 MB each</span>
        </button>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-ink-400">Nothing matches.</p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Files">
          {visible.map((file) => (
            <li key={file.id} className={cn("group relative overflow-hidden rounded-2xl border border-line bg-ink-900/40 p-3", pending && "opacity-70")} data-file-status={file.status}>
              <Thumb file={file} className="aspect-[4/3] w-full" />
              <div className="mt-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-[13.5px] font-medium text-ink-50 hover:underline">
                    {file.name}
                  </a>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink-400">
                    {formatBytes(file.size)} · {timeAgo(file.createdAt)}
                  </p>
                  {file.preview ? <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-400">{file.preview}</p> : null}
                </div>
                {actionsFor(file)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusChip file={file} />
                {chatLink(file, "ml-auto")}
              </div>
              {file.error ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger">
                  <CircleAlert className="size-3.5" aria-hidden="true" />
                  {file.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Panel>
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px_44px] gap-3 border-b border-line px-4 py-2 text-[12px] text-ink-400 sm:grid">
            <span>Name</span>
            <span>Size</span>
            <span>Last activity</span>
            <span />
          </div>
          <ul aria-label="Files">
            {visible.map((file) => (
              <li
                key={file.id}
                className={cn("group grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3 border-b border-line px-3 py-2.5 transition-colors last:border-b-0 hover:bg-ink-900/70 sm:grid-cols-[minmax(0,1fr)_120px_140px_44px] sm:px-4", pending && "opacity-70")}
                data-file-status={file.status}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Thumb file={file} className="size-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="truncate text-[14px] font-medium text-ink-50 hover:underline">
                        {file.name}
                      </a>
                      <StatusChip file={file} />
                      {file.pages ? <span className="hidden font-mono text-[10.5px] text-ink-400 md:inline">{file.pages} pages</span> : null}
                      {file.sheets.length ? (
                        <span className="hidden font-mono text-[10.5px] text-ink-400 md:inline">
                          {file.sheets.length} sheet{file.sheets.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {chatLink(file, "ml-1 h-7 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100")}
                    </div>
                    {file.preview ? <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-400">{file.preview}</p> : null}
                    {file.error ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-danger">
                        <CircleAlert className="size-3.5" aria-hidden="true" />
                        {file.error}
                      </p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-400 sm:hidden">
                      {formatBytes(file.size)} · {timeAgo(file.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="hidden font-mono text-[12px] text-ink-300 sm:block">{formatBytes(file.size)}</span>
                <span className="hidden text-[12.5px] text-ink-300 sm:block">Modified {timeAgo(file.createdAt)}</span>
                <div className="flex justify-end">{actionsFor(file)}</div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {dragging && files.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-dashed border-ink-300 bg-ink-950/80">
          <p className="text-[15px] font-medium text-ink-50">Drop to upload</p>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
