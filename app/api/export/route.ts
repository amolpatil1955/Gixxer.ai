import { requireApiUser } from "@/lib/api/respond";
import { listAllMessages, listConversations } from "@/lib/chat/repository";
import { listFiles } from "@/lib/files/repository";
import { listImages } from "@/lib/images/repository";
import { listProjects } from "@/lib/projects/repository";
import { listSchedules } from "@/lib/schedules/repository";
import { getSettings } from "@/lib/settings/repository";

/** Everything the user has typed and made, as one JSON file. Bytes of files and images are not included; their records are. */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const [conversations, messages, files, images, projects, schedules, settings] = await Promise.all([
    listConversations(user.id, 5000),
    listAllMessages(user.id),
    listFiles(user.id, { scopes: ["library", "chat", "bot"], limit: 5000 }),
    listImages(user.id, 5000),
    listProjects(user.id, 5000),
    listSchedules(user.id, 5000),
    getSettings(user.id),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, memberSince: user.createdAt.toISOString() },
    settings,
    projects,
    conversations: conversations.map((conversation) => ({
      ...conversation,
      messages: messages
        .filter((message) => message.conversationId === conversation.id)
        .map(({ id, role, content, parentId, status, feedback, attachments, citations, createdAt }) => ({
          id,
          role,
          content,
          parentId,
          status,
          feedback,
          attachments,
          citations,
          createdAt,
        })),
    })),
    files: files.map(({ id, name, mime, size, kind, status, pages, sheets, createdAt }) => ({ id, name, mime, size, kind, status, pages, sheets, createdAt })),
    images: images.map(({ id, prompt, seed, width, height, model, createdAt }) => ({ id, prompt, seed, width, height, model, createdAt })),
    schedules,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="gixxer-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
