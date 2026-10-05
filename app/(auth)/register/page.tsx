import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { googleAuthStatus } from "@/lib/auth/auth";
import { routes } from "@/lib/auth/routes";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const state = await getSessionState();
  if (state.status === "authenticated") redirect(routes.app);
  if (state.status === "stale") redirect(routes.sessionExpired);

  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your Gixxer.ai account"
      description="One account for chat, images, file intelligence and business chatbots."
    >
      <RegisterForm googleAvailable={googleAuthStatus().available} />
    </AuthCard>
  );
}
