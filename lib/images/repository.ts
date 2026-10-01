import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ImageModel } from "@/lib/db/models/workspace.models";

export interface ImageRecord {
  id: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model: string;
  mime: string;
  storageId: string;
  createdAt: Date;
}

type LeanImage = {
  _id: Types.ObjectId;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model: string;
  mime: string;
  storageId: Types.ObjectId;
  createdAt?: Date;
};

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(doc: LeanImage): ImageRecord {
  return {
    id: doc._id.toString(),
    prompt: doc.prompt,
    seed: doc.seed,
    width: doc.width,
    height: doc.height,
    model: doc.model,
    mime: doc.mime,
    storageId: doc.storageId.toString(),
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export async function listImages(userId: string, limit = 60): Promise<ImageRecord[]> {
  await connectToDatabase();
  const docs = await ImageModel.find({ userId: oid(userId) }).sort({ createdAt: -1 }).limit(limit).lean<LeanImage[]>().exec();
  return docs.map(toRecord);
}

export async function getImage(userId: string, imageId: string): Promise<ImageRecord | null> {
  if (!Types.ObjectId.isValid(imageId)) return null;
  await connectToDatabase();
  const doc = await ImageModel.findOne({ _id: oid(imageId), userId: oid(userId) }).lean<LeanImage>().exec();
  return doc ? toRecord(doc) : null;
}

export async function createImageRecord(
  userId: string,
  input: { prompt: string; seed: number; width: number; height: number; model: string; mime: string; storageId: Types.ObjectId },
): Promise<ImageRecord> {
  await connectToDatabase();
  const doc = await ImageModel.create({ ...input, userId: oid(userId) });
  return toRecord(doc.toObject() as LeanImage);
}

export async function deleteImageRecord(userId: string, imageId: string): Promise<ImageRecord | null> {
  await connectToDatabase();
  const doc = await ImageModel.findOneAndDelete({ _id: oid(imageId), userId: oid(userId) }).lean<LeanImage>().exec();
  return doc ? toRecord(doc) : null;
}
