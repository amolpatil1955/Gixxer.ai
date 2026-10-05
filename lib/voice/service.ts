import "server-only";
import { createVoiceSessionToken } from "@/lib/ai/manager";
import type { ChatTurn } from "@/lib/ai/types";
import { createConversation, createMessage, getConversation, listMessages, setActiveLeaf, threadFor } from "@/lib/chat/repository";
import { ChatError, SYSTEM_PROMPT, standingInstructions, titleFrom, toTurns } from "@/lib/chat/service";
import { getProject } from "@/lib/projects/repository";
import type { VoiceSessionDto, VoiceTurnDto } from "./types";
import type { VoiceSessionInput, VoiceTurnInput } from "./validation";

/*
 * The voice assistant is the chat, spoken. A session is opened for the current
 * conversation (or one that does not exist yet), carries that conversation's
 * context into the model's instructions, and every finished exchange is written
 * back as an ordinary user message and assistant message, so the text chat and
 * the voice window are one history.
 *
 * Nothing here talks to a model. The provider manager mints the short-lived
 * token; this module decides what the session is allowed to know.
 */

const VOICE_HISTORY_CHARS = 6_000;
const VOICE_HISTORY_TURNS = 12;

/** How the assistant should behave when its words are heard rather than read. */
export const VOICE_GUIDANCE = `You are now in a spoken conversation. Your words are turned into speech, so:
- Talk the way a thoughtful person talks on the phone: one to three short sentences unless the user asks for more.
- No Markdown, no lists, no code, no URLs read aloud. Say numbers and names plainly.
- Answer first, then offer one more step if useful. Ask one question at a time.
- If the user starts speaking while you are talking, stop at once and listen.
- Never mention that you are a model, which company made you, or how this call works.`;

/** The instruction a voice session is locked to: Gixxer's rules, the user's standing context, and the chat so far. */
export function voiceInstruction(standing: string[], history: ChatTurn[]): string {
  const parts = [SYSTEM_PROMPT, VOICE_GUIDANCE];
  if (standing.length) parts.push(standing.join("\n\n"));
  const recent = history.slice(-VOICE_HISTORY_TURNS);
  if (recent.length) {
    let budget = VOICE_HISTORY_CHARS;
    const lines: string[] = [];
    for (let index = recent.length - 1; index >= 0 && budget > 0; index--) {
      const turn = recent[index]!;
      const text = turn.content.replace(/\s+/g, " ").trim();
      const clipped = text.length > budget ? `${text.slice(0, budget)}…` : text;
      budget -= clipped.length;
      lines.unshift(`${turn.role === "user" ? "User" : "You"}: ${clipped}`);
    }
    parts.push(`The conversation so far, continue from it naturally:\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

/** Opens a voice session for the owner's conversation. The token it returns can open one session, once. */
export async function openVoiceSession(userId: string, input: VoiceSessionInput): Promise<VoiceSessionDto> {
  let projectId: string | null = null;
  let history: ChatTurn[] = [];
  let conversationId: string | null = null;

  if (input.conversationId) {
    const conversation = await getConversation(userId, input.conversationId);
    if (!conversation) throw new ChatError("not_found", "That conversation was not found.");
    conversationId = conversation.id;
    projectId = conversation.projectId;
    const messages = await listMessages(userId, conversation.id);
    history = toTurns(threadFor(messages, conversation.activeLeafId));
  } else if (input.projectId) {
    const project = await getProject(userId, input.projectId);
    if (!project) throw new ChatError("not_found", "That project was not found.");
    projectId = project.id;
  }

  const standing = await standingInstructions(userId, projectId);
  const minted = await createVoiceSessionToken({ systemInstruction: voiceInstruction(standing, history) });
  if (minted.mock) return { mock: true, conversationId };
  return { mock: false, token: minted.token, model: minted.model, newSessionExpiresAt: minted.newSessionExpiresAt, conversationId };
}

/**
 * Writes one spoken exchange into the chat. A conversation is created on the
 * first exchange of a new chat, titled from what the user said, so the sidebar
 * and the text view pick it up exactly as they would a typed message.
 */
export async function recordVoiceTurn(userId: string, input: VoiceTurnInput): Promise<VoiceTurnDto> {
  let conversation = input.conversationId ? await getConversation(userId, input.conversationId) : null;
  if (input.conversationId && !conversation) throw new ChatError("not_found", "That conversation was not found.");
  if (!conversation) {
    const project = input.projectId ? await getProject(userId, input.projectId) : null;
    if (input.projectId && !project) throw new ChatError("not_found", "That project was not found.");
    conversation = await createConversation(userId, titleFrom(input.userText), project?.id ?? null);
  }

  const user = await createMessage(userId, { conversationId: conversation.id, role: "user", content: input.userText, parentId: conversation.activeLeafId });
  const assistant = await createMessage(userId, {
    conversationId: conversation.id,
    role: "assistant",
    content: input.assistantText,
    parentId: user.id,
    // An exchange the user cut off before a reply is kept as stopped, the way a stopped stream is.
    status: input.assistantText ? "complete" : "stopped",
    provider: "voice",
  });
  await setActiveLeaf(userId, conversation.id, assistant.id);
  return { conversationId: conversation.id, userMessageId: user.id, assistantMessageId: assistant.id, title: conversation.title };
}
