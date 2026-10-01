import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/auth/validation";

const valid = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  password: "engine-1843",
  confirmPassword: "engine-1843",
};

function messagesFor(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => `${String(issue.path[0])}: ${issue.message}`);
}

describe("registerSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "  Ada@Example.com " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.name).toBe("Ada Lovelace");
    }
  });

  it("rejects invalid emails", () => {
    for (const email of ["", "ada", "ada@", "@example.com", "ada@example", "a b@example.com"]) {
      const result = registerSchema.safeParse({ ...valid, email });
      expect(result.success, `email "${email}" should be rejected`).toBe(false);
      expect(messagesFor(result).some((m) => m.startsWith("email:"))).toBe(true);
    }
  });

  it("enforces the password policy", () => {
    expect(messagesFor(registerSchema.safeParse({ ...valid, password: "short1", confirmPassword: "short1" }))).toContain(
      "password: Use at least 8 characters",
    );
    expect(messagesFor(registerSchema.safeParse({ ...valid, password: "onlyletters", confirmPassword: "onlyletters" }))).toContain(
      "password: Include at least one number",
    );
    expect(messagesFor(registerSchema.safeParse({ ...valid, password: "12345678", confirmPassword: "12345678" }))).toContain(
      "password: Include at least one letter",
    );
    const tooLong = "a1".repeat(70);
    expect(messagesFor(registerSchema.safeParse({ ...valid, password: tooLong, confirmPassword: tooLong }))).toContain(
      "password: Use at most 128 characters",
    );
  });

  it("requires the confirmation to match", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "engine-1844" });
    expect(messagesFor(result)).toContain("confirmPassword: Passwords do not match");
  });

  it("validates names", () => {
    expect(registerSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "x".repeat(81) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "<script>alert(1)</script>" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "Zoë O'Brien-Smith" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, name: "José Núñez" }).success).toBe(true);
  });

  it("rejects non-object and missing input", () => {
    expect(registerSchema.safeParse(undefined).success).toBe(false);
    expect(registerSchema.safeParse("string").success).toBe(false);
    expect(registerSchema.safeParse({}).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalizes the email and only requires a non-empty password", () => {
    const result = loginSchema.safeParse({ email: " ADA@example.com", password: "x" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("reports missing fields", () => {
    const messages = messagesFor(loginSchema.safeParse({ email: "", password: "" }));
    expect(messages).toContain("email: Email is required");
    expect(messages).toContain("password: Password is required");
  });

  it("caps password length to avoid expensive hashing of huge input", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(129) }).success).toBe(false);
  });
});
