import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { googleAuthStatus } from "@/lib/auth/auth";
import { routes, safeInternalPath } from "@/lib/auth/routes";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const state = await getSessionState();
  if (state.status === "authenticated") redirect(routes.app);
  if (state.status === "stale") redirect(routes.sessionExpired);

  const params = await searchParams;
  const nextPath = safeInternalPath(firstValue(params.next));
  const reason = firstValue(params.reason);

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in to Gixxer.ai"
      description="Your AI workspace is ready when you are."
    >
      <LoginForm
        nextPath={nextPath}
        googleAvailable={googleAuthStatus().available}
        notice={
          reason === "expired"
            ? "Your session has expired. Please sign in again."
            : reason === "signed-out-everywhere"
              ? "You have been signed out on every device. Sign in again to continue."
              : undefined
        }
      />
    </AuthCard>
  );
}
