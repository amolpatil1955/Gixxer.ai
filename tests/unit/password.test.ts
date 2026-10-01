import { describe, expect, it } from "vitest";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes with scrypt and verifies the same password", async () => {
    const hash = await hashPassword("correct horse battery 1");
    expect(hash.startsWith("scrypt$32768$8$2$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery 1", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery 1");
    await expect(verifyPassword("correct horse battery 2", hash)).resolves.toBe(false);
    await expect(verifyPassword("Correct horse battery 1", hash)).resolves.toBe(false);
  });

  it("salts every hash so identical passwords never collide", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-1"), hashPassword("same-password-1")]);
    expect(a).not.toBe(b);
  });

  it("returns false for malformed or missing stored hashes instead of throwing", async () => {
    const hash = await hashPassword("valid-password-1");
    await expect(verifyPassword("x", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt$a$b$c$d$e")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt$32768$8$2$$")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt$2b$12$abc")).resolves.toBe(false);
    await expect(verifyPassword("x", null)).resolves.toBe(false);
    await expect(verifyPassword("x", undefined)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("treats canonically equivalent unicode as the same password", async () => {
    const hash = await hashPassword("café-1234"); // precomposed é
    await expect(verifyPassword("café-1234", hash)).resolves.toBe(true); // e + combining accent
  });

  it("refuses to hash empty or oversized input", async () => {
    await expect(hashPassword("")).rejects.toThrow();
    await expect(hashPassword("a".repeat(2_000))).rejects.toThrow();
    await expect(verifyPassword("a".repeat(2_000), await hashPassword("short-1"))).resolves.toBe(false);
  });

  it("keeps a reusable dummy hash for unknown-email logins", async () => {
    const first = await getDummyPasswordHash();
    const second = await getDummyPasswordHash();
    expect(first).toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("anything", first)).resolves.toBe(false);
  });
});
