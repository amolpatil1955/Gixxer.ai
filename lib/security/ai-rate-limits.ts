import "server-only";
import { createMemoryRateLimiter, type RateLimiter } from "./rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per-IP budgets can be scaled for automated runs, like the auth limits. Per-user budgets never are. */
function ipScale(): number {
  const raw = Number(process.env.AUTH_RATE_LIMIT_IP_SCALE ?? "1");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

export interface AiRateLimits {
  chatByUser: RateLimiter;
  imagesByUser: RateLimiter;
  uploadsByUser: RateLimiter;
  sourceFetchByUser: RateLimiter;
  transcribeByUser: RateLimiter;
  voiceSessionsByUser: RateLimiter;
  voiceTurnsByUser: RateLimiter;
  scheduleRunsByUser: RateLimiter;
  photoSearchByUser: RateLimiter;
  widgetByIp: RateLimiter;
  widgetByBot: RateLimiter;
  leadsByIp: RateLimiter;
}

declare global {
  var __gixxerAiRateLimits: AiRateLimits | undefined;
}

/**
 * Budgets for everything that costs money or can be abused. Signed-in
 * features are limited per account; the public widget is limited per visitor
 * address and per bot, because a bot's owner pays for its traffic.
 */
export const aiRateLimits: AiRateLimits =
  globalThis.__gixxerAiRateLimits ??
  (globalThis.__gixxerAiRateLimits = {
    chatByUser: createMemoryRateLimiter({ limit: 60, windowMs: 10 * MINUTE }),
    imagesByUser: createMemoryRateLimiter({ limit: 20, windowMs: HOUR }),
    uploadsByUser: createMemoryRateLimiter({ limit: 40, windowMs: HOUR }),
    sourceFetchByUser: createMemoryRateLimiter({ limit: 30, windowMs: HOUR }),
    transcribeByUser: createMemoryRateLimiter({ limit: 60, windowMs: HOUR }),
    // A voice session is one connection; reconnects need headroom without allowing an open tap.
    voiceSessionsByUser: createMemoryRateLimiter({ limit: 40, windowMs: HOUR }),
    voiceTurnsByUser: createMemoryRateLimiter({ limit: 400, windowMs: HOUR }),
    scheduleRunsByUser: createMemoryRateLimiter({ limit: 30, windowMs: HOUR }),
    photoSearchByUser: createMemoryRateLimiter({ limit: 40, windowMs: 10 * MINUTE }),
    widgetByIp: createMemoryRateLimiter({ limit: 40 * ipScale(), windowMs: 10 * MINUTE }),
    widgetByBot: createMemoryRateLimiter({ limit: 400, windowMs: HOUR }),
    leadsByIp: createMemoryRateLimiter({ limit: 10 * ipScale(), windowMs: HOUR }),
  });

export function retryMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `You have hit the limit for now. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
