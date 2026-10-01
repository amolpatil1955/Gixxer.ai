import "server-only";
import { deflateSync } from "node:zlib";
import * as XLSX from "xlsx";
import type { DocumentKind } from "@/lib/chat/intents";

/*
 * Turns a model's answer into a file the reader can download. Everything is
 * built here, with no network: a small PDF writer (Helvetica, wrapped text,
 * one stream per page), SheetJS for workbooks, and plain UTF-8 for text.
 */

export interface BuiltDocument {
  bytes: Buffer;
  mime: string;
  extension: string;
  /** A short text rendition for the preview panel. */
  preview: string;
}

/* ---------------------------------- PDF ---------------------------------- */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const BODY_SIZE = 11;
const LEADING = 16;
const CHARS_PER_LINE = 88;

function pdfEscape(text: string): string {
  // WinAnsi covers Latin-1; anything else becomes a plain question mark rather than garbage.
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (char === "(" || char === ")" || char === "\\") return `\\${char}`;
      if (code < 32) return "";
      if (code > 255) return "?";
      return code > 126 ? `\\${code.toString(8).padStart(3, "0")}` : char;
    })
    .join("");
}

function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    if ((current + " " + word).trim().length > width) {
      if (current) out.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    } else current = (current + " " + word).trim();
  }
  if (current) out.push(current);
  return out;
}

interface PdfLine {
  text: string;
  size: number;
  bold: boolean;
  gap: number;
}

/** Light Markdown: headings become bold and larger, lists keep a bullet, everything else is text. */
function markdownToLines(markdown: string): PdfLine[] {
  const lines: PdfLine[] = [];
  let inCode = false;
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    if (/^```/.test(raw)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      for (const piece of wrap(raw.replace(/\t/g, "  "), CHARS_PER_LINE + 10)) lines.push({ text: piece, size: 9, bold: false, gap: 0 });
      continue;
    }
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      const size = level === 1 ? 20 : level === 2 ? 15 : 12.5;
      lines.push({ text: "", size: BODY_SIZE, bold: false, gap: 6 });
      for (const piece of wrap(strip(heading[2] ?? ""), Math.floor((CHARS_PER_LINE * BODY_SIZE) / size))) lines.push({ text: piece, size, bold: true, gap: 2 });
      continue;
    }
    const bullet = raw.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    const text = strip(bullet ? `• ${bullet[1] ?? ""}` : raw);
    if (!text.trim()) {
      lines.push({ text: "", size: BODY_SIZE, bold: false, gap: 4 });
      continue;
    }
    for (const piece of wrap(text, CHARS_PER_LINE)) lines.push({ text: piece, size: BODY_SIZE, bold: false, gap: 0 });
  }
  return lines;
}

function strip(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*\|?\s*-{3,}.*$/g, "")
    .replace(/\s*\|\s*/g, (match) => (match.trim() === "|" ? "   " : match));
}

export function buildPdf(title: string, markdown: string): Buffer {
  const lines = [{ text: "", size: BODY_SIZE, bold: false, gap: 0 }, ...markdownToLines(markdown)];
  const pages: string[][] = [];
  let page: string[] = [];
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    if (page.length) pages.push(page);
    page = [];
    y = PAGE_H - MARGIN;
  };
  // Title
  page.push(`BT /F2 20 Tf ${MARGIN} ${y.toFixed(2)} Td (${pdfEscape(title.slice(0, 70))}) Tj ET`);
  y -= 30;
  for (const line of lines) {
    const height = Math.max(LEADING, line.size * 1.45);
    y -= line.gap;
    if (y - height < MARGIN) newPage();
    y -= height;
    if (line.text) page.push(`BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${MARGIN} ${y.toFixed(2)} Td (${pdfEscape(line.text)}) Tj ET`);
  }
  if (page.length) pages.push(page);
  if (pages.length === 0) pages.push([]);

  // Objects: 1 catalog, 2 pages, 3 font regular, 4 font bold, then page + content pairs.
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length;
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // pages, filled in below
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const content of pages) {
    const stream = deflateSync(Buffer.from(content.join("\n"), "latin1"));
    const contentId = add(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n${stream.toString("latin1")}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/* ---------------------------------- XLSX --------------------------------- */

/** Rows from the first Markdown table or CSV block in the text; else one column of lines. */
export function tableFromText(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n");
  const tableLines = lines.filter((line) => /^\s*\|.*\|\s*$/.test(line));
  if (tableLines.length >= 2) {
    return tableLines
      .filter((line) => !/^\s*\|\s*:?-{2,}/.test(line))
      .map((line) =>
        line
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => strip(cell.trim())),
      );
  }
  const csv = text.match(/```(?:csv|tsv)?\n([\s\S]*?)```/i)?.[1];
  if (csv) {
    const rows = csv.trim().split("\n");
    const separator = rows[0]?.includes("\t") ? "\t" : ",";
    return rows.map((row) => row.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, "")));
  }
  return lines.filter((line) => line.trim()).map((line) => [strip(line)]);
}

export function buildXlsx(sheetName: string, text: string): { bytes: Buffer; rows: string[][] } {
  const rows = tableFromText(text);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((cell) => (/^-?\d+(\.\d+)?$/.test(cell) ? Number(cell) : cell))));
  const widths = rows[0]?.map((_, column) => ({ wch: Math.min(60, Math.max(10, ...rows.map((row) => (row[column] ?? "").length + 2))) })) ?? [];
  sheet["!cols"] = widths;
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31) || "Sheet1");
  return { bytes: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer, rows };
}

/* ---------------------------------- Any ---------------------------------- */

export function buildDocument(format: DocumentKind, title: string, content: string): BuiltDocument {
  switch (format) {
    case "pdf":
      return { bytes: buildPdf(title, content), mime: "application/pdf", extension: "pdf", preview: strip(content).slice(0, 2000) };
    case "xlsx": {
      const { bytes, rows } = buildXlsx(title, content);
      return {
        bytes,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        preview: rows
          .slice(0, 40)
          .map((row) => row.join(" | "))
          .join("\n")
          .slice(0, 2000),
      };
    }
    case "txt": {
      const text = strip(content.replace(/```[a-z]*\n?/g, ""));
      return { bytes: Buffer.from(text, "utf8"), mime: "text/plain", extension: "txt", preview: text.slice(0, 2000) };
    }
  }
}

/** A file name from the request, e.g. "Create a PDF about solar panels" → "solar-panels". */
export function documentName(subject: string, format: DocumentKind): string {
  const cleaned = subject
    .replace(/\b(?:please|pls|create|make|generate|write|export|put|turn|convert|prepare|build|draft|compile|me|a|an|the|into|as|in|this|that|of|about|on|file|document|report|pdf|excel|spreadsheet|workbook|xlsx|txt|text)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  // Long names end at a word, never in the middle of one.
  const short = cleaned.length > 60 ? cleaned.slice(0, 60).replace(/-[^-]*$/, "") : cleaned;
  return `${short || "gixxer-document"}.${format}`;
}
