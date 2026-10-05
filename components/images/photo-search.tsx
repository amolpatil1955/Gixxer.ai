"use client";

import { Download, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import type { UnsplashPhotoDto, UnsplashSearchDto } from "@/lib/unsplash/types";
import { cn } from "@/lib/utils/cn";
import { cardAction, ImageCard } from "./image-card";
import { Lightbox } from "./lightbox";

/*
 * Reference photos from Unsplash, inside the Styles tab. Search only: these are
 * photographers' pictures, never generated ones. Each photo carries its
 * photographer and a link back to Unsplash, as the Unsplash guidelines ask, and
 * a download is reported through the server before the file is handed over.
 */

type State = { kind: "idle" } | { kind: "loading"; query: string; page: number } | { kind: "error"; message: string } | { kind: "results"; data: UnsplashSearchDto };

function Attribution({ photo, className }: { photo: UnsplashPhotoDto; className?: string }) {
  return (
    <span className={cn("text-[11.5px] leading-snug text-white/85", className)}>
      Photo by{" "}
      <a href={photo.photographer.profileUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:text-white" onClick={(event) => event.stopPropagation()}>
        {photo.photographer.name}
      </a>{" "}
      on{" "}
      <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:text-white" onClick={(event) => event.stopPropagation()}>
        Unsplash
      </a>
    </span>
  );
}

/** The search box at the top of Styles. `results` renders below it only once a search has run. */
export function PhotoSearch({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [viewing, setViewing] = useState<UnsplashPhotoDto | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function search(nextQuery: string, page = 1) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ kind: "loading", query: trimmed, page });
    onActiveChange?.(true);
    try {
      const response = await fetch(`/api/unsplash/search?q=${encodeURIComponent(trimmed)}&page=${page}`, { signal: current.signal });
      if (!response.ok) {
        setState({ kind: "error", message: await errorMessageFrom(response, "Photos could not be fetched.") });
        return;
      }
      setState({ kind: "results", data: (await response.json()) as UnsplashSearchDto });
    } catch {
      if (!current.signal.aborted) setState({ kind: "error", message: "The connection dropped. Please try again." });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void search(query, 1);
  }

  function clear() {
    controller.current?.abort();
    setQuery("");
    setState({ kind: "idle" });
    onActiveChange?.(false);
  }

  async function download(photo: UnsplashPhotoDto) {
    setDownloading(photo.id);
    setDownloadError(null);
    try {
      const response = await fetch("/api/unsplash/download", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photoId: photo.id }) });
      if (!response.ok) {
        setDownloadError(await errorMessageFrom(response, "The photo could not be fetched."));
        return;
      }
      const json = (await response.json()) as { url: string };
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError("The connection dropped. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  const results = state.kind === "results" ? state.data : null;

  return (
    <div className="space-y-4" data-photo-search>
      <form onSubmit={submit} role="search" className="flex items-center gap-2 rounded-full border border-line bg-ink-900 py-1 pl-4 pr-1 focus-within:border-line-strong" aria-label="Search photos">
        <Search className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 120))}
          placeholder="Search reference photos"
          aria-label="Search photos"
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink-50 outline-none placeholder:text-ink-400"
        />
        {state.kind !== "idle" ? (
          <button type="button" onClick={clear} className="h-8 rounded-full px-3 text-[12.5px] text-ink-300 hover:text-ink-50">
            Clear
          </button>
        ) : null}
        <button type="submit" disabled={!query.trim() || state.kind === "loading"} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-50 px-4 text-[13px] font-medium text-ink-950 transition-colors hover:bg-white disabled:opacity-50">
          {state.kind === "loading" ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          Search
        </button>
      </form>

      {downloadError ? (
        <p role="alert" className="text-[13px] text-danger">
          {downloadError}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13.5px] text-ink-50">
          {state.message}
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading photos" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-ink-800">
              <div className="h-full w-full shimmer-surface animate-shimmer" />
            </li>
          ))}
        </ul>
      ) : null}

      {results && results.results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-ink-50">No photos for &ldquo;{results.query}&rdquo;</p>
          <p className="mt-1.5 text-[13.5px] text-ink-400">Try a broader word, or a different one.</p>
        </div>
      ) : null}

      {results && results.results.length > 0 ? (
        <>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-400" role="status">
            {results.total.toLocaleString()} photo{results.total === 1 ? "" : "s"} for &ldquo;{results.query}&rdquo;
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos">
            {results.results.map((photo) => (
              <li key={photo.id}>
                <ImageCard
                  src={photo.urls.small}
                  alt={photo.alt}
                  openLabel={`View photo: ${photo.alt}`}
                  onOpen={() => setViewing(photo)}
                  color={photo.color}
                  caption={<Attribution photo={photo} />}
                  actions={
                    <button type="button" onClick={() => void download(photo)} disabled={downloading === photo.id} aria-label={`Download photo by ${photo.photographer.name}`} title="Download" className={cardAction}>
                      {downloading === photo.id ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
          {results.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button type="button" disabled={results.page <= 1} onClick={() => void search(results.query, results.page - 1)} className="rounded-full border border-line px-4 py-1.5 text-[13px] text-ink-200 hover:border-ink-400 hover:text-ink-50 disabled:opacity-40">
                Previous
              </button>
              <span className="font-mono text-[11.5px] text-ink-400">
                Page {results.page} of {Math.min(results.totalPages, 50)}
              </span>
              <button type="button" disabled={results.page >= Math.min(results.totalPages, 50)} onClick={() => void search(results.query, results.page + 1)} className="rounded-full border border-line px-4 py-1.5 text-[13px] text-ink-200 hover:border-ink-400 hover:text-ink-50 disabled:opacity-40">
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <Lightbox
        image={viewing ? { src: viewing.urls.regular, alt: viewing.alt, caption: viewing.alt, attribution: <Attribution photo={viewing} /> } : null}
        onClose={() => setViewing(null)}
        actions={
          viewing ? (
            <button type="button" onClick={() => void download(viewing)} disabled={downloading === viewing.id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-white/90 disabled:opacity-60">
              <Download className="size-4" aria-hidden="true" />
              Download
            </button>
          ) : null
        }
      />
    </div>
  );
}
