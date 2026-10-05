import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/** Opening a voice session for the current chat (or a chat that does not exist yet). */
export const voiceSessionSchema = z.object({
  conversationId: objectId.optional(),
  /** Start the chat inside a project when the conversation does not exist yet. */
  projectId: objectId.optional(),
});

export const VOICE_TEXT_MAX = 16_000;

/** One spoken exchange, written into the chat once both sides have finished. */
export const voiceTurnSchema = z.object({
  conversationId: objectId.optional(),
  projectId: objectId.optional(),
  userText: z.string().trim().min(1, "Nothing was said").max(VOICE_TEXT_MAX),
  assistantText: z.string().trim().max(VOICE_TEXT_MAX).default(""),
});

export type VoiceSessionInput = z.infer<typeof voiceSessionSchema>;
export type VoiceTurnInput = z.infer<typeof voiceTurnSchema>;
