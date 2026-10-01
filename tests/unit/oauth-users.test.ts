import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser, verifyCredentials } from "@/lib/auth/auth-service";
import { findUserByEmail, upsertOAuthUser } from "@/lib/auth/user-repository";
import { connectToDatabase, disconnectFromDatabase, pingDatabase } from "@/lib/db/mongoose";
import { UserModel } from "@/lib/db/models/user.model";

/* Google sign-in maps to user documents here. Runs against the test database; skipped without one. */
const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[oauth-users.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

describe.runIf(dbAvailable)("OAuth users (MongoDB)", () => {
  beforeEach(async () => {
    await UserModel.deleteMany({ email: /@oauth\.test$/ });
  });
  afterAll(async () => {
    await disconnectFromDatabase();
  });

  it("answers a ping on the configured database", async () => {
    const health = await pingDatabase();
    expect(health.ok).toBe(true);
    expect(health.database).toMatch(/gixxer/);
  });

  it("creates a password-less account for a new Google identity", async () => {
    const user = await upsertOAuthUser({ email: "New.Person@oauth.test", name: "New Person", image: "https://lh3.example/p.png", provider: "google" });
    expect(user.email).toBe("new.person@oauth.test");
    expect(user.provider).toBe("google");
    const stored = await findUserByEmail("new.person@oauth.test");
    expect(stored?.passwordHash).toBeNull();
    expect(stored?.image).toBe("https://lh3.example/p.png");
    // A password-less account can never be entered with a password.
    expect(await verifyCredentials("new.person@oauth.test", "anything-at-all")).toBeNull();
  });

  it("links to an existing credentials account with the same email and keeps its password", async () => {
    const registered = await registerUser({ name: "Existing", email: "existing@oauth.test", password: "Sup3r-secure-pass" });
    const linked = await upsertOAuthUser({ email: "EXISTING@oauth.test", name: "From Google", image: "https://lh3.example/g.png", provider: "google" });
    expect(linked.id).toBe(registered.id);
    expect(linked.name).toBe("Existing");
    expect(linked.sessionVersion).toBe(registered.sessionVersion);
    const stored = await findUserByEmail("existing@oauth.test");
    expect(stored?.provider).toBe("credentials");
    expect(stored?.image).toBe("https://lh3.example/g.png");
    expect(await verifyCredentials("existing@oauth.test", "Sup3r-secure-pass")).not.toBeNull();
  });

  it("is idempotent and survives two first sign-ins racing", async () => {
    const [a, b] = await Promise.all([
      upsertOAuthUser({ email: "race@oauth.test", name: "Racer", image: null, provider: "google" }),
      upsertOAuthUser({ email: "race@oauth.test", name: "Racer", image: null, provider: "google" }),
    ]);
    expect(a.id).toBe(b.id);
    expect(await UserModel.countDocuments({ email: "race@oauth.test" })).toBe(1);
  });
});
