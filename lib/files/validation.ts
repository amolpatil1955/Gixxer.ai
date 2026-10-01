import { z } from "zod";
import type { FileKind } from "@/lib/db/models/workspace.models";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Accepted uploads, by extension. The server also sniffs the bytes for the binary formats. */
export const ACCEPTED_EXTENSIONS: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "txt",
  csv: "csv",
  xlsx: "xlsx",
  xls: "xls",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(",");

export function kindForName(name: string): FileKind | null {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return ACCEPTED_EXTENSIONS[extension] ?? null;
}

export const fileIdSchema = z.object({ fileId: z.string().regex(/^[a-f0-9]{24}$/i) });

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
