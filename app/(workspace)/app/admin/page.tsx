import type { Metadata } from "next";
import { UserDirectory } from "@/components/admin/admin-views";
import { PageHeader } from "@/components/workspace/page-header";
import { countUsers, listUsers } from "@/lib/admin/repository";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin" };

/** The account directory. `requireAdmin` sends anyone else back to the workspace. */
export default async function AdminPage({ searchParams }: PageProps<"/app/admin">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const [users, total] = await Promise.all([listUsers(query), countUsers()]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Admin"
        title="Accounts"
        description="Everyone registered on this deployment. Open an account to see what it has been doing, or to sign in as it for support."
      />
      <div className="mt-8">
        <UserDirectory
          adminId={admin.id}
          total={total}
          query={query}
          users={users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            provider: user.provider,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          }))}
        />
      </div>
    </div>
  );
}
