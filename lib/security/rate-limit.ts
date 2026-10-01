export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
  /** Current state without spending an attempt. Use for messaging, not for gating. */
  peek(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export interface MemoryRateLimiterOptions {
  /** Maximum attempts per window. */
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys; expired and then oldest entries are pruned beyond it. */
  maxEntries?: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter held in process memory.
 * Suitable for a single server instance; swap in a shared store (e.g. Redis)
 * behind the same RateLimiter interface when running multiple instances.
 */
export function createMemoryRateLimiter(options: MemoryRateLimiterOptions): RateLimiter {
  const { limit, windowMs, maxEntries = 10_000, now = Date.now } = options;
  if (!(limit > 0) || !(windowMs > 0)) throw new Error("Rate limiter needs a positive limit and window.");
  const buckets = new Map<string, Bucket>();

  function prune(currentTime: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
    if (buckets.size > maxEntries) {
      const overflow = buckets.size - maxEntries;
      let removed = 0;
      for (const key of buckets.keys()) {
        if (removed++ >= overflow) break;
        buckets.delete(key);
      }
    }
  }

  return {
    async consume(key) {
      const currentTime = now();
      if (buckets.size >= maxEntries) prune(currentTime);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        bucket = { count: 0, resetAt: currentTime + windowMs };
        buckets.set(key, bucket);
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }
      bucket.count += 1;
      return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds };
    },
    async peek(key) {
      const currentTime = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        return { allowed: true, remaining: limit, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      const remaining = Math.max(0, limit - bucket.count);
      return { allowed: remaining > 0, remaining, retryAfterSeconds };
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}
