import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { routes } from "./routes";
import { findUserById } from "./user-repository";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
}

export type SessionState =
  | { status: "anonymous" }
  /** A session cookie exists but no longer maps to a valid account. */
  | { status: "stale" }
  | { status: "authenticated"; user: CurrentUser };

/**
 * Authoritative session check for server code. The cookie says who the caller
 * claims to be; the database confirms the account still exists and that the
 * session generation has not been revoked. Deduplicated per request.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { status: "anonymous" };

  const user = await findUserById(id);
  if (!user || user.sessionVersion !== session.user.sessionVersion) return { status: "stale" };

  return {
    status: "authenticated",
    user: { id: user.id, name: user.name, email: user.email, image: user.image, createdAt: user.createdAt },
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
