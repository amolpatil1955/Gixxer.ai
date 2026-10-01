import { MongoClient } from "mongodb";

const E2E_MONGODB_URI = process.env.MONGODB_URI_E2E ?? "mongodb://127.0.0.1:27017/gixxer_e2e";

/** Direct database access for end-to-end tests. Uses the same database as the test server. */
export async function withDb<T>(fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(E2E_MONGODB_URI, { serverSelectionTimeoutMS: 8_000 });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function bumpSessionVersionByEmail(email: string): Promise<void> {
  await withDb(async (client) => {
    const result = await client.db().collection("users").updateOne({ email: email.toLowerCase() }, { $inc: { sessionVersion: 1 } });
    if (result.matchedCount !== 1) throw new Error(`No user found for ${email}`);
  });
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await withDb(async (client) => {
    await client.db().collection("users").deleteOne({ email: email.toLowerCase() });
  });
}
