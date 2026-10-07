import "server-only";
import { Types } from "mongoose";
import { ImpersonationModel } from "@/lib/db/models/admin.models";
import { UserModel, type AuthProvider, type UserRole } from "@/lib/db/models/user.model";
import { BotModel, ConversationModel, FileModel, ImageModel, MessageModel, ScheduleModel } from "@/lib/db/models/workspace.models";
import { connectToDatabase } from "@/lib/db/mongoose";

/*
 * Reads for the admin area: who is registered, what one account has been doing,
 * and the record of every time an admin signed in as someone. Counts and
 * timestamps only; this module never returns the contents of a chat or a file,
 * which an admin sees only by signing in as the account, where it is audited.
 */

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  image: string | null;
  provider: AuthProvider;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AdminUserActivity {
  conversations: number;
  messages: number;
  files: number;
  images: number;
  bots: number;
  schedules: number;
  /** The most recent things they did, newest first. Titles and names only. */
  recent: { kind: "chat" | "file" | "image" | "bot" | "schedule"; label: string; at: Date }[];
  lastActiveAt: Date | null;
}

export interface ImpersonationRecord {
  id: string;
  actorEmail: string;
  targetId: string;
  targetEmail: string;
  reason: string;
  startedAt: Date;
  endedAt: Date | null;
  endedBy: string | null;
}

type LeanUser = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  image?: string | null;
  provider: AuthProvider;
  role?: UserRole;
  createdAt?: Date;
  lastLoginAt?: Date | null;
};

function toSummary(doc: LeanUser): AdminUserSummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    image: doc.image ?? null,
    provider: doc.provider,
    role: doc.role ?? "user",
    createdAt: doc.createdAt ?? new Date(0),
    lastLoginAt: doc.lastLoginAt ?? null,
  };
}

/** Registered accounts, newest first, optionally narrowed by name or email. */
export async function listUsers(query: string, limit = 100): Promise<AdminUserSummary[]> {
  await connectToDatabase();
  const trimmed = query.trim();
  // Escaped, so what someone types is matched literally and never as a pattern.
  const filter = trimmed
    ? { $or: [{ email: new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { name: new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] }
    : {};
  const docs = await UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean<LeanUser[]>().exec();
  return docs.map(toSummary);
}

export async function countUsers(): Promise<number> {
  await connectToDatabase();
  return UserModel.countDocuments({}).exec();
}

export async function getUserSummary(id: string): Promise<AdminUserSummary | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  const doc = await UserModel.findById(id).lean<LeanUser>().exec();
  return doc ? toSummary(doc) : null;
}

/** What one account has been doing: how much of each thing, and the latest few by name. */
export async function getUserActivity(id: string): Promise<AdminUserActivity> {
  await connectToDatabase();
  const userId = new Types.ObjectId(id);
  const [conversations, messages, files, images, bots, schedules, chats, recentFiles, recentImages, recentBots, recentSchedules] = await Promise.all([
    ConversationModel.countDocuments({ userId }).exec(),
    MessageModel.countDocuments({ userId }).exec(),
    FileModel.countDocuments({ userId }).exec(),
    ImageModel.countDocuments({ userId }).exec(),
    BotModel.countDocuments({ userId }).exec(),
    ScheduleModel.countDocuments({ userId }).exec(),
    ConversationModel.find({ userId }).sort({ lastMessageAt: -1 }).limit(8).select("title lastMessageAt").lean<{ title: string; lastMessageAt?: Date }[]>().exec(),
    FileModel.find({ userId }).sort({ createdAt: -1 }).limit(5).select("name createdAt").lean<{ name: string; createdAt?: Date }[]>().exec(),
    ImageModel.find({ userId }).sort({ createdAt: -1 }).limit(5).select("prompt createdAt").lean<{ prompt: string; createdAt?: Date }[]>().exec(),
    BotModel.find({ userId }).sort({ createdAt: -1 }).limit(5).select("name createdAt").lean<{ name: string; createdAt?: Date }[]>().exec(),
    ScheduleModel.find({ userId }).sort({ createdAt: -1 }).limit(5).select("name createdAt").lean<{ name: string; createdAt?: Date }[]>().exec(),
  ]);

  const recent: AdminUserActivity["recent"] = [
    ...chats.map((item) => ({ kind: "chat" as const, label: item.title, at: item.lastMessageAt ?? new Date(0) })),
    ...recentFiles.map((item) => ({ kind: "file" as const, label: item.name, at: item.createdAt ?? new Date(0) })),
    ...recentImages.map((item) => ({ kind: "image" as const, label: item.prompt.slice(0, 80), at: item.createdAt ?? new Date(0) })),
    ...recentBots.map((item) => ({ kind: "bot" as const, label: item.name, at: item.createdAt ?? new Date(0) })),
    ...recentSchedules.map((item) => ({ kind: "schedule" as const, label: item.name, at: item.createdAt ?? new Date(0) })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return { conversations, messages, files, images, bots, schedules, recent, lastActiveAt: recent[0]?.at ?? null };
}

/* ------------------------------------------------------------------ */
/* The audit trail                                                     */
/* ------------------------------------------------------------------ */

export async function openImpersonationRecord(input: {
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetEmail: string;
  reason: string;
  ip: string | null;
}): Promise<string> {
  await connectToDatabase();
  const doc = await ImpersonationModel.create({
    actorId: new Types.ObjectId(input.actorId),
    actorEmail: input.actorEmail,
    targetId: new Types.ObjectId(input.targetId),
    targetEmail: input.targetEmail,
    reason: input.reason,
    ip: input.ip,
    startedAt: new Date(),
  });
  return doc._id.toString();
}

export async function closeImpersonationRecord(recordId: string, endedBy: "admin" | "expired" | "revoked"): Promise<void> {
  if (!Types.ObjectId.isValid(recordId)) return;
  await connectToDatabase();
  await ImpersonationModel.updateOne({ _id: new Types.ObjectId(recordId), endedAt: null }, { $set: { endedAt: new Date(), endedBy } }).exec();
}

function toRecord(doc: {
  _id: Types.ObjectId;
  actorEmail: string;
  targetId: Types.ObjectId;
  targetEmail: string;
  reason?: string;
  startedAt: Date;
  endedAt?: Date | null;
  endedBy?: string | null;
}): ImpersonationRecord {
  return {
    id: doc._id.toString(),
    actorEmail: doc.actorEmail,
    targetId: doc.targetId.toString(),
    targetEmail: doc.targetEmail,
    reason: doc.reason ?? "",
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    endedBy: doc.endedBy ?? null,
  };
}

/** Every sitting, newest first. Optionally only those that entered one account. */
export async function listImpersonations(options: { targetId?: string; limit?: number } = {}): Promise<ImpersonationRecord[]> {
  await connectToDatabase();
  const filter = options.targetId && Types.ObjectId.isValid(options.targetId) ? { targetId: new Types.ObjectId(options.targetId) } : {};
  const docs = await ImpersonationModel.find(filter).sort({ startedAt: -1 }).limit(options.limit ?? 50).lean().exec();
  return docs.map((doc) => toRecord(doc as Parameters<typeof toRecord>[0]));
}
