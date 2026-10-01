import "server-only";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "./mongoose";

/*
 * Binary storage in MongoDB GridFS, so uploads and generated images live next
 * to the rest of the data with no extra service. Every read goes through the
 * owning document's repository, which is where the tenant check happens; this
 * module only knows about bytes.
 */

const BUCKET = "blobs";

async function bucket(): Promise<mongoose.mongo.GridFSBucket> {
  const connection = await connectToDatabase();
  const db = connection.connection.db;
  if (!db) throw new Error("Database connection has no db handle");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export async function storeBlob(data: Buffer, options: { filename: string; contentType: string }): Promise<Types.ObjectId> {
  const files = await bucket();
  return new Promise((resolve, reject) => {
    const upload = files.openUploadStream(options.filename, { metadata: { contentType: options.contentType } });
    upload.once("error", reject);
    upload.once("finish", () => resolve(upload.id as Types.ObjectId));
    upload.end(data);
  });
}

export async function readBlob(id: Types.ObjectId): Promise<Buffer> {
  const files = await bucket();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    files
      .openDownloadStream(id)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .once("error", reject)
      .once("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** A web stream for large downloads, so a file is never fully buffered in memory. */
export async function openBlobStream(id: Types.ObjectId): Promise<ReadableStream<Uint8Array>> {
  const files = await bucket();
  const download = files.openDownloadStream(id);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      download.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      download.once("end", () => controller.close());
      download.once("error", (error) => controller.error(error));
    },
    cancel() {
      download.destroy();
    },
  });
}

export async function deleteBlob(id: Types.ObjectId): Promise<void> {
  const files = await bucket();
  try {
    await files.delete(id);
  } catch (error) {
    // Already gone is fine; anything else should surface.
    if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
  }
}
