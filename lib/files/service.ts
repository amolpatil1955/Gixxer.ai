import "server-only";
import { deleteBlob, readBlob, storeBlob } from "@/lib/db/storage";
import { extractFile } from "@/lib/knowledge/extract";
import { deleteChunksForFile, indexSegments } from "@/lib/knowledge/index";
import { createFile, deleteFileRecord, getFile, updateFileIndex, type FileRecord } from "./repository";
import { kindForName, MAX_UPLOAD_BYTES, safeFileName } from "./validation";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** The first bytes of each binary format we accept. Text formats are checked for being text. */
function sniff(kind: string, bytes: Buffer): boolean {
  const head = bytes.subarray(0, 8);
  switch (kind) {
    case "pdf":
      return head.subarray(0, 4).toString("latin1") === "%PDF";
    case "docx":
    case "xlsx":
      return head[0] === 0x50 && head[1] === 0x4b; // zip container
    case "xls":
      return head[0] === 0xd0 && head[1] === 0xcf; // OLE compound document
    case "image":
      return (
        (head[0] === 0x89 && head[1] === 0x50) || // png
        (head[0] === 0xff && head[1] === 0xd8) || // jpeg
        head.subarray(0, 4).toString("latin1") === "RIFF" // webp
      );
    default: {
      // txt, csv, md: refuse NUL bytes, which no text file has.
      return !bytes.subarray(0, 4096).includes(0);
    }
  }
}

function mimeFor(kind: string, declared: string): string {
  const known: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    txt: "text/plain",
  };
  if (kind === "image") return /^image\/(png|jpeg|webp)$/.test(declared) ? declared : "image/png";
  return known[kind] ?? "application/octet-stream";
}

/** Validates, stores and registers an upload. Indexing happens separately in `processFile`. */
export async function uploadFile(userId: string, input: { name: string; mime: string; bytes: Buffer }): Promise<FileRecord> {
  const name = safeFileName(input.name);
  const kind = kindForName(name);
  if (!kind) throw new UploadError("That file type is not supported. Use PDF, DOCX, TXT, CSV, XLS, XLSX or an image.");
  if (input.bytes.length === 0) throw new UploadError("That file is empty.");
  if (input.bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("Files must be 20 MB or smaller.");
  if (!sniff(kind, input.bytes)) throw new UploadError("That file does not look like what its name says it is.");

  const mime = mimeFor(kind, input.mime);
  const storageId = await storeBlob(input.bytes, { filename: name, contentType: mime });
  return createFile(userId, { name, mime, size: input.bytes.length, kind, storageId });
}

/** Extracts and indexes a stored file. Safe to call again: it replaces earlier chunks. */
export async function processFile(userId: string, fileId: string): Promise<void> {
  const file = await getFile(userId, fileId);
  if (!file || file.kind === "image") return;
  try {
    const bytes = await readBlob(new (await import("mongoose")).Types.ObjectId(file.storageId));
    const extraction = await extractFile(file.kind, bytes);
    const chunkCount = await indexSegments({ userId, fileId: file.id, sourceName: file.name }, extraction.segments);
    await updateFileIndex(userId, file.id, {
      status: "indexed",
      pages: extraction.pages,
      sheets: extraction.sheets,
      chunkCount,
      preview: extraction.preview,
      error: null,
    });
  } catch (error) {
    console.error("[files] indexing failed", file.name, error instanceof Error ? error.message : error);
    await updateFileIndex(userId, file.id, { status: "failed", error: "We could not read this file. It may be encrypted or damaged." });
  }
}

export async function deleteFile(userId: string, fileId: string): Promise<boolean> {
  const record = await deleteFileRecord(userId, fileId);
  if (!record) return false;
  await deleteChunksForFile(userId, fileId);
  const { Types } = await import("mongoose");
  await deleteBlob(new Types.ObjectId(record.storageId)).catch((error: unknown) => {
    console.warn("[files] blob delete failed", error instanceof Error ? error.message : error);
  });
  return true;
}
