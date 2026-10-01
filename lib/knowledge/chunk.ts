/** Client-safe text utilities for the knowledge pipeline. */

export interface Segment {
  text: string;
  /** Human-readable position, e.g. "p.17" or "Sales!A2:F26". */
  locator: string;
}

export interface ChunkOptions {
  /** Target characters per chunk. */
  size?: number;
  /** Characters carried over from the previous chunk. */
  overlap?: number;
}

export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 150;

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits prose into overlapping windows, preferring paragraph and sentence
 * boundaries so a chunk rarely starts mid-thought.
 */
export function chunkText(text: string, { size = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP }: ChunkOptions = {}): string[] {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const paragraph = window.lastIndexOf("\n\n");
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      const cut = paragraph > size * 0.4 ? paragraph : sentence > size * 0.4 ? sentence + 1 : -1;
      if (cut > 0) end = start + cut;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** Column index (0-based) to a spreadsheet letter: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let value = index + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

export const SHEET_ROWS_PER_CHUNK = 20;
export const SHEET_MAX_ROWS = 4000;

/**
 * Turns a grid into row-window chunks. Every chunk repeats the header row so
 * a value is never separated from its column name, and its locator names the
 * exact range so an answer can cite "Sheet!A2:D21".
 */
export function chunkSheet(sheetName: string, rows: string[][]): Segment[] {
  const trimmed = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const nonEmpty = trimmed.filter((row) => row.some((cell) => cell !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0] ?? [];
  const body = nonEmpty.slice(1, 1 + SHEET_MAX_ROWS);
  const width = Math.max(header.length, ...body.map((row) => row.length), 1);
  const lastColumn = columnLetter(width - 1);
  const segments: Segment[] = [];

  if (body.length === 0) {
    return [{ text: `${sheetName}\n${header.join(" | ")}`, locator: `${sheetName}!A1:${lastColumn}1` }];
  }

  for (let start = 0; start < body.length; start += SHEET_ROWS_PER_CHUNK) {
    const window = body.slice(start, start + SHEET_ROWS_PER_CHUNK);
    const lines = window.map((row, offset) => {
      const rowNumber = start + offset + 2; // 1-based, after the header
      const cells = row.map((cell, column) => `${header[column] || columnLetter(column)}: ${cell}`).filter((cell) => !cell.endsWith(": "));
      return `Row ${rowNumber}: ${cells.join(" | ")}`;
    });
    const firstRow = start + 2;
    const lastRow = start + window.length + 1;
    segments.push({
      text: `Sheet ${sheetName}, columns: ${header.filter(Boolean).join(", ")}\n${lines.join("\n")}`,
      locator: `${sheetName}!A${firstRow}:${lastColumn}${lastRow}`,
    });
  }
  return segments;
}

/** Prose pages or sections into segments, one locator per source page. */
export function chunkPages(pages: string[], label: (index: number) => string, options?: ChunkOptions): Segment[] {
  const segments: Segment[] = [];
  pages.forEach((page, index) => {
    for (const piece of chunkText(page, options)) segments.push({ text: piece, locator: label(index) });
  });
  return segments;
}
