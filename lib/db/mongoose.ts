import "server-only";
import mongoose from "mongoose";
import { getEnv } from "@/lib/env";
import { isSrvLookupFailure, resolveSrvUri } from "./srv";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __gixxerMongoose: MongooseCache | undefined;
}

/*
 * One connection pool per process, cached on globalThis so that development hot reloads
 * and serverless warm invocations reuse it instead of opening a new pool per request.
 * A failed attempt clears the cache so the next request retries from scratch.
 */
const cache: MongooseCache =
  globalThis.__gixxerMongoose ?? (globalThis.__gixxerMongoose = { conn: null, promise: null });

const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  // Fail fast instead of queueing operations against a connection that never comes up.
  bufferCommands: false,
  serverSelectionTimeoutMS: 8_000,
  connectTimeoutMS: 10_000,
  // Small pools suit serverless: each instance holds few connections and drops idle ones.
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
};

mongoose.set("strictQuery", true);

async function open(uri: string): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(uri, CONNECT_OPTIONS);
  } catch (error) {
    // A local DNS stub that refuses SRV queries is an environment problem, not a database one.
    if (!uri.startsWith("mongodb+srv://") || !isSrvLookupFailure(error)) throw error;
    console.warn("[db] The system resolver refused the SRV lookup for the cluster; resolving it through public DNS instead.");
    return mongoose.connect(await resolveSrvUri(uri), CONNECT_OPTIONS);
  }
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn && cache.conn.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI } = getEnv();
    cache.promise = open(MONGODB_URI).catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** Round trip to the server; used by health checks and verification scripts. */
export async function pingDatabase(): Promise<{ ok: boolean; database: string; host: string }> {
  const conn = (await connectToDatabase()).connection;
  const db = conn.db;
  if (!db) return { ok: false, database: conn.name, host: conn.host };
  const result = await db.admin().ping();
  return { ok: result.ok === 1, database: conn.name, host: conn.host };
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return;
  await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
}
