import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { FileModel, type FileKind, type FileScope, type FileStatus } from "@/lib/db/models/workspace.models";

export interface FileRecord {
  id: string;
  scope: FileScope;
  conversationId: string | null;
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
  scope?: FileScope;
  conversationId?: Types.ObjectId | null;
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
    scope: doc.scope ?? "library",
    conversationId: doc.conversationId ? doc.conversationId.toString() : null,
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

/** Files in the given scopes, newest first. Files saved before scopes existed count as library files. */
export async function listFiles(userId: string, options: { scopes?: FileScope[]; limit?: number } = {}): Promise<FileRecord[]> {
  await connectToDatabase();
  const scopes = options.scopes ?? ["library", "chat"];
  const scopeFilter = scopes.includes("library") ? { $or: [{ scope: { $in: scopes } }, { scope: { $exists: false } }] } : { scope: { $in: scopes } };
  const docs = await FileModel.find({ userId: oid(userId), ...scopeFilter })
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 100)
    .lean<LeanFile[]>()
    .exec();
  return docs.map(toRecord);
}

/** Binds chat files that are not yet bound to a conversation. Library files are left alone. */
export async function claimChatFiles(userId: string, conversationId: string, fileIds: string[]): Promise<void> {
  const valid = fileIds.filter((id) => Types.ObjectId.isValid(id));
  if (valid.length === 0) return;
  await connectToDatabase();
  await FileModel.updateMany(
    { _id: { $in: valid.map(oid) }, userId: oid(userId), scope: "chat", conversationId: null },
    { $set: { conversationId: oid(conversationId) } },
  ).exec();
}

/** The chat files of one conversation, for clean-up when the conversation is deleted. */
export async function listConversationFiles(userId: string, conversationId: string): Promise<FileRecord[]> {
  if (!Types.ObjectId.isValid(conversationId)) return [];
  await connectToDatabase();
  const docs = await FileModel.find({ userId: oid(userId), scope: "chat", conversationId: oid(conversationId) }).lean<LeanFile[]>().exec();
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
  scope?: FileScope;
  conversationId?: string | null;
}

export async function createFile(userId: string, input: CreateFileInput): Promise<FileRecord> {
  await connectToDatabase();
  const scope = input.scope ?? "library";
  // A chatbot's upload is read by the bot's own source pipeline, so the file itself is never indexed.
  const status: FileStatus = input.kind === "image" ? "indexed" : scope === "bot" ? "uploaded" : "indexing";
  const doc = await FileModel.create({
    name: input.name,
    mime: input.mime,
    size: input.size,
    kind: input.kind,
    storageId: input.storageId,
    scope,
    conversationId: input.conversationId ? oid(input.conversationId) : null,
    userId: oid(userId),
    status,
  });
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
