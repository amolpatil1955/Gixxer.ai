import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { settingsSchema, widgetMessageSchema } from "@/lib/bots/validation";
import { threadFor, type MessageRecord } from "@/lib/chat/repository";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { isBlockedAddress, parsePublicUrl } from "@/lib/security/ssrf";
import { widgetScript } from "@/lib/widget/script";

describe("outbound URL guard", () => {
  it("rejects private, loopback and non-http addresses", () => {
    for (const bad of ["http://localhost/x", "http://127.0.0.1:8080", "http://10.0.0.5/", "http://169.254.169.254/latest", "http://192.168.1.1", "ftp://example.com", "http://user:pw@example.com", "http://[::1]/", "javascript:alert(1)", "not a url"]) {
      expect(parsePublicUrl(bad).ok, bad).toBe(false);
    }
  });

  it("accepts public https addresses and normalises them", () => {
    const result = parsePublicUrl(" https://example.com/pricing ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.toString()).toBe("https://example.com/pricing");
  });

  it("classifies resolved addresses", () => {
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("172.32.0.1")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("fd00::1")).toBe(true);
    expect(isBlockedAddress("2606:4700::1")).toBe(false);
  });
});

describe("content security policy", () => {
  it("forbids framing everywhere except the embed page", () => {
    expect(buildContentSecurityPolicy({ nonce: "n", isDevelopment: false })).toContain("frame-ancestors 'none'");
    expect(buildContentSecurityPolicy({ nonce: "n", isDevelopment: false, embeddable: true })).toContain("frame-ancestors *");
  });
});

describe("widget loader", () => {
  it("is valid JavaScript that pins its origin and validates the key", () => {
    const source = widgetScript("https://app.example.com");
    expect(() => new Script(source)).not.toThrow();
    expect(source).toContain('"https://app.example.com"');
    expect(source).toContain("/^gx_[A-Za-z0-9_-]{16,32}$/");
    expect(source).not.toMatch(/GEMINI|GROQ|HUGGINGFACE|API_KEY/);
  });
});

describe("bot validation", () => {
  it("normalises allowed origins and rejects paths", () => {
    const base = { botId: "0".repeat(24), name: "Aria", businessName: "", businessInfo: "", welcomeMessage: "Hi", suggestedQuestions: [] };
    const ok = settingsSchema.safeParse({ ...base, allowedOrigins: ["https://Example.com/"] });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.allowedOrigins).toEqual(["https://Example.com"]);
    expect(settingsSchema.safeParse({ ...base, allowedOrigins: ["https://example.com/path"] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, suggestedQuestions: Array(7).fill("q") }).success).toBe(false);
  });

  it("requires a well-formed visitor session id", () => {
    expect(widgetMessageSchema.safeParse({ sessionId: "short", message: "hi" }).success).toBe(false);
    expect(widgetMessageSchema.safeParse({ sessionId: "a".repeat(32), message: "hi" }).success).toBe(true);
  });
});

describe("conversation threading", () => {
  const at = (n: number) => new Date(2026, 0, 1, 0, 0, n);
  const message = (id: string, role: "user" | "assistant", parentId: string | null, second: number): MessageRecord => ({
    id,
    conversationId: "c",
    role,
    content: id,
    parentId,
    status: "complete",
    provider: null,
    reasoning: "",
    feedback: null,
    attachments: [],
    citations: [],
    artifacts: [],
    errorMessage: null,
    createdAt: at(second),
  });
  // u1 -> a1 -> u2 -> a2 ; u2 edited into u2b -> a3 ; a2 regenerated into a2b
  const messages = [
    message("u1", "user", null, 1),
    message("a1", "assistant", "u1", 2),
    message("u2", "user", "a1", 3),
    message("a2", "assistant", "u2", 4),
    message("u2b", "user", "a1", 5),
    message("a3", "assistant", "u2b", 6),
    message("a2b", "assistant", "u2", 7),
  ];

  it("follows the active leaf back to the root and counts siblings", () => {
    const thread = threadFor(messages, "a2b");
    expect(thread.map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2b"]);
    const u2 = thread.find((m) => m.id === "u2")!;
    expect(u2.siblingCount).toBe(2);
    expect(u2.siblingIndex).toBe(0);
    expect(u2.siblingIds).toEqual(["u2", "u2b"]);
    const a2b = thread.find((m) => m.id === "a2b")!;
    expect(a2b.siblingIndex).toBe(1);
    expect(a2b.siblingCount).toBe(2);
  });

  it("falls back to the newest leaf when no active leaf is recorded", () => {
    expect(threadFor(messages, null).map((m) => m.id)).toEqual(["u1", "a1", "u2b", "a3"]);
  });
});
