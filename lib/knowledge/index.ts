import "server-only";
import { Types } from "mongoose";
import { embedTexts } from "@/lib/ai/manager";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ChunkModel } from "@/lib/db/models/workspace.models";
import type { Segment } from "./chunk";
import { rankChunks, type Candidate, type Ranked } from "./retrieve";

export interface IndexTarget {
  userId: string;
  sourceName: string;
  fileId?: string;
  botId?: string;
  sourceId?: string;
}

/** Replaces the chunks for a file or a bot source and returns how many were written. */
export async function indexSegments(target: IndexTarget, segments: Segment[]): Promise<number> {
  await connectToDatabase();
  const owner = { userId: new Types.ObjectId(target.userId) };
  const scope = target.sourceId
    ? { ...owner, sourceId: new Types.ObjectId(target.sourceId) }
    : target.fileId
      ? { ...owner, fileId: new Types.ObjectId(target.fileId), botId: null }
      : null;
  if (!scope) throw new Error("indexSegments needs a fileId or a sourceId");
  await ChunkModel.deleteMany(scope);
  if (segments.length === 0) return 0;

  const embeddings = await embedTexts(segments.map((segment) => segment.text));
  await ChunkModel.insertMany(
    segments.map((segment, index) => ({
      userId: owner.userId,
      fileId: target.fileId ? new Types.ObjectId(target.fileId) : null,
      botId: target.botId ? new Types.ObjectId(target.botId) : null,
      sourceId: target.sourceId ? new Types.ObjectId(target.sourceId) : null,
      sourceName: target.sourceName,
      index,
      text: segment.text,
      locator: segment.locator,
      ...(embeddings ? { embedding: embeddings[index] } : {}),
    })),
    { ordered: true },
  );
  return segments.length;
}

export async function deleteChunksForFile(userId: string, fileId: string): Promise<void> {
  await connectToDatabase();
  await ChunkModel.deleteMany({ userId: new Types.ObjectId(userId), fileId: new Types.ObjectId(fileId) });
}

export async function deleteChunksForSource(userId: string, sourceId: string): Promise<void> {
  await connectToDatabase();
  await ChunkModel.deleteMany({ userId: new Types.ObjectId(userId), sourceId: new Types.ObjectId(sourceId) });
}

export async function deleteChunksForBot(userId: string, botId: string): Promise<void> {
  await connectToDatabase();
  await ChunkModel.deleteMany({ userId: new Types.ObjectId(userId), botId: new Types.ObjectId(botId) });
}

/** Which chunks to search: some files, every file in the library, or one bot's knowledge. */
export type RetrievalScope = { fileIds: string[] } | { allFiles: true } | { botId: string };

const MAX_CANDIDATES = 1500;

/**
 * The retrieval step: load the caller's chunks for the scope, embed the
 * question when possible, rank, and return the best few. Ownership is part
 * of the query, never a later check.
 */
export async function retrieveChunks(userId: string, scope: RetrievalScope, question: string, k = 6): Promise<Ranked[]> {
  await connectToDatabase();
  const owner = new Types.ObjectId(userId);
  const filter =
    "botId" in scope
      ? { userId: owner, botId: new Types.ObjectId(scope.botId) }
      : "allFiles" in scope
        ? { userId: owner, fileId: { $ne: null }, botId: null }
        : { userId: owner, fileId: { $in: scope.fileIds.map((id) => new Types.ObjectId(id)) }, botId: null };
  if ("fileIds" in scope && scope.fileIds.length === 0) return [];

  const docs = await ChunkModel.find(filter).limit(MAX_CANDIDATES).lean().exec();
  if (docs.length === 0) return [];
  const candidates: Candidate[] = docs.map((doc) => ({
    id: doc._id.toString(),
    text: doc.text,
    locator: doc.locator,
    sourceName: doc.sourceName,
    fileId: doc.fileId ? doc.fileId.toString() : null,
    embedding: doc.embedding,
  }));
  const hasEmbeddings = candidates.some((candidate) => candidate.embedding && candidate.embedding.length > 0);
  const queryEmbedding = hasEmbeddings ? ((await embedTexts([question]))?.[0] ?? null) : null;
  return rankChunks(question, queryEmbedding, candidates, k);
}
