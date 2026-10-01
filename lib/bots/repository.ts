import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  BotConversationModel,
  BotModel,
  BotSourceModel,
  LeadModel,
  type BotStatus,
  type SourceType,
} from "@/lib/db/models/workspace.models";
import type { BotTone, WidgetPosition } from "./constants";

export interface BotRecord {
  id: string;
  name: string;
  publicKey: string;
  status: BotStatus;
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  businessInfo: string;
  instructions: string;
  tone: BotTone;
  suggestedQuestions: string[];
  theme: { accent: string; position: WidgetPosition };
  behavior: { collectLeads: boolean; citeSources: boolean; knowledgeOnly: boolean };
  allowedOrigins: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** What the public widget is allowed to know. No owner, no instructions, no sources. */
export interface PublicBotConfig {
  key: string;
  name: string;
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  suggestedQuestions: string[];
  theme: { accent: string; position: WidgetPosition };
  collectLeads: boolean;
}

export interface SourceRecord {
  id: string;
  type: SourceType;
  name: string;
  fileId: string | null;
  url: string | null;
  status: "indexing" | "indexed" | "failed";
  chunkCount: number;
  error: string | null;
  createdAt: Date;
}

export interface BotMessage {
  role: "user" | "assistant";
  content: string;
  sources: string[];
  createdAt: Date;
}

export interface BotConversationRecord {
  id: string;
  sessionId: string;
  messages: BotMessage[];
  origin: string | null;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface LeadRecord {
  id: string;
  name: string;
  email: string;
  message: string;
  conversationId: string;
  createdAt: Date;
}

const oid = (id: string) => new Types.ObjectId(id);

type LeanBot = {
  _id: Types.ObjectId;
  name: string;
  publicKey: string;
  status: BotStatus;
  avatarLetter?: string;
  welcomeMessage?: string;
  businessName?: string;
  businessInfo?: string;
  instructions?: string;
  tone?: BotTone;
  suggestedQuestions?: string[];
  theme?: { accent?: string; position?: WidgetPosition };
  behavior?: { collectLeads?: boolean; citeSources?: boolean; knowledgeOnly?: boolean };
  allowedOrigins?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  userId: Types.ObjectId;
};

function toBot(doc: LeanBot): BotRecord {
  const name = doc.name;
  return {
    id: doc._id.toString(),
    name,
    publicKey: doc.publicKey,
    status: doc.status,
    avatarLetter: doc.avatarLetter || name.slice(0, 1).toUpperCase(),
    welcomeMessage: doc.welcomeMessage ?? "Hi! How can I help?",
    businessName: doc.businessName ?? "",
    businessInfo: doc.businessInfo ?? "",
    instructions: doc.instructions ?? "",
    tone: doc.tone ?? "friendly",
    suggestedQuestions: doc.suggestedQuestions ?? [],
    theme: { accent: doc.theme?.accent ?? "#030000", position: doc.theme?.position ?? "right" },
    behavior: {
      collectLeads: doc.behavior?.collectLeads ?? true,
      citeSources: doc.behavior?.citeSources ?? true,
      knowledgeOnly: doc.behavior?.knowledgeOnly ?? true,
    },
    allowedOrigins: doc.allowedOrigins ?? [],
    createdAt: doc.createdAt ?? new Date(0),
    updatedAt: doc.updatedAt ?? new Date(0),
  };
}

export function toPublicConfig(bot: BotRecord): PublicBotConfig {
  return {
    key: bot.publicKey,
    name: bot.name,
    avatarLetter: bot.avatarLetter,
    welcomeMessage: bot.welcomeMessage,
    businessName: bot.businessName,
    suggestedQuestions: bot.suggestedQuestions,
    theme: bot.theme,
    collectLeads: bot.behavior.collectLeads,
  };
}

/* ------------------------------------------------------------------ */
/* Bots                                                                */
/* ------------------------------------------------------------------ */

export async function listBots(userId: string): Promise<BotRecord[]> {
  await connectToDatabase();
  const docs = await BotModel.find({ userId: oid(userId) }).sort({ createdAt: -1 }).lean<LeanBot[]>().exec();
  return docs.map(toBot);
}

export async function getBot(userId: string, botId: string): Promise<BotRecord | null> {
  if (!Types.ObjectId.isValid(botId)) return null;
  await connectToDatabase();
  const doc = await BotModel.findOne({ _id: oid(botId), userId: oid(userId) }).lean<LeanBot>().exec();
  return doc ? toBot(doc) : null;
}

/** For public traffic: looked up by key, and only when live. Returns the owner id for scoping the answer. */
export async function getLiveBotByKey(key: string): Promise<{ bot: BotRecord; ownerId: string } | null> {
  if (!/^gx_[A-Za-z0-9_-]{16,32}$/.test(key)) return null;
  await connectToDatabase();
  const doc = await BotModel.findOne({ publicKey: key, status: "live" }).lean<LeanBot>().exec();
  return doc ? { bot: toBot(doc), ownerId: doc.userId.toString() } : null;
}

export async function createBot(userId: string, name: string): Promise<BotRecord> {
  await connectToDatabase();
  const doc = await BotModel.create({
    userId: oid(userId),
    name,
    publicKey: `gx_${randomBytes(12).toString("base64url")}`,
    avatarLetter: name.slice(0, 1).toUpperCase(),
    suggestedQuestions: ["What do you offer?", "How can I contact you?"],
  });
  return toBot(doc.toObject() as LeanBot);
}

export async function updateBot(userId: string, botId: string, patch: Record<string, unknown>): Promise<boolean> {
  await connectToDatabase();
  const result = await BotModel.updateOne({ _id: oid(botId), userId: oid(userId) }, { $set: patch }).exec();
  return result.matchedCount === 1;
}

export async function deleteBotRecord(userId: string, botId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await BotModel.deleteOne({ _id: oid(botId), userId: oid(userId) }).exec();
  if (result.deletedCount !== 1) return false;
  await Promise.all([
    BotSourceModel.deleteMany({ botId: oid(botId), userId: oid(userId) }).exec(),
    BotConversationModel.deleteMany({ botId: oid(botId), userId: oid(userId) }).exec(),
    LeadModel.deleteMany({ botId: oid(botId), userId: oid(userId) }).exec(),
  ]);
  return true;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

type LeanSource = {
  _id: Types.ObjectId;
  type: SourceType;
  name: string;
  fileId?: Types.ObjectId | null;
  url?: string | null;
  status: "indexing" | "indexed" | "failed";
  chunkCount?: number;
  error?: string | null;
  createdAt?: Date;
};

function toSource(doc: LeanSource): SourceRecord {
  return {
    id: doc._id.toString(),
    type: doc.type,
    name: doc.name,
    fileId: doc.fileId ? doc.fileId.toString() : null,
    url: doc.url ?? null,
    status: doc.status,
    chunkCount: doc.chunkCount ?? 0,
    error: doc.error ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export async function listSources(userId: string, botId: string): Promise<SourceRecord[]> {
  await connectToDatabase();
  const docs = await BotSourceModel.find({ botId: oid(botId), userId: oid(userId) }).sort({ createdAt: -1 }).lean<LeanSource[]>().exec();
  return docs.map(toSource);
}

export async function createSource(
  userId: string,
  botId: string,
  input: { type: SourceType; name: string; fileId?: string; url?: string },
): Promise<SourceRecord> {
  await connectToDatabase();
  const doc = await BotSourceModel.create({
    botId: oid(botId),
    userId: oid(userId),
    type: input.type,
    name: input.name,
    fileId: input.fileId ? oid(input.fileId) : null,
    url: input.url ?? null,
  });
  return toSource(doc.toObject() as LeanSource);
}

export async function updateSource(
  userId: string,
  sourceId: string,
  patch: { status: "indexing" | "indexed" | "failed"; chunkCount?: number; error?: string | null },
): Promise<void> {
  await connectToDatabase();
  await BotSourceModel.updateOne({ _id: oid(sourceId), userId: oid(userId) }, { $set: patch }).exec();
}

export async function deleteSourceRecord(userId: string, botId: string, sourceId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await BotSourceModel.deleteOne({ _id: oid(sourceId), botId: oid(botId), userId: oid(userId) }).exec();
  return result.deletedCount === 1;
}

/* ------------------------------------------------------------------ */
/* Conversations, leads, analytics                                     */
/* ------------------------------------------------------------------ */

type LeanBotConversation = {
  _id: Types.ObjectId;
  sessionId: string;
  messages?: { role: "user" | "assistant"; content: string; sources?: string[]; createdAt?: Date }[];
  origin?: string | null;
  lastMessageAt?: Date;
  createdAt?: Date;
};

function toConversation(doc: LeanBotConversation): BotConversationRecord {
  return {
    id: doc._id.toString(),
    sessionId: doc.sessionId,
    messages: (doc.messages ?? []).map((message) => ({
      role: message.role,
      content: message.content,
      sources: message.sources ?? [],
      createdAt: message.createdAt ?? new Date(0),
    })),
    origin: doc.origin ?? null,
    lastMessageAt: doc.lastMessageAt ?? doc.createdAt ?? new Date(0),
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export async function listBotConversations(userId: string, botId: string, limit = 50): Promise<BotConversationRecord[]> {
  await connectToDatabase();
  const docs = await BotConversationModel.find({ botId: oid(botId), userId: oid(userId) })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean<LeanBotConversation[]>()
    .exec();
  return docs.map(toConversation);
}

/** The visitor's conversation for this session, created on first contact. */
export async function getOrCreateVisitorConversation(
  ownerId: string,
  botId: string,
  sessionId: string,
  origin: string | null,
): Promise<BotConversationRecord> {
  await connectToDatabase();
  const doc = await BotConversationModel.findOneAndUpdate(
    { botId: oid(botId), sessionId },
    { $setOnInsert: { botId: oid(botId), userId: oid(ownerId), sessionId, origin, messages: [] } },
    { upsert: true, new: true },
  )
    .lean<LeanBotConversation>()
    .exec();
  if (!doc) throw new Error("Could not open the visitor conversation");
  return toConversation(doc);
}

const MAX_STORED_MESSAGES = 80;

export async function appendVisitorMessages(conversationId: string, messages: BotMessage[]): Promise<void> {
  await connectToDatabase();
  await BotConversationModel.updateOne(
    { _id: oid(conversationId) },
    { $push: { messages: { $each: messages, $slice: -MAX_STORED_MESSAGES } }, $set: { lastMessageAt: new Date() } },
  ).exec();
}

export async function createLead(
  ownerId: string,
  botId: string,
  conversationId: string,
  input: { name: string; email: string; message: string },
): Promise<void> {
  await connectToDatabase();
  await LeadModel.create({ botId: oid(botId), userId: oid(ownerId), conversationId: oid(conversationId), ...input });
}

export async function listLeads(userId: string, botId: string, limit = 100): Promise<LeadRecord[]> {
  await connectToDatabase();
  const docs = await LeadModel.find({ botId: oid(botId), userId: oid(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<{ _id: Types.ObjectId; name?: string; email: string; message?: string; conversationId: Types.ObjectId; createdAt?: Date }[]>()
    .exec();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name ?? "",
    email: doc.email,
    message: doc.message ?? "",
    conversationId: doc.conversationId.toString(),
    createdAt: doc.createdAt ?? new Date(0),
  }));
}

export interface BotAnalytics {
  conversations: number;
  messages: number;
  leads: number;
  /** Conversations started per day for the last 14 days, oldest first. */
  perDay: { day: string; count: number }[];
  topSources: { name: string; count: number }[];
}

export async function botAnalytics(userId: string, botId: string): Promise<BotAnalytics> {
  await connectToDatabase();
  const scope = { botId: oid(botId), userId: oid(userId) };
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [conversations, leads, recent, cited] = await Promise.all([
    BotConversationModel.countDocuments(scope).exec(),
    LeadModel.countDocuments(scope).exec(),
    BotConversationModel.find({ ...scope, createdAt: { $gte: since } }).select("createdAt messages").lean<{ createdAt?: Date; messages?: unknown[] }[]>().exec(),
    BotConversationModel.aggregate<{ _id: string; count: number }>([
      { $match: scope },
      { $unwind: "$messages" },
      { $unwind: "$messages.sources" },
      { $group: { _id: "$messages.sources", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).exec(),
  ]);

  const days: { day: string; count: number }[] = [];
  for (let offset = 13; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    days.push({ day: date.toISOString().slice(0, 10), count: 0 });
  }
  let messages = 0;
  for (const conversation of recent) {
    messages += conversation.messages?.length ?? 0;
    const key = (conversation.createdAt ?? new Date()).toISOString().slice(0, 10);
    const entry = days.find((day) => day.day === key);
    if (entry) entry.count += 1;
  }
  return {
    conversations,
    messages,
    leads,
    perDay: days,
    topSources: cited.map((item) => ({ name: item._id, count: item.count })),
  };
}
