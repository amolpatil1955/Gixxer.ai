import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { FileModel, type FileKind, type FileStatus } from "@/lib/db/models/workspace.models";

export interface FileRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: FileKind;
  storageId: string;
  status: FileStatus;
  pages: number | null;
  sheets: string[];
  chunkCount: number;
  preview: string;
  error: string | null;
  createdAt: Date;
}

type LeanFile = {
  _id: Types.ObjectId;
  name: string;
  mime: string;
  size: number;
  kind: FileKind;
  storageId: Types.ObjectId;
  status: FileStatus;
  pages?: number | null;
  sheets?: string[];
  chunkCount?: number;
  preview?: string;
  error?: string | null;
  createdAt?: Date;
};

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(doc: LeanFile): FileRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    mime: doc.mime,
    size: doc.size,
    kind: doc.kind,
    storageId: doc.storageId.toString(),
    status: doc.status,
    pages: doc.pages ?? null,
    sheets: doc.sheets ?? [],
    chunkCount: doc.chunkCount ?? 0,
    preview: doc.preview ?? "",
    error: doc.error ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export async function listFiles(userId: string, limit = 100): Promise<FileRecord[]> {
  await connectToDatabase();
  const docs = await FileModel.find({ userId: oid(userId) }).sort({ createdAt: -1 }).limit(limit).lean<LeanFile[]>().exec();
  return docs.map(toRecord);
}

export async function getFile(userId: string, fileId: string): Promise<FileRecord | null> {
  if (!Types.ObjectId.isValid(fileId)) return null;
  await connectToDatabase();
  const doc = await FileModel.findOne({ _id: oid(fileId), userId: oid(userId) }).lean<LeanFile>().exec();
  return doc ? toRecord(doc) : null;
}

export async function getFilesByIds(userId: string, fileIds: string[]): Promise<FileRecord[]> {
  const valid = fileIds.filter((id) => Types.ObjectId.isValid(id));
  if (valid.length === 0) return [];
  await connectToDatabase();
  const docs = await FileModel.find({ _id: { $in: valid.map(oid) }, userId: oid(userId) }).lean<LeanFile[]>().exec();
  return docs.map(toRecord);
}

export interface CreateFileInput {
  name: string;
  mime: string;
  size: number;
  kind: FileKind;
  storageId: Types.ObjectId;
}

export async function createFile(userId: string, input: CreateFileInput): Promise<FileRecord> {
  await connectToDatabase();
  const doc = await FileModel.create({ ...input, userId: oid(userId), status: input.kind === "image" ? "indexed" : "indexing" });
  return toRecord(doc.toObject() as LeanFile);
}

export interface FileIndexResult {
  status: FileStatus;
  pages?: number | null;
  sheets?: string[];
  chunkCount?: number;
  preview?: string;
  error?: string | null;
}

export async function updateFileIndex(userId: string, fileId: string, result: FileIndexResult): Promise<void> {
  await connectToDatabase();
  await FileModel.updateOne({ _id: oid(fileId), userId: oid(userId) }, { $set: { ...result } }).exec();
}

export async function deleteFileRecord(userId: string, fileId: string): Promise<FileRecord | null> {
  await connectToDatabase();
  const doc = await FileModel.findOneAndDelete({ _id: oid(fileId), userId: oid(userId) }).lean<LeanFile>().exec();
  return doc ? toRecord(doc) : null;
}
