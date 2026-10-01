"use client";

import { Download } from "lucide-react";
import type { ArtifactDto } from "@/lib/chat/types";
import { cn } from "@/lib/utils/cn";

export function artifactUrl(artifact: ArtifactDto, download = false): string {
  const base = artifact.kind === "image" ? `/api/images/${artifact.refId}` : `/api/files/${artifact.refId}`;
  return download ? `${base}?download=1` : base;
}

export type ArtifactFormat = "image" | "pdf" | "xlsx" | "txt" | "file";

export function artifactFormat(artifact: ArtifactDto): ArtifactFormat {
  if (artifact.kind === "image") return "image";
  if (artifact.mime.includes("pdf")) return "pdf";
  if (artifact.mime.includes("spreadsheet") || artifact.mime.includes("excel") || artifact.mime.includes("csv")) return "xlsx";
  if (artifact.mime.startsWith("text/")) return "txt";
  return "file";
}

export function artifactTypeLabel(artifact: ArtifactDto): string {
  switch (artifactFormat(artifact)) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "xlsx":
      return "Spreadsheet";
    case "txt":
      return "Text file";
    default:
      return "File";
  }
}

/** "solar-panels-for-homeowners.pdf" → "Solar Panels For Homeowners". */
export function artifactTitle(artifact: ArtifactDto): string {
  return artifact.name
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function downloadLabel(artifact: ArtifactDto): string {
  const format = artifactFormat(artifact);
  const noun = format === "pdf" ? "PDF" : format === "xlsx" ? "Excel File" : format === "txt" ? "Text File" : "File";
  return `Download ${artifactTitle(artifact)} ${noun}`;
}

/** The PDF mark: a red document with its label. */
export function PdfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true" focusable="false">
      <path d="M6 2.5h8.2L20 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5Z" fill="none" stroke="#e5484d" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2.8v5.4h5.6" fill="none" stroke="#e5484d" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="3.2" y="12.2" width="13.6" height="6.6" rx="1.3" fill="#e5484d" />
      <text x="10" y="17.3" textAnchor="middle" fontSize="4.6" fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#fff">
        PDF
      </text>
    </svg>
  );
}

/** The spreadsheet mark: a green grid. */
export function SheetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="#1d9e5a" strokeWidth="1.7" />
      <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" stroke="#1d9e5a" strokeWidth="1.5" />
    </svg>
  );
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M6 2.5h8.2L20 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 2.8v5.4h5.6M8.5 12h7M8.5 15.5h7M8.5 19h4" />
    </svg>
  );
}

export function FileIcon({ format, className }: { format: ArtifactFormat; className?: string }) {
  if (format === "pdf") return <PdfIcon className={className} />;
  if (format === "xlsx") return <SheetIcon className={className} />;
  return <TextIcon className={cn("text-ink-200", className)} />;
}

interface ArtifactCardProps {
  artifact: ArtifactDto;
  onOpen: (artifact: ArtifactDto) => void;
}

/**
 * A generated file inside a reply, the way a chat app shows one: a "Download …"
 * link, then a compact card (icon, name, what it is) that opens the preview,
 * with a download control at its end.
 */
export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
  if (artifact.kind === "image") {
    return (
      <figure className="mt-3 max-w-md animate-pop-in motion-reduce:animate-none">
        <button type="button" onClick={() => onOpen(artifact)} className="group relative block w-full overflow-hidden rounded-2xl border border-line bg-ink-900 text-left" aria-label={`Open image: ${artifact.prompt}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- bytes come from our own authenticated route */}
          <img src={artifactUrl(artifact)} alt={artifact.prompt} className="block w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" style={{ aspectRatio: artifact.width && artifact.height ? `${artifact.width} / ${artifact.height}` : "4 / 3" }} />
        </button>
        <figcaption className="mt-1.5 flex items-center gap-2 px-1 text-[12px] text-ink-400">
          <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
          <a href={artifactUrl(artifact, true)} download className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-300 hover:bg-ink-800 hover:text-ink-50" aria-label="Download image">
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </a>
        </figcaption>
      </figure>
    );
  }

  const format = artifactFormat(artifact);
  return (
    <div className="mt-2 max-w-lg animate-fade-in motion-reduce:animate-none" data-artifact-file>
      <a href={artifactUrl(artifact, true)} download className="inline-flex items-center gap-2 text-[15px] font-medium text-ink-50 underline decoration-ink-500 underline-offset-[5px] hover:decoration-ink-50">
        <FileIcon format={format} className="size-4.5" />
        {downloadLabel(artifact)}
      </a>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-ink-900 py-3 pl-4 pr-2 shadow-[inset_0_1px_0_var(--gloss-low)]">
        <button type="button" onClick={() => onOpen(artifact)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open file: ${artifact.name}`}>
          <FileIcon format={format} className="size-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-medium text-ink-50">{artifact.name}</span>
            <span className="block text-[12.5px] text-ink-400">{format === "pdf" ? "Open file" : artifactTypeLabel(artifact)}</span>
          </span>
        </button>
        <a href={artifactUrl(artifact, true)} download aria-label={`Download ${artifact.name}`} title="Download" className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-50">
          <Download className="size-4.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
