import "server-only";
import { createMemoryRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";

const MINUTE = 60_000;

/**
 * Per-IP limits can be scaled up for automated end-to-end runs, where every
 * request comes from one address. Per-email limits are never relaxed.
 */
function ipScale(): number {
  const raw = Number(process.env.AUTH_RATE_LIMIT_IP_SCALE ?? "1");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

export interface AuthRateLimits {
  loginByIp: RateLimiter;
  loginByEmail: RateLimiter;
  registerByIp: RateLimiter;
}

declare global {
  var __gixxerAuthRateLimits: AuthRateLimits | undefined;
}

export const authRateLimits: AuthRateLimits =
  globalThis.__gixxerAuthRateLimits ??
  (globalThis.__gixxerAuthRateLimits = {
    loginByIp: createMemoryRateLimiter({ limit: 30 * ipScale(), windowMs: 15 * MINUTE }),
    loginByEmail: createMemoryRateLimiter({ limit: 5, windowMs: 15 * MINUTE }),
    registerByIp: createMemoryRateLimiter({ limit: 10 * ipScale(), windowMs: 60 * MINUTE }),
  });
