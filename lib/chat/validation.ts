import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 16_000;
export const TITLE_MAX_LENGTH = 120;

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/** An IANA zone name as the browser reports it. Validated properly on the server with Intl. */
export const timeZoneSchema = z.string().trim().max(64).regex(/^[A-Za-z_+\-/0-9]+$/, "Invalid time zone");

export const sendMessageSchema = z.object({
  conversationId: objectId.optional(),
  /** The message this one replies to. Omitted for the first message of a chat. */
  parentId: objectId.nullable().optional(),
  content: z.string().trim().min(1, "Type a message").max(MESSAGE_MAX_LENGTH, "That message is too long"),
  attachmentIds: z.array(objectId).max(8).default([]),
  /** Think mode: a reasoning model thinks first and streams its thinking. */
  think: z.boolean().default(false),
  /** Start the chat inside a project. Ignored for an existing conversation. */
  projectId: objectId.optional(),
  /** The reader's zone, so "today" means their today. */
  timeZone: timeZoneSchema.optional(),
});

/** Produce another assistant reply to an existing user message. */
export const regenerateSchema = z.object({
  conversationId: objectId,
  userMessageId: objectId,
  think: z.boolean().default(false),
  timeZone: timeZoneSchema.optional(),
});

export const chatRequestSchema = z.union([
  z.object({ kind: z.literal("send") }).and(sendMessageSchema),
  z.object({ kind: z.literal("regenerate") }).and(regenerateSchema),
]);

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const renameSchema = z.object({
  conversationId: objectId,
  title: z.string().trim().min(1, "Give it a name").max(TITLE_MAX_LENGTH, "That title is too long"),
});

export const conversationIdSchema = z.object({ conversationId: objectId });

export const pinSchema = z.object({ conversationId: objectId, pinned: z.boolean() });

export const moveSchema = z.object({ conversationId: objectId, projectId: objectId.nullable() });

export const feedbackSchema = z.object({ messageId: objectId, feedback: z.enum(["up", "down"]).nullable() });

export const switchBranchSchema = z.object({
  conversationId: objectId,
  messageId: objectId,
});

export const searchSchema = z.object({ query: z.string().trim().max(200).default("") });

export { objectId as objectIdSchema };
