import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getEnv } from "@/lib/env";
import { UserModel, type AuthProvider, type UserRole } from "@/lib/db/models/user.model";

/** What the rest of the app is allowed to see about a user. Never includes secrets. */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  image: string | null;
  provider: AuthProvider;
  role: UserRole;
  sessionVersion: number;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/** Repository-internal view that carries the password hash for verification. */
export interface UserWithSecret extends UserRecord {
  passwordHash: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

type LeanUser = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  image?: string | null;
  provider: AuthProvider;
  role?: UserRole;
  sessionVersion: number;
  passwordHash?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date | null;
};

function toRecord(doc: LeanUser): UserRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    image: doc.image ?? null,
    provider: doc.provider,
    role: doc.role ?? "user",
    sessionVersion: doc.sessionVersion,
    createdAt: doc.createdAt ?? new Date(0),
    lastLoginAt: doc.lastLoginAt ?? null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000
  );
}

export async function findUserByEmail(email: string): Promise<UserWithSecret | null> {
  await connectToDatabase();
  const doc = await UserModel.findOne({ email: normalizeEmail(email) }).lean<LeanUser>().exec();
  return doc ? { ...toRecord(doc), passwordHash: doc.passwordHash ?? null } : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  const doc = await UserModel.findById(id).lean<LeanUser>().exec();
  return doc ? toRecord(doc) : null;
}

/** Throws a MongoDB duplicate-key error (code 11000) when the email is taken. */
export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  await connectToDatabase();
  const doc = await UserModel.create({
    name: input.name,
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    provider: "credentials",
  });
  return toRecord(doc.toObject() as LeanUser);
}

export interface OAuthUserInput {
  email: string;
  name: string;
  image: string | null;
  provider: Exclude<AuthProvider, "credentials">;
}

/**
 * Signs in an OAuth identity: links it to the existing account with the same (verified)
 * email, or creates a password-less account. The caller must have checked that the
 * provider verified the email, otherwise this would let anyone claim an account.
 */
export async function upsertOAuthUser(input: OAuthUserInput): Promise<UserRecord> {
  await connectToDatabase();
  const email = normalizeEmail(input.email);
  const existing = await UserModel.findOne({ email }).lean<LeanUser>().exec();
  if (existing) {
    await UserModel.updateOne(
      { _id: existing._id },
      { $set: { lastLoginAt: new Date(), ...(existing.image ? {} : { image: input.image }) } },
    ).exec();
    return withAdminBootstrap(toRecord({ ...existing, image: existing.image ?? input.image, lastLoginAt: new Date() }));
  }
  try {
    const doc = await UserModel.create({
      name: input.name.trim().slice(0, 80) || email,
      email,
      passwordHash: null,
      image: input.image,
      provider: input.provider,
      lastLoginAt: new Date(),
    });
    return withAdminBootstrap(toRecord(doc.toObject() as LeanUser));
  } catch (error) {
    // Two first sign-ins racing: the unique index decides, and the loser links instead.
    if (!isDuplicateKeyError(error)) throw error;
    const winner = await UserModel.findOne({ email }).lean<LeanUser>().exec();
    if (!winner) throw error;
    return withAdminBootstrap(toRecord(winner));
  }
}

/**
 * Emails from ADMIN_EMAILS, lowercased. The role on the user document is what
 * every check reads; this list only grants it, so a fresh database still has an
 * owner without anyone editing the database by hand.
 */
export function bootstrapAdminEmails(): string[] {
  return getEnv()
    .ADMIN_EMAILS.split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

/** Grants the admin role to a listed email, once, on sign-in. Never removes it. */
export async function applyAdminBootstrap(email: string): Promise<void> {
  const listed = bootstrapAdminEmails();
  if (listed.length === 0 || !listed.includes(normalizeEmail(email))) return;
  await grantAdminByEmail(email);
}

/** The record as it stands after the bootstrap list has been applied to it. */
async function withAdminBootstrap(record: UserRecord): Promise<UserRecord> {
  if (!bootstrapAdminEmails().includes(record.email)) return record;
  await grantAdminByEmail(record.email);
  return { ...record, role: "admin" };
}

export async function recordLogin(id: string): Promise<void> {
  await connectToDatabase();
  await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
}

/**
 * Gives an account the admin role, by email. Used to grant the owner from
 * ADMIN_EMAILS on sign-in and by the one-off grant script. Returns whether an
 * account was actually changed, so a caller can tell "granted" from "already was".
 */
export async function grantAdminByEmail(email: string): Promise<boolean> {
  await connectToDatabase();
  const result = await UserModel.updateOne({ email: normalizeEmail(email), role: { $ne: "admin" } }, { $set: { role: "admin" } }).exec();
  return result.modifiedCount === 1;
}

export async function setUserRole(id: string, role: UserRole): Promise<boolean> {
  if (!Types.ObjectId.isValid(id)) return false;
  await connectToDatabase();
  const result = await UserModel.updateOne({ _id: new Types.ObjectId(id) }, { $set: { role } }).exec();
  return result.matchedCount === 1;
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await connectToDatabase();
  await UserModel.updateOne({ _id: id }, { $set: { name } }).exec();
}

/** Invalidates every active session for the user (e.g. after a password change). */
export async function bumpSessionVersion(id: string): Promise<void> {
  await connectToDatabase();
  await UserModel.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } }).exec();
}
