import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SessionExpiredHandler } from "@/components/auth/session-expired-handler";
import { BrandLoader } from "@/components/brand/brand-loader";
import { routes } from "@/lib/auth/routes";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Session expired", robots: { index: false } };

/**
 * Reached when a session cookie no longer maps to a valid account. Server
 * components cannot clear cookies, so a client component submits the logout
 * action, which clears the cookie and returns the visitor to the login page.
 */
export default async function SessionExpiredPage() {
  const state = await getSessionState();
  if (state.status === "authenticated") redirect(routes.app);
  if (state.status === "anonymous") redirect(`${routes.login}?reason=expired`);

  return (
    <>
      <SessionExpiredHandler />
      <BrandLoader label="Refreshing your session" fullScreen />
    </>
  );
}
