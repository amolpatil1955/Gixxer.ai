import type { Metadata } from "next";
import { ProfileSection } from "@/components/workspace/settings/profile-section";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/user-repository";

export const metadata: Metadata = { title: "Account" };

/** The profile section as a page, for links that land here directly. Everything else lives in the settings window. */
export default async function AccountPage() {
  const user = await requireUser();
  const account = await findUserById(user.id);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle title="Profile" description="Your session is verified on the server on every request." />
      <div className="mt-6 rounded-3xl border border-line bg-ink-900/40 p-5 sm:p-6">
        <ProfileSection user={{ name: user.name, email: user.email, image: user.image, createdAt: user.createdAt.toISOString(), provider: account?.provider ?? "credentials" }} />
      </div>
    </div>
  );
}
