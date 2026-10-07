import { after } from "next/server";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getSessionState, requireUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/user-repository";
import { listConversations } from "@/lib/chat/repository";
import { toConversationDto } from "@/lib/chat/serialize";
import { listProjects } from "@/lib/projects/repository";
import { runDueSchedules } from "@/lib/schedules/service";
import { getSettings } from "@/lib/settings/repository";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const state = await getSessionState();
  const impersonation = state.status === "authenticated" ? state.impersonation : null;
  const [conversations, projects, settings, account] = await Promise.all([listConversations(user.id), listProjects(user.id), getSettings(user.id), findUserById(user.id)]);

  // Scheduled prompts that came due while nobody was looking run now, after the page is served.
  after(() => runDueSchedules({ userId: user.id }).catch((error: unknown) => console.error("[schedules] sweep failed", error instanceof Error ? error.message : error)));

  return (
    <WorkspaceShell
      user={{ name: user.name, email: user.email, image: user.image, createdAt: user.createdAt.toISOString(), provider: account?.provider ?? "credentials" }}
      conversations={toConversationDto(conversations)}
      projects={projects.map((project) => ({ id: project.id, name: project.name }))}
      settings={settings}
      isAdmin={user.role === "admin" && !impersonation}
      impersonation={impersonation ? { email: user.email, actorEmail: impersonation.actor.email } : null}
    >
      {children}
    </WorkspaceShell>
  );
}
