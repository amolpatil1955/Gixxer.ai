import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import { requireUser } from "@/lib/auth/session";
import { listProjectConversations } from "@/lib/chat/repository";
import { toConversationDto } from "@/lib/chat/serialize";
import { getProject } from "@/lib/projects/repository";

export async function generateMetadata({ params }: PageProps<"/app/projects/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/app/projects/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const conversations = await listProjectConversations(user.id, project.id);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <ProjectView
        project={{
          id: project.id,
          name: project.name,
          instructions: project.instructions,
          conversationCount: conversations.length,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        }}
        conversations={toConversationDto(conversations)}
      />
    </div>
  );
}
