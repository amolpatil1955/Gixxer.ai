import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserDetail } from "@/components/admin/admin-views";
import { getUserActivity, getUserSummary, listImpersonations } from "@/lib/admin/repository";
import { requireAdmin } from "@/lib/auth/session";
import { workspaceRoutes } from "@/lib/workspace/routes";

export const metadata: Metadata = { title: "Account" };

/** One account: what it has been doing, who has opened it, and the control to open it. */
export default async function AdminUserPage({ params }: PageProps<"/app/admin/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await getUserSummary(id);
  if (!user) notFound();
  const [activity, sittings] = await Promise.all([getUserActivity(user.id), listImpersonations({ targetId: user.id, limit: 20 })]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <Link href={workspaceRoutes.admin} className="text-[13px] text-ink-400 hover:text-ink-50">
        ← All accounts
      </Link>
      <div className="mt-5">
        <UserDetail
          isSelf={user.id === admin.id}
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            provider: user.provider,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          }}
          activity={{
            ...activity,
            recent: activity.recent.map((item) => ({ ...item, at: item.at.toISOString() })),
            lastActiveAt: activity.lastActiveAt ? activity.lastActiveAt.toISOString() : null,
          }}
          sittings={sittings.map((sitting) => ({
            ...sitting,
            startedAt: sitting.startedAt.toISOString(),
            endedAt: sitting.endedAt ? sitting.endedAt.toISOString() : null,
          }))}
        />
      </div>
    </div>
  );
}
