import "server-only";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import { readBlob } from "@/lib/db/storage";
import type { FileKind } from "@/lib/db/models/workspace.models";
import { getFile } from "./repository";

/*
 * What the preview panel shows for a file: a workbook as sheets of cells, a
 * PDF as pages of text, a text file as text. Bounded so one big file cannot
 * flood the browser: at most 12 sheets of 300 x 40 cells, 60 pages of 20k
 * characters, or 200k characters of text.
 */

export const PREVIEW_MAX_SHEETS = 12;
export const PREVIEW_MAX_ROWS = 300;
export const PREVIEW_MAX_COLUMNS = 40;
export const PREVIEW_MAX_PAGES = 60;
const PAGE_MAX_CHARS = 20_000;
const TEXT_MAX_CHARS = 200_000;

export type FilePreview =
  | { kind: "sheets"; sheets: { name: string; rows: string[][]; truncated: boolean }[] }
  | { kind: "pages"; pageCount: number; pages: string[] }
  | { kind: "text"; text: string }
  | { kind: "none" };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function workbookPreview(bytes: Buffer, kind: FileKind): FilePreview {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, ...(kind === "csv" ? { raw: true } : {}) });
  const sheets = workbook.SheetNames.slice(0, PREVIEW_MAX_SHEETS).map((name) => {
    const sheet = workbook.Sheets[name];
    const grid: unknown[][] = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false }) : [];
    const rows = grid.slice(0, PREVIEW_MAX_ROWS).map((row) => row.slice(0, PREVIEW_MAX_COLUMNS).map(cellText));
    const width = Math.max(1, ...rows.map((row) => row.length));
    return {
      name: kind === "csv" ? "CSV" : name,
      rows: rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]),
      truncated: grid.length > PREVIEW_MAX_ROWS || grid.some((row) => row.length > PREVIEW_MAX_COLUMNS),
    };
  });
  return { kind: "sheets", sheets };
}

export async function pdfPreview(bytes: Buffer): Promise<FilePreview> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(bytes), { mergePages: false });
  return {
    kind: "pages",
    pageCount: result.totalPages,
    pages: result.text.slice(0, PREVIEW_MAX_PAGES).map((page) => page.replace(/\r/g, "").trim().slice(0, PAGE_MAX_CHARS)),
  };
}

/** The preview for one of the owner's files. Null when the file is not theirs or does not exist. */
export async function previewFile(userId: string, fileId: string): Promise<FilePreview | null> {
  const file = await getFile(userId, fileId);
  if (!file) return null;
  const bytes = await readBlob(new Types.ObjectId(file.storageId));
  switch (file.kind) {
    case "xlsx":
    case "xls":
    case "csv":
      return workbookPreview(bytes, file.kind);
    case "pdf":
      return pdfPreview(bytes);
    case "txt":
      return { kind: "text", text: bytes.toString("utf8").slice(0, TEXT_MAX_CHARS) };
    default:
      return { kind: "none" };
  }
}
