import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "@/lib/security/rate-limit";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit and then blocks until the window resets", async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter({ limit: 3, windowMs: 60_000, now: time.now });

    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(true);
    const third = await limiter.consume("k");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = await limiter.consume("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);

    time.advance(30_000);
    expect((await limiter.consume("k")).retryAfterSeconds).toBe(30);

    time.advance(30_000);
    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("tracks keys independently", async () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(false);
    expect((await limiter.consume("b")).allowed).toBe(true);
  });

  it("reset clears a key", async () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
    await limiter.consume("a");
    expect((await limiter.consume("a")).allowed).toBe(false);
    await limiter.reset("a");
    expect((await limiter.consume("a")).allowed).toBe(true);
  });

  it("peek reports state without spending an attempt", async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000, now: time.now });

    const untouched = await limiter.peek("a");
    expect(untouched).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 60 });

    await limiter.consume("a");
    expect(await limiter.peek("a")).toMatchObject({ allowed: true, remaining: 1 });
    // Peeking twice must not change anything.
    expect(await limiter.peek("a")).toMatchObject({ allowed: true, remaining: 1 });

    await limiter.consume("a");
    const exhausted = await limiter.peek("a");
    expect(exhausted.allowed).toBe(false);
    expect(exhausted.remaining).toBe(0);
    expect(exhausted.retryAfterSeconds).toBe(60);

    time.advance(60_000);
    expect((await limiter.peek("a")).allowed).toBe(true);
  });

  it("prunes expired and then oldest entries when the table is full", async () => {
    const time = clock();
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1_000, maxEntries: 3, now: time.now });
    await limiter.consume("a");
    await limiter.consume("b");
    await limiter.consume("c");
    time.advance(2_000); // a, b, c expired
    await limiter.consume("d"); // triggers prune
    // "a" was pruned, so it gets a fresh window rather than being blocked.
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("d")).allowed).toBe(false);
  });

  it("rejects nonsensical configuration", () => {
    expect(() => createMemoryRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => createMemoryRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});
