import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { voiceConfigured } from "@/lib/ai/manager";
import { requireUser } from "@/lib/auth/session";
import { toThreadDto } from "@/lib/chat/serialize";
import { loadThread } from "@/lib/chat/service";
import { getProject } from "@/lib/projects/repository";
import { getSettings } from "@/lib/settings/repository";

export async function generateMetadata({ params }: PageProps<"/app/chat/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const loaded = await loadThread(user.id, id);
  return { title: loaded?.conversation.title ?? "Chat" };
}

export default async function ChatPage({ params }: PageProps<"/app/chat/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const loaded = await loadThread(user.id, id);
  if (!loaded) notFound();
  const { conversation } = loaded;
  const [settings, project] = await Promise.all([getSettings(user.id), conversation.projectId ? getProject(user.id, conversation.projectId) : null]);
  const projectSummary = project ? { id: project.id, name: project.name } : null;
  return (
    <ChatView
      key={conversation.id}
      conversationId={conversation.id}
      initialThread={toThreadDto(loaded.thread)}
      greetingName={settings.nickname || (user.name.trim().split(/\s+/)[0] ?? user.name)}
      project={projectSummary}
      header={{ title: conversation.title, pinned: conversation.pinned, project: projectSummary }}
      voiceAvailable={voiceConfigured()}
    />
  );
}
