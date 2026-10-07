import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/*
 * Signing in as another account, the way a support tool should do it.
 *
 * The admin's own session is never replaced. A second, short-lived cookie says
 * "this admin is currently acting as that account", and every server-side check
 * re-reads it: the admin must still exist, must still be an admin, and must
 * still hold a valid session, or the ticket is ignored. So revoking the admin's
 * sessions ends impersonation at once, and the ticket cannot outlive its hour.
 *
 * The cookie is signed with AUTH_SECRET and carries no authority of its own: on
 * its own, without the admin's session beside it, it grants nothing.
 */

export const IMPERSONATION_COOKIE = "gixxer-acting-as";

/** How long one sitting may last before the admin has to start it again. */
export const IMPERSONATION_MAX_MS = 60 * 60 * 1000;

export interface ImpersonationTicket {
  /** The admin acting. */
  actorId: string;
  /** The account being entered. */
  targetId: string;
  /** The audit record this sitting belongs to. */
  recordId: string;
  issuedAt: number;
  expiresAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function encodeTicket(ticket: ImpersonationTicket): string {
  const payload = Buffer.from(JSON.stringify(ticket), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the ticket only when the signature holds and it has not expired. */
export function decodeTicket(raw: string | undefined): ImpersonationTicket | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!safeEqual(signature, sign(payload))) return null;
  let ticket: ImpersonationTicket;
  try {
    ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ImpersonationTicket;
  } catch {
    return null;
  }
  if (!ticket.actorId || !ticket.targetId || !ticket.recordId) return null;
  if (typeof ticket.expiresAt !== "number" || Date.now() > ticket.expiresAt) return null;
  return ticket;
}

export async function readImpersonationTicket(): Promise<ImpersonationTicket | null> {
  const store = await cookies();
  return decodeTicket(store.get(IMPERSONATION_COOKIE)?.value);
}

export async function setImpersonationCookie(ticket: ImpersonationTicket): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, encodeTicket(ticket), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(ticket.expiresAt),
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
