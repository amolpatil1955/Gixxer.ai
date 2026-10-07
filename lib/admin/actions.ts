"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminOrNull, getSessionState } from "@/lib/auth/session";
import { setUserRole } from "@/lib/auth/user-repository";
import { getClientIp } from "@/lib/security/request";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { clearImpersonationCookie, IMPERSONATION_MAX_MS, setImpersonationCookie } from "./impersonation";
import { closeImpersonationRecord, getUserSummary, openImpersonationRecord } from "./repository";

export type ActionResult = { ok: true } | { ok: false; message: string };

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const startSchema = z.object({
  userId: objectId,
  reason: z.string().trim().min(3, "Say why you need to open this account").max(300),
});

const roleSchema = z.object({ userId: objectId, role: z.enum(["user", "admin"]) });

/**
 * Starts a sitting as another account. Refused for anyone who is not an admin,
 * for the admin's own account, and for another admin, so one admin can never
 * quietly enter a colleague's account. Every sitting is recorded before the
 * cookie is set, so there is no way to be inside an account without a record.
 */
export async function startImpersonationAction(input: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: "You do not have access to that." };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request" };

  const target = await getUserSummary(parsed.data.userId);
  if (!target) return { ok: false, message: "That account was not found." };
  if (target.id === admin.id) return { ok: false, message: "You are already signed in as yourself." };
  if (target.role === "admin") return { ok: false, message: "An administrator's account cannot be opened this way." };

  const ip = getClientIp(await headers());
  const recordId = await openImpersonationRecord({
    actorId: admin.id,
    actorEmail: admin.email,
    targetId: target.id,
    targetEmail: target.email,
    reason: parsed.data.reason,
    ip,
  });
  const issuedAt = Date.now();
  await setImpersonationCookie({ actorId: admin.id, targetId: target.id, recordId, issuedAt, expiresAt: issuedAt + IMPERSONATION_MAX_MS });
  redirect(workspaceRoutes.home);
}

/** Ends the sitting and closes its record. Safe to call when nothing is open. */
export async function stopImpersonationAction(): Promise<ActionResult> {
  const state = await getSessionState();
  if (state.status === "authenticated" && state.impersonation) {
    await closeImpersonationRecord(state.impersonation.recordId, "admin");
  }
  await clearImpersonationCookie();
  redirect(workspaceRoutes.admin);
}

export async function setUserRoleAction(input: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: "You do not have access to that." };
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request" };
  // An admin cannot demote themselves, so the last administrator cannot lock everyone out by accident.
  if (parsed.data.userId === admin.id) return { ok: false, message: "You cannot change your own role." };
  const changed = await setUserRole(parsed.data.userId, parsed.data.role);
  if (!changed) return { ok: false, message: "That account was not found." };
  revalidatePath(workspaceRoutes.admin);
  revalidatePath(workspaceRoutes.adminUser(parsed.data.userId));
  return { ok: true };
}
