import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  ConversationModel,
  MessageModel,
  type MessageFeedback,
  type MessageRole,
  type MessageStatus,
} from "@/lib/db/models/workspace.models";

/*
 * Every function takes the owner's id and puts it in the query. A conversation
 * that belongs to someone else is indistinguishable from one that does not
 * exist, which is exactly the property the tenant boundary needs.
 */

export interface ConversationRecord {
  id: string;
  title: string;
  activeLeafId: string | null;
  pinned: boolean;
  projectId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface Citation {
  fileId: string;
  fileName: string;
  locator: string;
}

export interface Artifact {
  kind: "image" | "file";
  refId: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  prompt: string;
  preview: string;
}

export interface Attachment {
  fileId: string;
  name: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  parentId: string | null;
  status: MessageStatus;
  provider: string | null;
  reasoning: string;
  feedback: MessageFeedback | null;
  attachments: Attachment[];
  citations: Citation[];
  artifacts: Artifact[];
  errorMessage: string | null;
  createdAt: Date;
}

/** A message on the visible path plus where it sits among its siblings. */
export interface ThreadMessage extends MessageRecord {
  siblingIndex: number;
  siblingCount: number;
  siblingIds: string[];
}

const oid = (id: string) => new Types.ObjectId(id);

type LeanConversation = {
  _id: Types.ObjectId;
  title: string;
  activeLeafId?: Types.ObjectId | null;
  pinned?: boolean;
  projectId?: Types.ObjectId | null;
  lastMessageAt?: Date;
  createdAt?: Date;
};

type LeanMessage = {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  role: MessageRole;
  content: string;
  parentId?: Types.ObjectId | null;
  status: MessageStatus;
  provider?: string | null;
  reasoning?: string;
  feedback?: MessageFeedback | null;
  attachments?: { fileId: Types.ObjectId; name: string }[];
  citations?: { fileId: Types.ObjectId; fileName: string; locator: string }[];
  artifacts?: (Omit<Artifact, "refId"> & { refId: Types.ObjectId })[];
  errorMessage?: string | null;
  createdAt?: Date;
};

function toConversation(doc: LeanConversation): ConversationRecord {
  return {
    id: doc._id.toString(),
    title: doc.title,
    activeLeafId: doc.activeLeafId ? doc.activeLeafId.toString() : null,
    pinned: doc.pinned ?? false,
    projectId: doc.projectId ? doc.projectId.toString() : null,
    lastMessageAt: doc.lastMessageAt ?? doc.createdAt ?? new Date(0),
    createdAt: doc.createdAt ?? new Date(0),
  };
}

function toMessage(doc: LeanMessage): MessageRecord {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    role: doc.role,
    content: doc.content,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    status: doc.status,
    provider: doc.provider ?? null,
    reasoning: doc.reasoning ?? "",
    feedback: doc.feedback ?? null,
    attachments: (doc.attachments ?? []).map((item) => ({ fileId: item.fileId.toString(), name: item.name })),
    citations: (doc.citations ?? []).map((item) => ({ fileId: item.fileId.toString(), fileName: item.fileName, locator: item.locator })),
    artifacts: (doc.artifacts ?? []).map((item) => ({ ...item, refId: item.refId.toString() })),
    errorMessage: doc.errorMessage ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

/** Pinned first, then by recency. */
export async function listConversations(userId: string, limit = 80): Promise<ConversationRecord[]> {
  await connectToDatabase();
  const docs = await ConversationModel.find({ userId: oid(userId) }).sort({ pinned: -1, lastMessageAt: -1 }).limit(limit).lean<LeanConversation[]>().exec();
  return docs.map(toConversation);
}

export async function listProjectConversations(userId: string, projectId: string, limit = 100): Promise<ConversationRecord[]> {
  if (!Types.ObjectId.isValid(projectId)) return [];
  await connectToDatabase();
  const docs = await ConversationModel.find({ userId: oid(userId), projectId: oid(projectId) }).sort({ lastMessageAt: -1 }).limit(limit).lean<LeanConversation[]>().exec();
  return docs.map(toConversation);
}

/** How many chats each project holds, for the projects table. */
export async function countConversationsByProject(userId: string): Promise<Map<string, number>> {
  await connectToDatabase();
  const rows = await ConversationModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
    { $match: { userId: oid(userId), projectId: { $ne: null } } },
    { $group: { _id: "$projectId", count: { $sum: 1 } } },
  ]).exec();
  return new Map(rows.filter((row) => row._id).map((row) => [row._id!.toString(), row.count]));
}

export async function searchConversations(userId: string, query: string, limit = 40): Promise<ConversationRecord[]> {
  await connectToDatabase();
  const owner = oid(userId);
  const trimmed = query.trim();
  if (!trimmed) return listConversations(userId, limit);
  // Titles first, then any message containing the words. Escaped so input is never a regex.
  const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const byTitle = await ConversationModel.find({ userId: owner, title: pattern }).sort({ lastMessageAt: -1 }).limit(limit).lean<LeanConversation[]>().exec();
  const seen = new Set(byTitle.map((doc) => doc._id.toString()));
  const hits = await MessageModel.find({ userId: owner, content: pattern }).sort({ createdAt: -1 }).limit(200).select("conversationId").lean<{ conversationId: Types.ObjectId }[]>().exec();
  const extraIds = [...new Set(hits.map((hit) => hit.conversationId.toString()))].filter((id) => !seen.has(id)).slice(0, limit);
  const extra = extraIds.length
    ? await ConversationModel.find({ userId: owner, _id: { $in: extraIds.map(oid) } }).sort({ lastMessageAt: -1 }).lean<LeanConversation[]>().exec()
    : [];
  return [...byTitle, ...extra].slice(0, limit).map(toConversation);
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationRecord | null> {
  if (!Types.ObjectId.isValid(conversationId)) return null;
  await connectToDatabase();
  const doc = await ConversationModel.findOne({ _id: oid(conversationId), userId: oid(userId) }).lean<LeanConversation>().exec();
  return doc ? toConversation(doc) : null;
}

export async function createConversation(userId: string, title: string, projectId: string | null = null): Promise<ConversationRecord> {
  await connectToDatabase();
  const doc = await ConversationModel.create({ userId: oid(userId), title, projectId: projectId ? oid(projectId) : null });
  return toConversation(doc.toObject() as LeanConversation);
}

export async function renameConversation(userId: string, conversationId: string, title: string): Promise<boolean> {
  await connectToDatabase();
  const result = await ConversationModel.updateOne({ _id: oid(conversationId), userId: oid(userId) }, { $set: { title } }).exec();
  return result.matchedCount === 1;
}

export async function setConversationPinned(userId: string, conversationId: string, pinned: boolean): Promise<boolean> {
  await connectToDatabase();
  const result = await ConversationModel.updateOne({ _id: oid(conversationId), userId: oid(userId) }, { $set: { pinned } }).exec();
  return result.matchedCount === 1;
}

export async function setConversationProject(userId: string, conversationId: string, projectId: string | null): Promise<boolean> {
  await connectToDatabase();
  const result = await ConversationModel.updateOne(
    { _id: oid(conversationId), userId: oid(userId) },
    { $set: { projectId: projectId ? oid(projectId) : null } },
  ).exec();
  return result.matchedCount === 1;
}

/** Chats of a deleted project become ordinary chats; nothing is lost. */
export async function detachConversationsFromProject(userId: string, projectId: string): Promise<void> {
  await connectToDatabase();
  await ConversationModel.updateMany({ userId: oid(userId), projectId: oid(projectId) }, { $set: { projectId: null } }).exec();
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await ConversationModel.deleteOne({ _id: oid(conversationId), userId: oid(userId) }).exec();
  if (result.deletedCount !== 1) return false;
  await MessageModel.deleteMany({ conversationId: oid(conversationId), userId: oid(userId) }).exec();
  return true;
}

/** Every chat and message the user owns. Returns how many chats went. */
export async function deleteAllConversations(userId: string): Promise<number> {
  await connectToDatabase();
  const owner = oid(userId);
  const result = await ConversationModel.deleteMany({ userId: owner }).exec();
  await MessageModel.deleteMany({ userId: owner }).exec();
  return result.deletedCount;
}

export async function countConversations(userId: string): Promise<number> {
  await connectToDatabase();
  return ConversationModel.countDocuments({ userId: oid(userId) }).exec();
}

export async function countMessages(userId: string): Promise<number> {
  await connectToDatabase();
  return MessageModel.countDocuments({ userId: oid(userId) }).exec();
}

export async function setActiveLeaf(userId: string, conversationId: string, leafId: string | null): Promise<void> {
  await connectToDatabase();
  await ConversationModel.updateOne(
    { _id: oid(conversationId), userId: oid(userId) },
    { $set: { activeLeafId: leafId ? oid(leafId) : null, lastMessageAt: new Date() } },
  ).exec();
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  parentId: string | null;
  status?: MessageStatus;
  provider?: string | null;
  attachments?: Attachment[];
}

export async function createMessage(userId: string, input: CreateMessageInput): Promise<MessageRecord> {
  await connectToDatabase();
  const doc = await MessageModel.create({
    conversationId: oid(input.conversationId),
    userId: oid(userId),
    role: input.role,
    content: input.content,
    parentId: input.parentId ? oid(input.parentId) : null,
    status: input.status ?? "complete",
    provider: input.provider ?? null,
    attachments: (input.attachments ?? []).map((item) => ({ fileId: oid(item.fileId), name: item.name })),
  });
  return toMessage(doc.toObject() as LeanMessage);
}

export async function getMessage(userId: string, messageId: string): Promise<MessageRecord | null> {
  if (!Types.ObjectId.isValid(messageId)) return null;
  await connectToDatabase();
  const doc = await MessageModel.findOne({ _id: oid(messageId), userId: oid(userId) }).lean<LeanMessage>().exec();
  return doc ? toMessage(doc) : null;
}

export interface FinishMessageInput {
  content: string;
  status: MessageStatus;
  provider: string | null;
  reasoning?: string;
  citations?: Citation[];
  artifacts?: Artifact[];
  errorMessage?: string | null;
}

export async function finishMessage(userId: string, messageId: string, input: FinishMessageInput): Promise<void> {
  await connectToDatabase();
  await MessageModel.updateOne(
    { _id: oid(messageId), userId: oid(userId) },
    {
      $set: {
        content: input.content,
        status: input.status,
        provider: input.provider,
        reasoning: (input.reasoning ?? "").slice(0, 60_000),
        citations: (input.citations ?? []).map((item) => ({ fileId: oid(item.fileId), fileName: item.fileName, locator: item.locator })),
        artifacts: (input.artifacts ?? []).map((item) => ({ ...item, refId: oid(item.refId) })),
        errorMessage: input.errorMessage ?? null,
      },
    },
  ).exec();
}

export async function setMessageFeedback(userId: string, messageId: string, feedback: MessageFeedback | null): Promise<boolean> {
  await connectToDatabase();
  const result = await MessageModel.updateOne({ _id: oid(messageId), userId: oid(userId), role: "assistant" }, { $set: { feedback } }).exec();
  return result.matchedCount === 1;
}

/** All messages of a conversation, oldest first. Small enough to load whole: a chat is hundreds of messages at most. */
export async function listMessages(userId: string, conversationId: string): Promise<MessageRecord[]> {
  await connectToDatabase();
  const docs = await MessageModel.find({ conversationId: oid(conversationId), userId: oid(userId) }).sort({ createdAt: 1 }).lean<LeanMessage[]>().exec();
  return docs.map(toMessage);
}

/** Every message the user owns, oldest first, for the data export. */
export async function listAllMessages(userId: string): Promise<MessageRecord[]> {
  await connectToDatabase();
  const docs = await MessageModel.find({ userId: oid(userId) }).sort({ createdAt: 1 }).lean<LeanMessage[]>().exec();
  return docs.map(toMessage);
}

/** The path from the root to `leafId`, oldest first, with sibling positions for branch navigation. */
export function threadFor(messages: MessageRecord[], leafId: string | null): ThreadMessage[] {
  if (messages.length === 0) return [];
  const byId = new Map(messages.map((message) => [message.id, message]));
  const childrenOf = new Map<string | null, MessageRecord[]>();
  for (const message of messages) {
    const list = childrenOf.get(message.parentId) ?? [];
    list.push(message);
    childrenOf.set(message.parentId, list);
  }
  let leaf = leafId && byId.has(leafId) ? byId.get(leafId)! : latestLeaf(messages, childrenOf, null);
  if (!leaf) return [];
  const path: MessageRecord[] = [];
  let current: MessageRecord | undefined = leaf;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  leaf = path[path.length - 1]!;
  return path.map((message) => {
    const siblings = childrenOf.get(message.parentId) ?? [message];
    return {
      ...message,
      siblingIndex: siblings.findIndex((sibling) => sibling.id === message.id),
      siblingCount: siblings.length,
      siblingIds: siblings.map((sibling) => sibling.id),
    };
  });
}

/** Follows the most recent child at each level from `startId` down to a leaf. */
export function latestLeaf(messages: MessageRecord[], childrenOf: Map<string | null, MessageRecord[]>, startId: string | null): MessageRecord | null {
  const byId = new Map(messages.map((message) => [message.id, message]));
  let current: MessageRecord | null = startId ? (byId.get(startId) ?? null) : null;
  let children = childrenOf.get(startId) ?? [];
  if (!current && children.length === 0) return null;
  while (children.length > 0) {
    current = children[children.length - 1]!;
    children = childrenOf.get(current.id) ?? [];
  }
  return current;
}

export function childrenIndex(messages: MessageRecord[]): Map<string | null, MessageRecord[]> {
  const childrenOf = new Map<string | null, MessageRecord[]>();
  for (const message of messages) {
    const list = childrenOf.get(message.parentId) ?? [];
    list.push(message);
    childrenOf.set(message.parentId, list);
  }
  return childrenOf;
}
