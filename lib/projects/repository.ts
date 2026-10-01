import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ProjectModel } from "@/lib/db/models/workspace.models";

export interface ProjectRecord {
  id: string;
  name: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

type LeanProject = { _id: Types.ObjectId; name: string; instructions?: string; createdAt?: Date; updatedAt?: Date };

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(doc: LeanProject): ProjectRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    instructions: doc.instructions ?? "",
    createdAt: doc.createdAt ?? new Date(0),
    updatedAt: doc.updatedAt ?? doc.createdAt ?? new Date(0),
  };
}

export async function listProjects(userId: string, limit = 100): Promise<ProjectRecord[]> {
  await connectToDatabase();
  const docs = await ProjectModel.find({ userId: oid(userId) }).sort({ updatedAt: -1 }).limit(limit).lean<LeanProject[]>().exec();
  return docs.map(toRecord);
}

export async function getProject(userId: string, projectId: string): Promise<ProjectRecord | null> {
  if (!Types.ObjectId.isValid(projectId)) return null;
  await connectToDatabase();
  const doc = await ProjectModel.findOne({ _id: oid(projectId), userId: oid(userId) }).lean<LeanProject>().exec();
  return doc ? toRecord(doc) : null;
}

export async function createProject(userId: string, name: string): Promise<ProjectRecord> {
  await connectToDatabase();
  const doc = await ProjectModel.create({ userId: oid(userId), name });
  return toRecord(doc.toObject() as LeanProject);
}

export async function updateProject(userId: string, projectId: string, patch: { name?: string; instructions?: string }): Promise<boolean> {
  await connectToDatabase();
  const result = await ProjectModel.updateOne({ _id: oid(projectId), userId: oid(userId) }, { $set: patch }).exec();
  return result.matchedCount === 1;
}

export async function deleteProjectRecord(userId: string, projectId: string): Promise<boolean> {
  await connectToDatabase();
  const result = await ProjectModel.deleteOne({ _id: oid(projectId), userId: oid(userId) }).exec();
  return result.deletedCount === 1;
}

/** Bumps `updatedAt`, so a project with fresh chats rises in the list. */
export async function touchProject(userId: string, projectId: string): Promise<void> {
  await connectToDatabase();
  await ProjectModel.updateOne({ _id: oid(projectId), userId: oid(userId) }, { $set: { updatedAt: new Date() } }).exec();
}
