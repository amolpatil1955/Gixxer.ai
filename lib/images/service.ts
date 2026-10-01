import "server-only";
import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import { generateImage } from "@/lib/ai/manager";
import { deleteBlob, storeBlob } from "@/lib/db/storage";
import { createImageRecord, deleteImageRecord, type ImageRecord } from "./repository";
import { MAX_SEED, sizeFor, type ImageSizeKey } from "./validation";

export interface CreateImageInput {
  prompt: string;
  size: ImageSizeKey;
  seed?: number;
  signal?: AbortSignal;
}

/** Generates, stores and registers one image. Throws ProviderError on generation failure. */
export async function createImage(userId: string, input: CreateImageInput): Promise<ImageRecord> {
  const size = sizeFor(input.size);
  const seed = input.seed ?? randomInt(0, MAX_SEED);
  const result = await generateImage({ prompt: input.prompt, seed, width: size.width, height: size.height, signal: input.signal });
  const extension = result.mime.includes("png") ? "png" : result.mime.includes("webp") ? "webp" : "jpg";
  const storageId = await storeBlob(result.bytes, { filename: `image-${seed}.${extension}`, contentType: result.mime });
  return createImageRecord(userId, {
    prompt: input.prompt,
    seed,
    width: size.width,
    height: size.height,
    model: result.model,
    mime: result.mime,
    storageId,
  });
}

export async function deleteImage(userId: string, imageId: string): Promise<boolean> {
  const record = await deleteImageRecord(userId, imageId);
  if (!record) return false;
  await deleteBlob(new Types.ObjectId(record.storageId)).catch(() => {});
  return true;
}
