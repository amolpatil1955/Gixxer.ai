import { Types } from "mongoose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createVoiceSessionToken, voiceConfigured } from "@/lib/ai/manager";
import { createConversation, createMessage, listMessages } from "@/lib/chat/repository";
import { loadThread } from "@/lib/chat/service";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";
import { ConversationModel, MessageModel } from "@/lib/db/models/workspace.models";
import { openVoiceSession, recordVoiceTurn, voiceInstruction, VOICE_GUIDANCE } from "@/lib/voice/service";
import { voiceSessionSchema, voiceTurnSchema } from "@/lib/voice/validation";

/* The voice assistant. Providers are mocked (AI_MOCK=1), so no token is ever minted here. */

describe("voice session instruction", () => {
  it("carries Gixxer's rules, the spoken guidance and the chat so far", () => {
    const instruction = voiceInstruction(["Address the user as Captain."], [
      { role: "user", content: "What is our refund window?" },
      { role: "assistant", content: "Thirty days with a receipt." },
    ]);
    expect(instruction).toContain("You are Gixxer");
    expect(instruction).toContain(VOICE_GUIDANCE);
    expect(instruction).toContain("Address the user as Captain.");
    expect(instruction).toContain("User: What is our refund window?");
    expect(instruction).toContain("You: Thirty days with a receipt.");
  });

  it("tells the assistant to speak plainly and to yield when interrupted", () => {
    expect(VOICE_GUIDANCE).toMatch(/No Markdown/);
    expect(VOICE_GUIDANCE).toMatch(/stop at once and listen/);
    // The privacy rule still holds out loud.
    expect(VOICE_GUIDANCE).toMatch(/Never mention that you are a model/);
  });

  it("keeps the spoken history bounded", () => {
    const long = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 === 0 ? ("user" as const) : ("assistant" as const), content: "word ".repeat(400) }));
    const instruction = voiceInstruction([], long);
    expect(instruction.length).toBeLessThan(12_000);
  });
});

describe("voice validation", () => {
  it("accepts an empty body for a chat that does not exist yet and refuses bad ids", () => {
    expect(voiceSessionSchema.safeParse({}).success).toBe(true);
    expect(voiceSessionSchema.safeParse({ conversationId: "a".repeat(24) }).success).toBe(true);
    expect(voiceSessionSchema.safeParse({ conversationId: "nope" }).success).toBe(false);
  });

  it("requires something to have been said, and allows an answer cut short" , () => {
    expect(voiceTurnSchema.safeParse({ userText: " ", assistantText: "hi" }).success).toBe(false);
    const parsed = voiceTurnSchema.safeParse({ userText: "Hello there" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.assistantText).toBe("");
    expect(voiceTurnSchema.safeParse({ userText: "x".repeat(16_001) }).success).toBe(false);
  });
});

describe("voice provider", () => {
  it("is available under the mock and never hands out a key", async () => {
    expect(voiceConfigured()).toBe(true);
    const minted = await createVoiceSessionToken({ systemInstruction: "be brief" });
    expect(minted).toEqual({ mock: true });
  });
});

const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[voice.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

const owner = new Types.ObjectId().toString();
const other = new Types.ObjectId().toString();

describe.runIf(dbAvailable)("voice turns (MongoDB)", () => {
  // Only this file's accounts: the suites share one database and run in parallel.
  const own = { userId: { $in: [new Types.ObjectId(owner), new Types.ObjectId(other)] } };

  beforeEach(async () => {
    await Promise.all([ConversationModel.deleteMany(own), MessageModel.deleteMany(own)]);
  });
  afterAll(async () => {
    await disconnectFromDatabase();
  });

  it("starts a chat from the first spoken exchange and keeps answering into it", async () => {
    const first = await recordVoiceTurn(owner, { userText: "Remind me what we sell", assistantText: "Refurbished cargo bikes." });
    expect(first.conversationId).toBeTruthy();
    expect(first.title).toBe("Remind me what we sell");

    const second = await recordVoiceTurn(owner, { conversationId: first.conversationId, userText: "And the price?", assistantText: "From 1,340 euro." });
    expect(second.conversationId).toBe(first.conversationId);

    // Both exchanges are ordinary messages on one branch, so the text view shows the conversation.
    const thread = await loadThread(owner, first.conversationId);
    expect(thread?.thread.map((message) => message.content)).toEqual([
      "Remind me what we sell",
      "Refurbished cargo bikes.",
      "And the price?",
      "From 1,340 euro.",
    ]);
  });

  it("keeps an answer the user cut off, marked stopped", async () => {
    const turn = await recordVoiceTurn(owner, { userText: "Tell me about the warranty", assistantText: "" });
    const messages = await listMessages(owner, turn.conversationId);
    const assistant = messages.find((message) => message.role === "assistant");
    expect(assistant?.status).toBe("stopped");
    expect(assistant?.content).toBe("");
  });

  it("refuses another account's conversation, for both the session and the turn", async () => {
    const conversation = await createConversation(owner, "Owner's chat");
    await createMessage(owner, { conversationId: conversation.id, role: "user", content: "secret", parentId: null });

    await expect(openVoiceSession(other, { conversationId: conversation.id })).rejects.toThrow(/not found/);
    await expect(recordVoiceTurn(other, { conversationId: conversation.id, userText: "steal", assistantText: "" })).rejects.toThrow(/not found/);
    // The owner's own session opens and sees only their chat.
    const session = await openVoiceSession(owner, { conversationId: conversation.id });
    expect(session).toEqual({ mock: true, conversationId: conversation.id });
    expect((await listMessages(other, conversation.id))).toEqual([]);
  });
});
