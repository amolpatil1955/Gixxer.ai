"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/*
 * A PDF drawn as it really looks: pdf.js renders each page to a canvas in the
 * browser, from the owner-only bytes at /api/files/{id}. The worker, fonts and
 * decoders are served from /public, so nothing loads from another origin.
 * Only the visible page is drawn; every render task and the document itself
 * are destroyed when the page, the zoom or the file changes.
 */

const BASE_WIDTH = 595;

interface PdfViewerProps {
  url: string;
  zoom: number;
  /** Called when the bytes cannot be drawn, so the caller can fall back to the text preview. */
  onFailure: () => void;
}

export function PdfViewer({ url, zoom, onFailure }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const failed = useRef(onFailure);
  useEffect(() => {
    failed.current = onFailure;
  });

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    let destroyTask: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({
          url,
          withCredentials: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        destroyTask = () => task.destroy();
        loaded = await task.promise;
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
      } catch {
        if (!cancelled) failed.current();
      }
    })();
    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
      else if (destroyTask) void destroyTask();
    };
  }, [url]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    const element = canvas.current;
    (async () => {
      try {
        setRendering(true);
        const current = await doc.getPage(page);
        if (cancelled) return;
        const unscaled = current.getViewport({ scale: 1 });
        const scale = (BASE_WIDTH / unscaled.width) * (zoom / 100);
        const viewport = current.getViewport({ scale });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${Math.floor(viewport.width)}px`;
        element.style.height = `${Math.floor(viewport.height)}px`;
        const context = element.getContext("2d");
        if (!context) return;
        task = current.render({ canvas: element, canvasContext: context, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) failed.current();
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom]);

  const count = doc?.numPages ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#eceef1]" data-pdf-viewer>
      <div className="scrollbar-thin relative flex min-h-0 flex-1 justify-center overflow-auto px-4 py-6">
        {!doc ? (
          <p className="flex items-center gap-2 self-start pt-10 text-[13px] text-[#555]" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Opening the PDF…
          </p>
        ) : null}
        <canvas
          ref={canvas}
          className={doc ? "h-fit shrink-0 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.14)]" : "hidden"}
          role="img"
          aria-label={count ? `Page ${page} of ${count}` : "PDF page"}
          data-pdf-page={page}
          data-rendering={rendering ? "true" : "false"}
        />
      </div>
      {count > 0 ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[#d9dce1] bg-white py-1.5 text-[#333]">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous page" className="flex size-8 items-center justify-center rounded-full hover:bg-[#eee] disabled:opacity-30">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <label className="flex items-center gap-1.5 font-mono text-[11.5px]" data-page-indicator>
            Page
            <input
              type="number"
              min={1}
              max={count}
              value={page}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1 && next <= count) setPage(next);
              }}
              aria-label="Page number"
              className="w-12 rounded-md border border-[#d0d3d8] px-1.5 py-0.5 text-center"
            />
            of {count}
          </label>
          <button type="button" onClick={() => setPage((value) => Math.min(count, value + 1))} disabled={page >= count} aria-label="Next page" className="flex size-8 items-center justify-center rounded-full hover:bg-[#eee] disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
