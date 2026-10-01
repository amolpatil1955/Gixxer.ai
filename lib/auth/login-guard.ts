import "server-only";
import { CredentialsSignin } from "next-auth";
import type { RateLimitResult } from "@/lib/security/rate-limit";
import { authRateLimits } from "./rate-limits";

/**
 * Brute-force protection for credentials sign-in.
 *
 * Enforced inside the Auth.js `authorize` callback rather than in the server
 * action, because `/api/auth/callback/credentials` is a second, equally valid
 * entry point. Gating at the provider covers both.
 */
const ipKey = (ip: string) => `login:ip:${ip}`;
const emailKey = (email: string) => `login:email:${email}`;

/** Thrown from `authorize` when an attempt is refused. Auth.js exposes `code` to the caller. */
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export interface LoginGuardResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function worstOf(results: RateLimitResult[]): LoginGuardResult {
  const blocked = results.filter((result) => !result.allowed);
  if (blocked.length === 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: false, retryAfterSeconds: Math.max(...blocked.map((r) => r.retryAfterSeconds)) };
}

/** Spends one attempt against both the per-IP and per-email budgets. */
export async function consumeLoginAttempt(email: string, ip: string): Promise<LoginGuardResult> {
  const results = await Promise.all([
    authRateLimits.loginByIp.consume(ipKey(ip)),
    authRateLimits.loginByEmail.consume(emailKey(email)),
  ]);
  return worstOf(results);
}

/** Reads the current block state for user-facing messaging. Spends nothing. */
export async function peekLoginBlock(email: string, ip: string): Promise<LoginGuardResult> {
  const results = await Promise.all([
    authRateLimits.loginByIp.peek(ipKey(ip)),
    authRateLimits.loginByEmail.peek(emailKey(email)),
  ]);
  return worstOf(results);
}

/** Called after a successful sign-in so a legitimate user is never left throttled. */
export async function clearLoginAttempts(email: string): Promise<void> {
  await authRateLimits.loginByEmail.reset(emailKey(email));
}
