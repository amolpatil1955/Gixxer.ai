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
  const pages = result.text.map((page) => page.slice(0, MAX_TEXT_CHARS / Math.max(1, result.totalPages)));
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
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    const grid = rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
    const label = kind === "csv" ? "CSV" : name;
    const pieces = chunkSheet(label, grid);
    if (pieces.length > 0) {
      sheets.push(label);
      segments.push(...pieces);
      if (!firstText) firstText = pieces[0]?.text ?? "";
    }
    if (segments.length >= MAX_SEGMENTS_PER_FILE) break;
  }
  return { segments: cap(segments), pages: null, sheets, preview: preview(firstText) };
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
