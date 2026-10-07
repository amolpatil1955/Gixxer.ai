import { Types } from "mongoose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { decodeTicket, encodeTicket, IMPERSONATION_MAX_MS, type ImpersonationTicket } from "@/lib/admin/impersonation";
import { closeImpersonationRecord, getUserActivity, getUserSummary, listImpersonations, listUsers, openImpersonationRecord } from "@/lib/admin/repository";
import { registerUser } from "@/lib/auth/auth-service";
import { findUserByEmail, grantAdminByEmail, setUserRole } from "@/lib/auth/user-repository";
import { createConversation, createMessage } from "@/lib/chat/repository";
import { ImpersonationModel } from "@/lib/db/models/admin.models";
import { UserModel } from "@/lib/db/models/user.model";
import { ConversationModel, MessageModel } from "@/lib/db/models/workspace.models";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";

/* The admin role and signing in as another account. */

describe("impersonation ticket", () => {
  const ticket: ImpersonationTicket = {
    actorId: "a".repeat(24),
    targetId: "b".repeat(24),
    recordId: "c".repeat(24),
    issuedAt: Date.now(),
    expiresAt: Date.now() + IMPERSONATION_MAX_MS,
  };

  it("round-trips a ticket it signed", () => {
    expect(decodeTicket(encodeTicket(ticket))).toEqual(ticket);
  });

  it("refuses a tampered payload, a tampered signature and nonsense", () => {
    const signed = encodeTicket(ticket);
    const [payload, signature] = signed.split(".");
    // Someone swapping in a different target cannot re-sign it.
    const forged = Buffer.from(JSON.stringify({ ...ticket, targetId: "d".repeat(24) }), "utf8").toString("base64url");
    expect(decodeTicket(`${forged}.${signature}`)).toBeNull();
    expect(decodeTicket(`${payload}.${"x".repeat(43)}`)).toBeNull();
    expect(decodeTicket("not-a-ticket")).toBeNull();
    expect(decodeTicket(undefined)).toBeNull();
    expect(decodeTicket("")).toBeNull();
  });

  it("refuses a ticket that has run out", () => {
    expect(decodeTicket(encodeTicket({ ...ticket, expiresAt: Date.now() - 1 }))).toBeNull();
  });

  it("never lets a sitting last longer than an hour", () => {
    expect(IMPERSONATION_MAX_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[admin.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

const DOMAIN = "@admin.test";

describe.runIf(dbAvailable)("admin directory (MongoDB)", () => {
  // Only this file's accounts: the suites share one database and run in parallel.
  const own = { email: new RegExp(`${DOMAIN.replace(".", "\\.")}$`) };

  beforeEach(async () => {
    const users = await UserModel.find(own).select("_id").lean<{ _id: Types.ObjectId }[]>().exec();
    const ids = users.map((user) => user._id);
    await Promise.all([
      UserModel.deleteMany(own),
      ConversationModel.deleteMany({ userId: { $in: ids } }),
      MessageModel.deleteMany({ userId: { $in: ids } }),
      ImpersonationModel.deleteMany({ $or: [{ actorId: { $in: ids } }, { targetId: { $in: ids } }] }),
    ]);
  });

  afterAll(async () => {
    await disconnectFromDatabase();
  });

  const make = (tag: string) => registerUser({ name: `${tag} person`, email: `${tag}${DOMAIN}`, password: "Sup3r-secure-pass" });

  it("starts everyone as an ordinary user and grants the role by email", async () => {
    const created = await make("owner");
    expect((await findUserByEmail(created.email))?.role).toBe("user");

    expect(await grantAdminByEmail(created.email)).toBe(true);
    expect((await findUserByEmail(created.email))?.role).toBe("admin");
    // Granting twice is not an error, it simply changes nothing.
    expect(await grantAdminByEmail(created.email)).toBe(false);

    expect(await setUserRole(created.id, "user")).toBe(true);
    expect((await findUserByEmail(created.email))?.role).toBe("user");
  });

  it("lists and searches accounts without leaking a password hash", async () => {
    await make("ada");
    await make("grace");
    const all = await listUsers("");
    const mine = all.filter((user) => user.email.endsWith(DOMAIN));
    expect(mine.map((user) => user.email).sort()).toEqual([`ada${DOMAIN}`, `grace${DOMAIN}`]);
    expect(JSON.stringify(mine)).not.toMatch(/scrypt|passwordHash/);

    expect((await listUsers("grace")).some((user) => user.email === `grace${DOMAIN}`)).toBe(true);
    // What is typed is matched literally, never as a pattern.
    expect((await listUsers(".*"))).toEqual([]);
  });

  it("reports what an account has been doing, in counts and titles", async () => {
    const user = await make("busy");
    const conversation = await createConversation(user.id, "Quarterly numbers");
    await createMessage(user.id, { conversationId: conversation.id, role: "user", content: "secret contents", parentId: null });

    const activity = await getUserActivity(user.id);
    expect(activity.conversations).toBe(1);
    expect(activity.messages).toBe(1);
    expect(activity.recent[0]?.label).toBe("Quarterly numbers");
    // Titles yes, the contents of a message never.
    expect(JSON.stringify(activity)).not.toContain("secret contents");
  });

  it("records every sitting and closes it exactly once", async () => {
    const admin = await make("admin");
    const target = await make("target");
    const recordId = await openImpersonationRecord({
      actorId: admin.id,
      actorEmail: admin.email,
      targetId: target.id,
      targetEmail: target.email,
      reason: "Reproducing a billing report",
      ip: "203.0.113.5",
    });

    const [open] = await listImpersonations({ targetId: target.id });
    expect(open?.actorEmail).toBe(admin.email);
    expect(open?.reason).toBe("Reproducing a billing report");
    expect(open?.endedAt).toBeNull();

    await closeImpersonationRecord(recordId, "admin");
    const [closed] = await listImpersonations({ targetId: target.id });
    expect(closed?.endedAt).not.toBeNull();
    expect(closed?.endedBy).toBe("admin");

    // Closing again leaves the first ending in place.
    const endedAt = closed?.endedAt;
    await closeImpersonationRecord(recordId, "expired");
    const [again] = await listImpersonations({ targetId: target.id });
    expect(again?.endedAt?.getTime()).toBe(endedAt?.getTime());
    expect(again?.endedBy).toBe("admin");
  });

  it("returns nothing for an account that does not exist", async () => {
    expect(await getUserSummary(new Types.ObjectId().toString())).toBeNull();
    expect(await getUserSummary("not-an-id")).toBeNull();
  });
});
