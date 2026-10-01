import { describe, expect, it } from "vitest";
import { isAuthPagePath, isProtectedPath, safeInternalPath } from "@/lib/auth/routes";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";
import { getClientIp } from "@/lib/security/request";

describe("safeInternalPath", () => {
  it("falls back for missing, external or protocol-relative targets", () => {
    expect(safeInternalPath(undefined)).toBe("/app");
    expect(safeInternalPath(null)).toBe("/app");
    expect(safeInternalPath("")).toBe("/app");
    expect(safeInternalPath("https://evil.example")).toBe("/app");
    expect(safeInternalPath("//evil.example/phish")).toBe("/app");
    expect(safeInternalPath("/\\evil.example")).toBe("/app");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/app");
    expect(safeInternalPath("app/chat")).toBe("/app");
    expect(safeInternalPath("/app\nSet-Cookie: x")).toBe("/app");
  });

  it("refuses to bounce back to the auth pages", () => {
    expect(safeInternalPath("/login")).toBe("/app");
    expect(safeInternalPath("/register?x=1")).toBe("/app");
  });

  it("keeps valid same-origin paths", () => {
    expect(safeInternalPath("/app/chat/123?tab=files")).toBe("/app/chat/123?tab=files");
    expect(safeInternalPath("  /app/images ")).toBe("/app/images");
    expect(safeInternalPath("/somewhere", "/fallback")).toBe("/somewhere");
  });
});

describe("route classification", () => {
  it("protects the workspace and its subpaths only", () => {
    expect(isProtectedPath("/app")).toBe(true);
    expect(isProtectedPath("/app/chat")).toBe(true);
    expect(isProtectedPath("/apple")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("recognises the auth pages", () => {
    expect(isAuthPagePath("/login")).toBe(true);
    expect(isAuthPagePath("/register")).toBe(true);
    expect(isAuthPagePath("/app")).toBe(false);
  });
});

describe("content security policy", () => {
  it("requires the request nonce for scripts and forbids framing", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("only relaxes eval and websocket rules in development", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("generates unique base64 nonces of 16 bytes", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(Buffer.from(nonce, "base64")).toHaveLength(16);
    }
  });
});

describe("getClientIp", () => {
  it("prefers the first forwarded address, then x-real-ip, then a local marker", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(getClientIp(new Headers())).toBe("local");
  });
});
