import "server-only";
import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __gixxerMongoose: MongooseCache | undefined;
}

// Cached on globalThis so hot reloads in development reuse one connection pool.
const cache: MongooseCache =
  globalThis.__gixxerMongoose ?? (globalThis.__gixxerMongoose = { conn: null, promise: null });

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI } = getEnv();
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8_000,
        maxPoolSize: 10,
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return;
  await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
}
