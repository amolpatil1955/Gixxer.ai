"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { getClientIp } from "@/lib/security/request";
import { signIn, signOut } from "./auth";
import { registerUser } from "./auth-service";
import { isAuthServiceError } from "./errors";
import { peekLoginBlock } from "./login-guard";
import { authRateLimits } from "./rate-limits";
import { routes, safeInternalPath } from "./routes";
import { loginSchema, registerSchema } from "./validation";

export type ActionFailure = {
  ok: false;
  /** Message safe to show to the user. */
  message: string;
  fieldErrors?: Record<string, string>;
};
export type ActionResult = { ok: true } | ActionFailure;

const GENERIC_FAILURE = "Something went wrong on our side. Please try again in a moment.";

/**
 * Starts the Google sign-in flow. Auth.js answers with a redirect to Google, which is thrown
 * as a Next.js redirect, so this action never returns normally on success.
 */
export async function googleSignInAction(formData: FormData): Promise<void> {
  const next = formData.get("next");
  await signIn("google", { redirectTo: safeInternalPath(typeof next === "string" ? next : undefined) });
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

async function clientIp(): Promise<string> {
  return getClientIp(await headers());
}

export async function loginAction(input: unknown, nextPath?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const { email, password } = parsed.data;

  try {
    // Rate limiting lives in the provider's `authorize` callback, which every
    // credentials attempt goes through, including the Auth.js HTTP endpoint.
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        if (error instanceof CredentialsSignin && error.code === "rate_limited") {
          const block = await peekLoginBlock(email, await clientIp());
          return { ok: false, message: rateLimitMessage(block.retryAfterSeconds) };
        }
        return { ok: false, message: "Invalid email or password." };
      }
      console.error("[auth] sign-in failed", error.type);
      return { ok: false, message: GENERIC_FAILURE };
    }
    throw error;
  }

  redirect(safeInternalPath(nextPath));
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const { name, email, password } = parsed.data;

  const ip = await clientIp();
  const byIp = await authRateLimits.registerByIp.consume(`register:ip:${ip}`);
  if (!byIp.allowed) return { ok: false, message: rateLimitMessage(byIp.retryAfterSeconds) };

  try {
    await registerUser({ name, email, password });
  } catch (error) {
    if (isAuthServiceError(error, "EMAIL_TAKEN")) {
      return {
        ok: false,
        message: "An account with this email already exists. Try signing in instead.",
        fieldErrors: { email: "This email is already registered" },
      };
    }
    console.error("[auth] registration failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[auth] post-registration sign-in failed", error.type);
      return { ok: false, message: "Your account was created, but signing you in failed. Please sign in." };
    }
    throw error;
  }

  redirect(routes.app);
}

export async function logoutAction(reason?: "expired"): Promise<void> {
  await signOut({ redirect: false });
  redirect(reason === "expired" ? `${routes.login}?reason=expired` : routes.login);
}
