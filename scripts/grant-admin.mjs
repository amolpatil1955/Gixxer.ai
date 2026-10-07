/*
 * Grants the admin role to an account, by email.
 *
 *   node scripts/grant-admin.mjs someone@example.com
 *
 * Reads MONGODB_URI from the environment (or .env.local). Deployments normally
 * do not need this: ADMIN_EMAILS grants the role on sign-in. It exists for the
 * first owner on a database that already has accounts, and for taking the role
 * back with --remove.
 */
import { Resolver } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const SRV_URI = /^mongodb\+srv:\/\/(?:([^@/]*)@)?([^/?]+)(\/[^?]*)?(\?.*)?$/;

/**
 * Some machines route DNS through a stub that refuses SRV queries, which is how
 * the app's own `lib/db/srv.ts` came to exist. The driver has no fallback here,
 * so the same expansion is done through public resolvers before connecting.
 */
async function expandSrv(uri) {
  const match = SRV_URI.exec(uri);
  if (!match) return uri;
  const [, credentials, hostname, path = "/", query = ""] = match;
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const [srv, txt] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    resolver.resolveTxt(hostname).catch(() => []),
  ]);
  const params = new URLSearchParams(txt.map((chunks) => chunks.join("")).join("&"));
  for (const [key, value] of new URLSearchParams(query.slice(1))) params.set(key, value);
  if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");
  const hosts = srv.map((record) => `${record.name}:${record.port}`).join(",");
  return `mongodb://${credentials ? `${credentials}@` : ""}${hosts}${path}?${params.toString()}`;
}

function envFromFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const email = process.argv[2]?.trim().toLowerCase();
const remove = process.argv.includes("--remove");
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [--remove]");
  process.exit(1);
}

const fileEnv = envFromFile(new URL("../.env.local", import.meta.url));
const uri = process.env.MONGODB_URI ?? fileEnv.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const client = new MongoClient(await expandSrv(uri), { serverSelectionTimeoutMS: 15_000 });
try {
  await client.connect();
  const users = client.db().collection("users");
  const existing = await users.findOne({ email }, { projection: { email: 1, role: 1 } });
  if (!existing) {
    console.error(`No account for ${email}. They must sign in once first.`);
    process.exit(2);
  }
  const role = remove ? "user" : "admin";
  const result = await users.updateOne({ email }, { $set: { role } });
  console.log(result.modifiedCount === 1 ? `${email} is now ${role}.` : `${email} was already ${role}.`);
} finally {
  await client.close();
}
