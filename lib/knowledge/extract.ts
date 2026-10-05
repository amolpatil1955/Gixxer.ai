import "server-only";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { FileKind } from "@/lib/db/models/workspace.models";
import { chunkPages, chunkSheet, normalizeWhitespace, type Segment } from "./chunk";

export interface Extraction {
  segments: Segment[];
  pages: number | null;
  sheets: string[];
  preview: string;
  /** Set when the file has no readable text (a scanned PDF, an image-only page); the reason, safe to show. */
  unreadable?: string;
}

/**
 * Share of characters in extracted PDF text that are not readable text: replacement
 * characters, private-use glyphs, control codes, or runs of question marks a broken font
 * map produces. Above a third, the text layer is noise.
 */
export function garbledRatio(text: string): number {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 1;
  const bad = (compact.match(/[\uFFFD\uE000-\uF8FF\u0000-\u0008\u000E-\u001F]|\?{2,}/g) ?? []).join("").length;
  return bad / compact.length;
}

export const SCANNED_PDF_MESSAGE =
  "This PDF has no readable text layer, so it looks like a scanned document. Gixxer cannot read scans yet: upload a text-based PDF or the original document.";

/** Pages whose text is noise become empty, so neither answers nor previews show broken characters. */
export function cleanPdfPages(pages: string[]): string[] {
  return pages.map((page) => (garbledRatio(page) > 0.33 ? "" : page.replace(/[\uFFFD\uE000-\uF8FF]/g, "")));
}

/** Hard ceilings so one enormous upload cannot exhaust the indexer. */
export const MAX_SEGMENTS_PER_FILE = 800;
const MAX_TEXT_CHARS = 2_000_000;

function preview(text: string): string {
  return normalizeWhitespace(text).slice(0, 500);
}

function cap(segments: Segment[]): Segment[] {
  return segments.slice(0, MAX_SEGMENTS_PER_FILE);
}

async function extractPdf(buffer: Buffer): Promise<Extraction> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: false });
  const pages = cleanPdfPages(result.text).map((page) => page.slice(0, MAX_TEXT_CHARS / Math.max(1, result.totalPages)));
  const readable = pages.join(" ").replace(/\s+/g, " ").trim();
  if (readable.length < Math.max(20, result.totalPages * 8)) {
    return { segments: [], pages: result.totalPages, sheets: [], preview: "", unreadable: SCANNED_PDF_MESSAGE };
  }
  return {
    segments: cap(chunkPages(pages, (index) => `p.${index + 1}`)),
    pages: result.totalPages,
    sheets: [],
    preview: preview(pages.find((page) => page.trim()) ?? ""),
  };
}

async function extractDocx(buffer: Buffer): Promise<Extraction> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.slice(0, MAX_TEXT_CHARS);
  const segments = chunkPages([text], () => "document");
  return {
    segments: cap(segments.map((segment, index) => ({ ...segment, locator: `part ${index + 1}` }))),
    pages: null,
    sheets: [],
    preview: preview(text),
  };
}

function extractPlain(buffer: Buffer): Extraction {
  const text = buffer.toString("utf8").slice(0, MAX_TEXT_CHARS);
  const segments = chunkPages([text], () => "text");
  return {
    segments: cap(segments.map((segment, index) => ({ ...segment, locator: `part ${index + 1}` }))),
    pages: null,
    sheets: [],
    preview: preview(text),
  };
}

function extractWorkbook(buffer: Buffer, kind: FileKind): Extraction {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: false });
  const segments: Segment[] = [];
  const sheets: string[] = [];
  let firstText = "";
  const overview: string[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    // The grid starts at A1 and keeps blank rows, so row numbers and column letters are the sheet's own.
    const grid = sheetGrid(sheet);
    const label = kind === "csv" ? "CSV" : name;
    const pieces = chunkSheet(label, grid);
    if (pieces.length > 0) {
      sheets.push(label);
      segments.push(...pieces);
      if (!firstText) firstText = pieces[0]?.text ?? "";
      const header = grid.find((row) => row.some((cell) => cell.trim() !== "")) ?? [];
      const dataRows = grid.filter((row) => row.some((cell) => cell.trim() !== "")).length - 1;
      overview.push(`Sheet "${label}": ${Math.max(0, dataRows)} data rows; columns ${header.filter(Boolean).join(", ")}`);
    }
    if (segments.length >= MAX_SEGMENTS_PER_FILE) break;
  }
  if (overview.length > 0) {
    segments.unshift({ text: `Workbook with ${overview.length} sheet${overview.length === 1 ? "" : "s"}.\n${overview.join("\n")}`, locator: "workbook" });
  }
  return { segments: cap(segments), pages: null, sheets, preview: preview(firstText) };
}

/** A sheet as a grid of displayed values, anchored at A1 with blank rows kept. */
export function sheetGrid(sheet: XLSX.WorkSheet, maxRows = 5000): string[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  range.s = { r: 0, c: 0 };
  range.e.r = Math.min(range.e.r, maxRows - 1);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: true, range });
  const grid = rows.map((row) => (Array.isArray(row) ? row.map((cell) => (cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? ""))) : []));
  while (grid.length > 0 && grid[grid.length - 1]!.every((cell) => cell.trim() === "")) grid.pop();
  return grid;
}

/** Text from a stored upload, split into citable segments. Images yield nothing to index. */
export async function extractFile(kind: FileKind, buffer: Buffer): Promise<Extraction> {
  switch (kind) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "txt":
      return extractPlain(buffer);
    case "csv":
    case "xls":
    case "xlsx":
      return extractWorkbook(buffer, kind);
    case "image":
      return { segments: [], pages: null, sheets: [], preview: "" };
  }
}

/** Plain text from a fetched web page: scripts and styles dropped, tags stripped, whitespace collapsed. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutBlocks.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer|table)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(
    text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}
