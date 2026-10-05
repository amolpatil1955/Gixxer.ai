import type { Metadata } from "next";
import { ChatView } from "@/components/chat/chat-view";
import type { PendingAttachment } from "@/components/chat/attachments";
import { voiceConfigured } from "@/lib/ai/manager";
import { requireUser } from "@/lib/auth/session";
import { getFile } from "@/lib/files/repository";
import { getProject } from "@/lib/projects/repository";
import { getSettings } from "@/lib/settings/repository";

export const metadata: Metadata = { title: "New chat" };

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * A fresh conversation. `?attach=<fileId>` pre-attaches a library file to the
 * first message; `?project=<id>` starts the chat inside a project.
 */
export default async function NewChatPage({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const params = await searchParams;
  const attach = typeof params.attach === "string" ? params.attach : null;
  const projectId = typeof params.project === "string" ? params.project : null;
  const [settings, project, file] = await Promise.all([getSettings(user.id), projectId ? getProject(user.id, projectId) : null, attach ? getFile(user.id, attach) : null]);

  const initialAttachments: PendingAttachment[] = [];
  if (file && file.kind !== "image" && file.scope === "library") {
    initialAttachments.push({ fileId: file.id, name: file.name, status: file.status === "indexed" ? "indexed" : file.status === "failed" ? "failed" : "indexing" });
  }
  return (
    <ChatView
      key={`${attach ?? "new"}-${project?.id ?? ""}`}
      conversationId={null}
      initialThread={[]}
      greetingName={settings.nickname || firstName(user.name)}
      initialAttachments={initialAttachments}
      project={project ? { id: project.id, name: project.name } : null}
      voiceAvailable={voiceConfigured()}
    />
  );
}
