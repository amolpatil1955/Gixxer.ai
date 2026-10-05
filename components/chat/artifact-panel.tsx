"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download, Ellipsis, ExternalLink, LoaderCircle, Maximize2, Minimize2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ArtifactDto } from "@/lib/chat/types";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";
import { artifactFormat, artifactUrl } from "./artifact-card";
import { PdfViewer } from "./pdf-viewer";

/*
 * The preview of a generated document, beside the chat. The chrome is the
 * app's: a "Library / name" breadcrumb, zoom, a small menu, download, expand
 * and close. The document itself is drawn the way its kind is drawn in
 * the real thing: a PDF as white paper pages, a workbook as a white grid
 * with lettered columns, numbered rows, a name box, a formula bar and sheet
 * tabs. The real bytes are one click away in the browser's own viewer.
 */

type Preview =
  | { kind: "sheets"; sheets: { name: string; rows: string[][]; truncated: boolean }[] }
  | { kind: "pages"; pageCount: number; pages: string[]; textLayer?: boolean }
  | { kind: "text"; text: string }
  | { kind: "none" };

const ZOOMS = [50, 75, 90, 100, 125, 150, 200];
const MIN_ROWS = 40;
const MIN_COLUMNS = 13;

function columnLetter(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function Sheet({ rows, zoom }: { rows: string[][]; zoom: number }) {
  const [selected, setSelected] = useState<{ row: number; column: number }>({ row: 0, column: 0 });
  const dataWidth = Math.max(1, ...rows.map((row) => row.length));
  const columns = Math.max(MIN_COLUMNS, dataWidth);
  const rowCount = Math.max(MIN_ROWS, rows.length);
  const value = rows[selected.row]?.[selected.column] ?? "";
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-[#1b1b1b]" data-sheet-grid>
      <div className="flex shrink-0 items-stretch border-b border-[#d8d8d8] text-[12px]">
        <div className="flex w-20 items-center border-r border-[#d8d8d8] px-3 font-mono text-[11.5px] text-[#444]" aria-label="Selected cell">
          {columnLetter(selected.column)}
          {selected.row + 1}
        </div>
        <div className="flex w-10 items-center justify-center border-r border-[#d8d8d8] italic text-[#888]" aria-hidden="true">
          fx
        </div>
        <div className="flex min-w-0 flex-1 items-center truncate px-3 py-2 text-[#1b1b1b]" aria-label="Cell contents">
          {value}
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <table className="border-collapse" style={{ zoom: zoom / 100 }}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-6 w-11 border border-[#d8d8d8] bg-[#f3f3f3]" />
              {Array.from({ length: columns }, (_, column) => (
                <th key={column} className={cn("sticky top-0 z-10 h-6 min-w-[92px] border border-[#d8d8d8] bg-[#f3f3f3] px-2 text-center text-[11.5px] font-normal text-[#444]", column === selected.column && "bg-[#dbe7ff] text-[#1b4fd8]")}>
                  {columnLetter(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const row = rows[rowIndex];
              const header = rowIndex === 0 && rows.length > 0;
              const striped = rowIndex > 0 && rowIndex < rows.length && rowIndex % 2 === 0;
              return (
                <tr key={rowIndex}>
                  <td className={cn("sticky left-0 z-10 h-6 border border-[#d8d8d8] bg-[#f3f3f3] px-1.5 text-center text-[11px] text-[#444]", rowIndex === selected.row && "bg-[#dbe7ff] text-[#1b4fd8]")}>{rowIndex + 1}</td>
                  {Array.from({ length: columns }, (_, column) => {
                    const cell = row?.[column] ?? "";
                    const numeric = cell !== "" && /^-?[$€£]?[\d,.]+%?$/.test(cell);
                    const active = rowIndex === selected.row && column === selected.column;
                    return (
                      <td
                        key={column}
                        onClick={() => setSelected({ row: rowIndex, column })}
                        className={cn(
                          "h-6 max-w-[240px] cursor-cell truncate border border-[#e3e3e3] px-2 text-[12.5px] leading-6",
                          header && column < dataWidth && "bg-[#0d0d0d] text-center font-semibold text-white",
                          striped && column < dataWidth && "bg-[#cfe8ff]",
                          numeric && !header && "text-right tabular-nums",
                          active && "outline outline-2 -outline-offset-1 outline-[#1b6ff5]",
                        )}
                        title={cell || undefined}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pages({ pages, pageCount, zoom }: { pages: string[]; pageCount: number; zoom: number }) {
  const [page, setPage] = useState(0);
  const text = pages[page] ?? "";
  const lines = text.split("\n");
  const title = lines[0]?.trim() ?? "";
  const titled = page === 0 && title.length > 0 && title.length < 72;
  const body = titled ? lines.slice(1).join("\n").trim() : text;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f2f2f2]">
      <div className="scrollbar-thin flex min-h-0 flex-1 justify-center overflow-auto px-4 py-6">
        <article
          className="h-fit w-[595px] max-w-full shrink-0 bg-white px-14 py-16 text-[13px] leading-[1.7] text-[#1b1b1b] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
          style={{ zoom: zoom / 100, minHeight: 842 }}
          aria-label={`Page ${page + 1} of ${pageCount}`}
          data-page
        >
          {titled ? <h1 className="mb-4 text-center text-[24px] font-bold leading-tight tracking-tight">{title}</h1> : null}
          {body ? <pre className="whitespace-pre-wrap font-sans">{body}</pre> : null}
          {!title && !body ? <p className="italic text-[#777]">This page has no readable text. It may be a scanned image; download the file to see it.</p> : null}
        </article>
      </div>
      {pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[#dcdcdc] bg-white py-1.5 text-[#333]">
          <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Previous page" className="flex size-8 items-center justify-center rounded-full hover:bg-[#eee] disabled:opacity-30">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="font-mono text-[11.5px]" data-page-indicator>
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1} aria-label="Next page" className="flex size-8 items-center justify-center rounded-full hover:bg-[#eee] disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <span className="sr-only" data-page-indicator>
          Page 1 of 1
        </span>
      )}
    </div>
  );
}

interface ArtifactPanelProps {
  artifact: ArtifactDto | null;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);

  // A new artifact starts from a clean slate. Adjusted during render, as React recommends.
  if (artifact && loadedFor !== artifact.refId) {
    setLoadedFor(artifact.refId);
    setPreview(null);
    setError(null);
    setSheet(0);
    setMenu(false);
    setPdfFailed(false);
  }

  useEffect(() => {
    if (!artifact) return;
    const controller = new AbortController();
    fetch(`/api/files/${artifact.refId}/preview`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessageFrom(response, "The preview could not be loaded."));
        const json = (await response.json()) as { preview: Preview };
        setPreview(json.preview);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "The preview could not be loaded.");
      });
    return () => controller.abort();
  }, [artifact]);

  useEffect(() => {
    if (!artifact) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artifact, onClose]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if (menuRoot.current && !menuRoot.current.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menu]);

  const sheets = preview?.kind === "sheets" ? preview.sheets : [];
  const current = sheets[sheet];
  // The chrome is always dark, whatever the theme, so its colours are literal rather than tokens.
  const chromeButton = "flex size-9 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <AnimatePresence>
      {artifact ? (
        <>
          <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className={cn("fixed inset-0 z-40 bg-black/50", !expanded && "lg:hidden")} onClick={onClose} aria-hidden="true" />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={`Preview of ${artifact.name}`}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-white/10 bg-[#080616] text-white shadow-float",
              expanded ? "w-full" : "w-[min(760px,100vw)] lg:absolute lg:z-20",
            )}
            data-artifact-panel
            data-expanded={expanded ? "true" : "false"}
          >
            <header className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 pl-4 pr-2">
              <p className="min-w-0 flex-1 truncate text-[13px]">
                <span className="text-white/55">Gixxer</span>
                <span className="mx-1.5 text-white/35">/</span>
                <span className="text-white">{artifact.name}</span>
              </p>
              <label className="relative mr-1 hidden items-center sm:flex">
                <span className="sr-only">Zoom</span>
                <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" className="h-8 appearance-none rounded-lg bg-transparent pl-2 pr-6 text-[12.5px] text-white/85 outline-none hover:bg-white/10 [&>option]:bg-[#080616] [&>option]:text-white">
                  {ZOOMS.map((level) => (
                    <option key={level} value={level}>
                      {level}%
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-white/55" aria-hidden="true" />
              </label>
              <div ref={menuRoot} className="relative">
                <button type="button" onClick={() => setMenu((value) => !value)} aria-haspopup="menu" aria-expanded={menu} aria-label="More options" className={chromeButton}>
                  <Ellipsis className="size-4.5" aria-hidden="true" />
                </button>
                {menu ? (
                  <div role="menu" aria-label="More options" className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#120f24] p-1 shadow-lift">
                    <a href={artifactUrl(artifact)} target="_blank" rel="noopener noreferrer" role="menuitem" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/90 hover:bg-white/10">
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Open in a new tab
                    </a>
                  </div>
                ) : null}
              </div>
              <a href={artifactUrl(artifact, true)} download aria-label="Download" title="Download" className={chromeButton}>
                <Download className="size-4.5" aria-hidden="true" />
              </a>
              <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Exit full screen" : "Full screen"} aria-pressed={expanded} className={cn(chromeButton, "hidden lg:flex")}>
                {expanded ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
              </button>
              <button type="button" onClick={onClose} aria-label="Close preview" className={chromeButton}>
                <X className="size-4.5" aria-hidden="true" />
              </button>
            </header>

            {artifactFormat(artifact) === "pdf" && !pdfFailed ? (
              <PdfViewer key={artifact.refId} url={artifactUrl(artifact)} zoom={zoom} onFailure={() => setPdfFailed(true)} />
            ) : error ? (
              <p role="alert" className="px-5 py-6 text-[13px] text-[#ff8a8a]">
                {error}
              </p>
            ) : !preview ? (
              <p className="flex items-center gap-2 px-5 py-6 text-[13px] text-white/60" role="status">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Loading preview…
              </p>
            ) : preview.kind === "sheets" && current ? (
              <>
                <Sheet key={`${artifact.refId}-${sheet}`} rows={current.rows} zoom={zoom} />
                <div role="tablist" aria-label="Sheets" className="scrollbar-thin flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-[#d8d8d8] bg-[#f3f3f3] px-2 py-1">
                  {sheets.map((item, index) => (
                    <button
                      key={item.name}
                      type="button"
                      role="tab"
                      aria-selected={index === sheet}
                      onClick={() => setSheet(index)}
                      className={cn("shrink-0 rounded-md px-3 py-1 text-[12px] transition-colors", index === sheet ? "bg-white font-medium text-[#1b1b1b] shadow-[0_1px_0_#d8d8d8]" : "text-[#555] hover:bg-white/70")}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </>
            ) : preview.kind === "pages" ? (
              <Pages key={artifact.refId} pages={preview.pages} pageCount={preview.pageCount} zoom={zoom} />
            ) : preview.kind === "text" ? (
              <div className="scrollbar-thin min-h-0 flex-1 overflow-auto bg-[#f2f2f2] px-4 py-6">
                <pre className="mx-auto w-[595px] max-w-full whitespace-pre-wrap bg-white px-12 py-12 font-sans text-[13px] leading-[1.7] text-[#1b1b1b] shadow-[0_4px_24px_rgba(0,0,0,0.12)]" style={{ zoom: zoom / 100 }}>
                  {preview.text}
                </pre>
              </div>
            ) : (
              <p className="px-5 py-6 text-[13px] text-white/60">No preview for this file type. Download it to open it.</p>
            )}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
