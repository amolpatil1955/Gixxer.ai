import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser, verifyCredentials } from "@/lib/auth/auth-service";
import { isAuthServiceError } from "@/lib/auth/errors";
import { bumpSessionVersion, findUserByEmail, findUserById } from "@/lib/auth/user-repository";
import { UserModel } from "@/lib/db/models/user.model";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";

/**
 * Integration tests against a real MongoDB (see tests/setup/env.ts for the URI).
 * They are skipped, loudly, when no database is reachable.
 */
const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[auth-service.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

const unique = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

describe.runIf(dbAvailable)("auth service (MongoDB)", () => {
  beforeAll(async () => {
    await UserModel.init(); // make sure the unique email index exists before duplicate tests
  });

  // Only this file's own accounts: the suites share one database and run in parallel,
  // so wiping every user would pull the ground out from under another file's test.
  const OWN_ACCOUNTS = { email: /@example\.com$/ };

  beforeEach(async () => {
    await UserModel.deleteMany(OWN_ACCOUNTS);
  });

  afterAll(async () => {
    await UserModel.deleteMany(OWN_ACCOUNTS);
    await disconnectFromDatabase();
  });

  it("registers a user with a hashed password and normalized email", async () => {
    const email = unique("register");
    const user = await registerUser({ name: "Ada Lovelace", email: email.toUpperCase(), password: "engine-1843" });

    expect(user.email).toBe(email.toLowerCase());
    expect(user.sessionVersion).toBe(1);

    const stored = await UserModel.findById(user.id).lean();
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toContain("engine-1843");
    expect(stored?.passwordHash?.startsWith("scrypt$")).toBe(true);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const email = unique("dupe");
    await registerUser({ name: "First", email, password: "engine-1843" });

    await expect(registerUser({ name: "Second", email: email.toUpperCase(), password: "engine-1843" })).rejects.toSatisfy(
      (error: unknown) => isAuthServiceError(error, "EMAIL_TAKEN"),
    );
  });

  it("lets exactly one of several concurrent registrations for one email succeed", async () => {
    const email = unique("race");
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, (_, i) => registerUser({ name: `Racer ${i}`, email, password: "engine-1843" })),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);
    expect(await UserModel.countDocuments({ email })).toBe(1);
  });

  it("verifies correct credentials and records the login", async () => {
    const email = unique("login");
    const created = await registerUser({ name: "Ada", email, password: "engine-1843" });

    const user = await verifyCredentials(email.toUpperCase(), "engine-1843");
    expect(user?.id).toBe(created.id);

    const stored = await findUserById(created.id);
    expect(stored?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("returns null for a wrong password or an unknown email", async () => {
    const email = unique("wrong");
    await registerUser({ name: "Ada", email, password: "engine-1843" });

    await expect(verifyCredentials(email, "engine-1844")).resolves.toBeNull();
    await expect(verifyCredentials(unique("nobody"), "engine-1843")).resolves.toBeNull();
  });

  it("never leaks the password hash through the public record", async () => {
    const email = unique("leak");
    const created = await registerUser({ name: "Ada", email, password: "engine-1843" });
    const record = await findUserById(created.id);
    expect(record).not.toHaveProperty("passwordHash");
    const withSecret = await findUserByEmail(email);
    expect(withSecret?.passwordHash).toBeTruthy();
  });

  it("returns null for malformed ids instead of throwing", async () => {
    await expect(findUserById("not-an-object-id")).resolves.toBeNull();
    await expect(findUserById("")).resolves.toBeNull();
  });

  it("bumps the session version to revoke sessions", async () => {
    const created = await registerUser({ name: "Ada", email: unique("bump"), password: "engine-1843" });
    await bumpSessionVersion(created.id);
    const record = await findUserById(created.id);
    expect(record?.sessionVersion).toBe(2);
  });
});
