import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  BotModel,
  FileModel,
  ImageModel,
  ProjectModel,
  ScheduleModel,
  UserSettingsModel,
  type ResponseTone,
} from "@/lib/db/models/workspace.models";
import { isPluginId, type PluginId } from "@/lib/plugins/catalog";
import { countConversations, countMessages } from "@/lib/chat/repository";
import { DEFAULT_SETTINGS, type UsageDto, type UserSettingsDto } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

type LeanSettings = { tone?: ResponseTone; nickname?: string; customInstructions?: string; plugins?: string[] };

function toDto(doc: LeanSettings | null): UserSettingsDto {
  if (!doc) return DEFAULT_SETTINGS;
  return {
    tone: doc.tone ?? "default",
    nickname: doc.nickname ?? "",
    customInstructions: doc.customInstructions ?? "",
    plugins: (doc.plugins ?? []).filter(isPluginId) as PluginId[],
  };
}

/** The user's settings, or the defaults when they have never saved any. */
export async function getSettings(userId: string): Promise<UserSettingsDto> {
  await connectToDatabase();
  const doc = await UserSettingsModel.findOne({ userId: oid(userId) }).lean<LeanSettings>().exec();
  return toDto(doc);
}

export async function updateSettings(userId: string, patch: Partial<UserSettingsDto>): Promise<UserSettingsDto> {
  await connectToDatabase();
  const doc = await UserSettingsModel.findOneAndUpdate({ userId: oid(userId) }, { $set: patch, $setOnInsert: { userId: oid(userId) } }, { upsert: true, new: true })
    .lean<LeanSettings>()
    .exec();
  return toDto(doc);
}

/** Honest counts for the Usage section. */
export async function countUsage(userId: string): Promise<UsageDto> {
  await connectToDatabase();
  const owner = oid(userId);
  const [conversations, messages, files, images, bots, schedules, projects] = await Promise.all([
    countConversations(userId),
    countMessages(userId),
    FileModel.countDocuments({ userId: owner }).exec(),
    ImageModel.countDocuments({ userId: owner }).exec(),
    BotModel.countDocuments({ userId: owner }).exec(),
    ScheduleModel.countDocuments({ userId: owner }).exec(),
    ProjectModel.countDocuments({ userId: owner }).exec(),
  ]);
  return { conversations, messages, files, images, bots, schedules, projects };
}
