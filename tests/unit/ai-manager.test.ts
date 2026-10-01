import { describe, expect, it } from "vitest";
import { ProviderError } from "@/lib/ai/errors";
import { streamChat, userFacingProviderMessage, type ChatEvent } from "@/lib/ai/manager";
import type { ChatTurn, StreamOptions, TextDelta, TextProvider } from "@/lib/ai/types";

function provider(
  model: string,
  script: (turns: ChatTurn[], call: number, options: StreamOptions) => AsyncGenerator<TextDelta>,
): TextProvider & { calls: number } {
  const p = {
    name: "groq" as const,
    model,
    calls: 0,
    stream(turns: ChatTurn[], options: StreamOptions = {}) {
      p.calls += 1;
      return script(turns, p.calls, options);
    },
  };
  return p;
}

async function collect(events: AsyncIterable<ChatEvent>) {
  const out: ChatEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const text = (events: ChatEvent[]) => events.filter((e): e is { type: "token"; text: string } => e.type === "token").map((e) => e.text).join("");
const reasoning = (events: ChatEvent[]) => events.filter((e): e is { type: "reasoning"; text: string } => e.type === "reasoning").map((e) => e.text).join("");
const turns: ChatTurn[] = [{ role: "user", content: "hi" }];

describe("provider manager", () => {
  it("streams from the primary when it works", async () => {
    const primary = provider("fast", async function* () {
      yield { text: "Hel" };
      yield { text: "lo" };
    });
    const events = await collect(streamChat(turns, { providers: [primary], retryDelayMs: 0 }));
    expect(text(events)).toBe("Hello");
    expect(events[0]).toEqual({ type: "provider", name: "groq", model: "fast", switched: false });
  });

  it("passes reasoning deltas through as their own events, in order", async () => {
    const thinker = provider("thinker", async function* (_turns, _call, options) {
      expect(options.reasoning).toBe(true);
      yield { reasoning: "Let me see. " };
      yield { reasoning: "Two plus two." };
      yield { text: "Four." };
    });
    const events = await collect(streamChat(turns, { providers: [thinker], retryDelayMs: 0, reasoning: true }));
    expect(reasoning(events)).toBe("Let me see. Two plus two.");
    expect(text(events)).toBe("Four.");
    expect(events.map((e) => e.type)).toEqual(["provider", "reasoning", "reasoning", "token"]);
  });

  it("retries a retryable failure once, then hands over to the fallback", async () => {
    const primary = provider("fast", async function* () {
      throw new ProviderError("groq", "rate_limited", "429");
    });
    const fallback = provider("backup", async function* () {
      yield { text: "from backup" };
    });
    const events = await collect(streamChat(turns, { providers: [primary, fallback], retryDelayMs: 0 }));
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(1);
    expect(text(events)).toBe("from backup");
    expect(events.filter((e) => e.type === "provider")).toEqual([
      { type: "provider", name: "groq", model: "fast", switched: false },
      { type: "provider", name: "groq", model: "backup", switched: true },
    ]);
  });

  it("continues a reply that failed mid-stream instead of starting over", async () => {
    const primary = provider("fast", async function* () {
      yield { text: "The answer is " };
      throw new ProviderError("groq", "unavailable", "503");
    });
    let seen: ChatTurn[] = [];
    const fallback = provider("backup", async function* (received) {
      seen = received;
      yield { text: "forty-two." };
    });
    const events = await collect(streamChat(turns, { providers: [primary, fallback], retryDelayMs: 0 }));
    expect(primary.calls).toBe(1); // no retry after tokens have flowed
    expect(text(events)).toBe("The answer is forty-two.");
    expect(seen.at(-2)).toEqual({ role: "assistant", content: "The answer is " });
    expect(seen.at(-1)?.content).toMatch(/continue/i);
  });

  it("does not retry or fall back on a non-retryable failure", async () => {
    const primary = provider("fast", async function* () {
      throw new ProviderError("groq", "content_blocked", "blocked", { retryable: false });
    });
    const fallback = provider("backup", async function* () {
      yield { text: "never" };
    });
    await expect(collect(streamChat(turns, { providers: [primary, fallback], retryDelayMs: 0 }))).rejects.toMatchObject({ code: "content_blocked" });
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it("surfaces the last error when every provider fails", async () => {
    const a = provider("fast", async function* () {
      throw new ProviderError("groq", "timeout", "slow");
    });
    const b = provider("backup", async function* () {
      throw new ProviderError("groq", "unavailable", "down");
    });
    await expect(collect(streamChat(turns, { providers: [a, b], retryDelayMs: 0 }))).rejects.toMatchObject({ provider: "groq", code: "unavailable" });
  });

  it("reports the user's stop as aborted, never as a provider failure", async () => {
    const controller = new AbortController();
    const primary = provider("fast", async function* () {
      yield { text: "one " };
      controller.abort();
      throw new ProviderError("groq", "unavailable", "socket closed");
    });
    await expect(collect(streamChat(turns, { providers: [primary], signal: controller.signal, retryDelayMs: 0 }))).rejects.toMatchObject({ code: "aborted" });
  });

  it("keeps user-facing messages generic", () => {
    expect(userFacingProviderMessage(new ProviderError("groq", "rate_limited", "429 secret-detail"))).not.toContain("secret");
    expect(userFacingProviderMessage(new Error("ECONNRESET"))).toMatch(/our side/);
  });
});
