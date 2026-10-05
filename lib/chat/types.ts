/** Serialisable chat shapes shared by server pages and client components. */

export type MessageStatusDto = "complete" | "streaming" | "stopped" | "error";

export type FeedbackDto = "up" | "down";

export interface AttachmentDto {
  fileId: string;
  name: string;
}

export interface CitationDto {
  fileId: string;
  fileName: string;
  locator: string;
}

export interface ArtifactDto {
  kind: "image" | "file";
  refId: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  prompt: string;
  preview: string;
}

export interface ThreadMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  parentId: string | null;
  status: MessageStatusDto;
  feedback: FeedbackDto | null;
  attachments: AttachmentDto[];
  citations: CitationDto[];
  artifacts: ArtifactDto[];
  /** Client-only: what the reply is making right now, and since when. */
  working?: "image" | "image-done";
  workingSince?: number;
  errorMessage: string | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblingIds: string[];
}

export interface ConversationDto {
  id: string;
  title: string;
  pinned: boolean;
  projectId: string | null;
  lastMessageAt: string;
}

/** Wire events from POST /api/chat, one JSON object per line. */
export type ChatWireEvent =
  | { type: "meta"; conversationId: string; userMessageId: string; assistantMessageId: string; title: string }
  | { type: "token"; text: string }
  | { type: "citations"; items: CitationDto[] }
  | { type: "artifact"; item: ArtifactDto }
  | { type: "status"; working: "image" }
  | { type: "done"; status: "complete" | "stopped" }
  | { type: "error"; message: string };

