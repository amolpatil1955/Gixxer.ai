import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { closeImpersonationRecord } from "@/lib/admin/repository";
import { IMPERSONATION_MAX_MS, readImpersonationTicket } from "@/lib/admin/impersonation";
import type { UserRole } from "@/lib/db/models/user.model";
import { auth } from "./auth";
import { routes } from "./routes";
import { findUserById } from "./user-repository";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  createdAt: Date;
}

/** Who is really driving, when an admin is signed in as someone else. */
export interface Impersonation {
  actor: { id: string; name: string; email: string };
  startedAt: Date;
  expiresAt: Date;
  recordId: string;
}

export type SessionState =
  | { status: "anonymous" }
  /** A session cookie exists but no longer maps to a valid account. */
  | { status: "stale" }
  | { status: "authenticated"; user: CurrentUser; impersonation: Impersonation | null };

/**
 * Authoritative session check for server code. The cookie says who the caller
 * claims to be; the database confirms the account still exists and that the
 * session generation has not been revoked. Deduplicated per request.
 *
 * When an admin is signed in as another account, `user` is the account being
 * acted on, which is what every page and repository should see, and
 * `impersonation` names the admin actually doing it. The ticket is re-checked
 * here on every request: the admin must still exist, still be an admin and
 * still hold a live session, so revoking their sessions ends it immediately.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { status: "anonymous" };

  const account = await findUserById(id);
  if (!account || account.sessionVersion !== session.user.sessionVersion) return { status: "stale" };

  const signedIn: CurrentUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    image: account.image,
    role: account.role,
    createdAt: account.createdAt,
  };

  const ticket = await readImpersonationTicket();
  if (!ticket) return { status: "authenticated", user: signedIn, impersonation: null };

  // The ticket is only ever honoured for the admin who was issued it.
  if (ticket.actorId !== account.id || account.role !== "admin") {
    await closeImpersonationRecord(ticket.recordId, "revoked").catch(() => {});
    return { status: "authenticated", user: signedIn, impersonation: null };
  }

  const target = await findUserById(ticket.targetId);
  if (!target) {
    await closeImpersonationRecord(ticket.recordId, "revoked").catch(() => {});
    return { status: "authenticated", user: signedIn, impersonation: null };
  }

  return {
    status: "authenticated",
    user: { id: target.id, name: target.name, email: target.email, image: target.image, role: target.role, createdAt: target.createdAt },
    impersonation: {
      actor: { id: account.id, name: account.name, email: account.email },
      startedAt: new Date(ticket.issuedAt),
      expiresAt: new Date(Math.min(ticket.expiresAt, ticket.issuedAt + IMPERSONATION_MAX_MS)),
      recordId: ticket.recordId,
    },
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.user : null;
}

/** Use in protected layouts, pages and route handlers. Redirects instead of rendering for outsiders. */
export async function requireUser(): Promise<CurrentUser> {
  const state = await getSessionState();
  if (state.status === "authenticated") return state.user;
  redirect(state.status === "stale" ? routes.sessionExpired : routes.login);
}

/** The admin acting right now, or null when nobody is being impersonated. */
export async function getImpersonation(): Promise<Impersonation | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.impersonation : null;
}

/**
 * The account for the admin area. Deliberately the *signed-in* account, never
 * the impersonated one: while acting as someone else an admin has no admin
 * powers, so a sitting can never be used to start another one or to change roles.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const state = await getSessionState();
  if (state.status !== "authenticated") redirect(state.status === "stale" ? routes.sessionExpired : routes.login);
  if (state.impersonation) redirect(routes.app);
  if (state.user.role !== "admin") redirect(routes.app);
  return state.user;
}

/** Like `requireAdmin`, for route handlers: answers instead of redirecting. */
export async function getAdminOrNull(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  if (state.status !== "authenticated" || state.impersonation || state.user.role !== "admin") return null;
  return state.user;
}
