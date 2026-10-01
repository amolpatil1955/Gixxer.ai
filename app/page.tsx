import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { routes } from "@/lib/auth/routes";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Gixxer.ai · Every model. One workspace.",
  description:
    "Chat with the best models, generate images, read your documents and put a trained chatbot on your website. Gixxer.ai switches providers automatically when one slows down.",
};

/** The public landing page. Signed-in visitors see it too, with the calls to action pointed at their workspace. */
export default async function HomePage() {
  const state = await getSessionState();
  if (state.status === "stale") redirect(routes.sessionExpired);
  return <LandingPage signedIn={state.status === "authenticated"} />;
}
