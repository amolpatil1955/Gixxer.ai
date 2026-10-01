import type { Metadata } from "next";
import { ProjectsView } from "@/components/projects/projects-view";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { countConversationsByProject } from "@/lib/chat/repository";
import { listProjects } from "@/lib/projects/repository";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, counts] = await Promise.all([listProjects(user.id), countConversationsByProject(user.id)]);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle title="Projects" description="Keep the chats for one piece of work together, with instructions every one of them inherits." />
      <div className="mt-6">
        <ProjectsView
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            instructions: project.instructions,
            conversationCount: counts.get(project.id) ?? 0,
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
