import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { UserModel, type AuthProvider } from "@/lib/db/models/user.model";

/** What the rest of the app is allowed to see about a user. Never includes secrets. */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  image: string | null;
  provider: AuthProvider;
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

export async function recordLogin(id: string): Promise<void> {
  await connectToDatabase();
  await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
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
