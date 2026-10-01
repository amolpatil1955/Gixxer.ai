import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ScheduleModel, type ScheduleCadence } from "@/lib/db/models/workspace.models";

export interface ScheduleRecord {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  cadence: ScheduleCadence;
  hour: number;
  minute: number;
  timeZone: string;
  active: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastConversationId: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: Date;
}

type LeanSchedule = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  prompt: string;
  cadence: ScheduleCadence;
  hour: number;
  minute: number;
  timeZone: string;
  active?: boolean;
  nextRunAt: Date;
  lastRunAt?: Date | null;
  lastConversationId?: Types.ObjectId | null;
  lastError?: string | null;
  runCount?: number;
  createdAt?: Date;
};

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(doc: LeanSchedule): ScheduleRecord {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    prompt: doc.prompt,
    cadence: doc.cadence,
    hour: doc.hour,
    minute: doc.minute,
    timeZone: doc.timeZone,
    active: doc.active ?? true,
    nextRunAt: doc.nextRunAt,
    lastRunAt: doc.lastRunAt ?? null,
    lastConversationId: doc.lastConversationId ? doc.lastConversationId.toString() : null,
    lastError: doc.lastError ?? null,
    runCount: doc.runCount ?? 0,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export async function listSchedules(userId: string, limit = 100): Promise<ScheduleRecord[]> {
  await connectToDatabase();
  const docs = await ScheduleModel.find({ userId: oid(userId) }).sort({ createdAt: -1 }).limit(limit).lean<LeanSchedule[]>().exec();
  return docs.map(toRecord);
}

export async function getSchedule(userId: string, scheduleId: string): Promise<ScheduleRecord | null> {
  if (!Types.ObjectId.isValid(scheduleId)) return null;
  await connectToDatabase();
  const doc = await ScheduleModel.findOne({ _id: oid(scheduleId), userId: oid(userId) }).lean<LeanSchedule>().exec();
  return doc ? toRecord(doc) : null;
}

export interface CreateScheduleRecordInput {
  name: string;
  prompt: string;
  cadence: ScheduleCadence;
  hour: number;
  minute: number;
  timeZone: string;
  nextRunAt: Date;
}

export async function createSchedule(userId: string, input: CreateScheduleRecordInput): Promise<ScheduleRecord> {
  await connectToDatabase();
  const doc = await ScheduleModel.create({ ...input, userId: oid(userId) });
  return toRecord(doc.toObject() as LeanSchedule);
}

export async function setScheduleActive(userId: string, scheduleId: string, active: boolean, nextRunAt?: Date): Promise<boolean> {
  await connectToDatabase();
  const result = await ScheduleModel.updateOne(
    { _id: oid(scheduleId), userId: oid(userId) },
    { $set: { active, ...(nextRunAt ? { nextRunAt } : {}) } },
  ).exec();
  return result.matchedCount === 1;
}

export async function deleteSchedule(userId: string, scheduleId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await ScheduleModel.deleteOne({ _id: oid(scheduleId), userId: oid(userId) }).exec();
  return result.deletedCount === 1;
}

/**
 * Claims one due schedule by moving its next run forward atomically, so two
 * runners can never take the same run. Returns the record as it was claimed.
 */
export async function claimDueSchedule(filter: { userId?: string; scheduleId?: string; force?: boolean }, now: Date, nextRunAt: (record: ScheduleRecord) => Date): Promise<ScheduleRecord | null> {
  await connectToDatabase();
  const query: Record<string, unknown> = { active: true, ...(filter.force ? {} : { nextRunAt: { $lte: now } }) };
  if (filter.userId) query.userId = oid(filter.userId);
  if (filter.scheduleId) query._id = oid(filter.scheduleId);
  const candidate = await ScheduleModel.findOne(query).sort({ nextRunAt: 1 }).lean<LeanSchedule>().exec();
  if (!candidate) return null;
  const record = toRecord(candidate);
  const claimed = await ScheduleModel.findOneAndUpdate(
    { _id: candidate._id, nextRunAt: candidate.nextRunAt },
    { $set: { nextRunAt: nextRunAt(record) } },
    { new: false },
  )
    .lean<LeanSchedule>()
    .exec();
  return claimed ? toRecord(claimed) : null;
}

export async function recordScheduleRun(scheduleId: string, result: { conversationId: string | null; error: string | null }): Promise<void> {
  await connectToDatabase();
  await ScheduleModel.updateOne(
    { _id: oid(scheduleId) },
    {
      $set: { lastRunAt: new Date(), lastConversationId: result.conversationId ? oid(result.conversationId) : null, lastError: result.error },
      $inc: { runCount: 1 },
    },
  ).exec();
}
