import "server-only";
import type { ConversationRecord, ThreadMessage } from "./repository";
import type { ConversationDto, ThreadMessageDto } from "./types";

export function toThreadDto(messages: ThreadMessage[]): ThreadMessageDto[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    parentId: message.parentId,
    status: message.status,
    feedback: message.feedback,
    attachments: message.attachments,
    citations: message.citations,
    artifacts: message.artifacts,
    errorMessage: message.errorMessage,
    createdAt: message.createdAt.toISOString(),
    siblingIndex: message.siblingIndex,
    siblingCount: message.siblingCount,
    siblingIds: message.siblingIds,
  }));
}

export function toConversationDto(conversations: ConversationRecord[]): ConversationDto[] {
  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinned,
    projectId: conversation.projectId,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  }));
}
