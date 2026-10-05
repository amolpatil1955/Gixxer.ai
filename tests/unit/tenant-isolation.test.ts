import { Types } from "mongoose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createBot, getBot, getLiveBotByKey, listBots, updateBot } from "@/lib/bots/repository";
import { addTextSource } from "@/lib/bots/service";
import { createConversation, createMessage, getConversation, listConversations, listMessages } from "@/lib/chat/repository";
import { loadThread, runTurn } from "@/lib/chat/service";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";
import { BotModel, BotSourceModel, ChunkModel, ConversationModel, FileModel, MessageModel } from "@/lib/db/models/workspace.models";
import { getFile, listFiles } from "@/lib/files/repository";
import { processFile, uploadFile } from "@/lib/files/service";
import { retrieveChunks } from "@/lib/knowledge/index";
import { applyPlugins } from "@/lib/plugins/apply";

/**
 * Integration tests against a real MongoDB (see tests/setup/env.ts). They
 * are skipped, loudly, when no database is reachable. Providers are mocked.
 */
const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[tenant-isolation.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

const alice = new Types.ObjectId().toString();
const bob = new Types.ObjectId().toString();

describe.runIf(dbAvailable)("tenant isolation (MongoDB)", () => {
  beforeEach(async () => {
    await Promise.all([
      ConversationModel.deleteMany({}),
      MessageModel.deleteMany({}),
      FileModel.deleteMany({}),
      ChunkModel.deleteMany({}),
      BotModel.deleteMany({}),
      BotSourceModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await disconnectFromDatabase();
  });

  it("keeps conversations and messages to their owner", async () => {
    const conversation = await createConversation(alice, "Alice's chat");
    await createMessage(alice, { conversationId: conversation.id, role: "user", content: "secret", parentId: null });

    expect(await getConversation(bob, conversation.id)).toBeNull();
    expect(await listConversations(bob)).toEqual([]);
    expect(await listMessages(bob, conversation.id)).toEqual([]);
    expect(await loadThread(bob, conversation.id)).toBeNull();
    expect((await loadThread(alice, conversation.id))?.thread.map((message) => message.content)).toEqual(["secret"]);
  });

  it("keeps files and their chunks to their owner", async () => {
    const file = await uploadFile(alice, { name: "notes.txt", mime: "text/plain", bytes: Buffer.from("The warehouse code is 4471. Opening hours are 9 to 5.") });
    await processFile(alice, file.id);

    expect((await getFile(alice, file.id))?.status).toBe("indexed");
    expect(await getFile(bob, file.id)).toBeNull();
    expect(await listFiles(bob)).toEqual([]);
    expect(await retrieveChunks(bob, { fileIds: [file.id] }, "warehouse code")).toEqual([]);
    expect((await retrieveChunks(alice, { fileIds: [file.id] }, "warehouse code"))[0]?.text).toContain("4471");
  });

  it("answers from an attached file and records the citation", async () => {
    const file = await uploadFile(alice, { name: "policy.txt", mime: "text/plain", bytes: Buffer.from("Refunds are accepted within 30 days of purchase with a receipt.") });
    await processFile(alice, file.id);

    const events = [];
    for await (const event of runTurn(alice, { kind: "send", content: "What is the refund window?", attachmentIds: [file.id], think: false }, new AbortController().signal)) events.push(event);
    const done = events.find((event) => event.type === "done");
    expect(done).toEqual({ type: "done", status: "complete" });
    const meta = events.find((event) => event.type === "meta");
    expect(meta?.type).toBe("meta");
    const text = events.filter((event) => event.type === "token").map((event) => (event.type === "token" ? event.text : "")).join("");
    expect(text).toContain("using 1 source");
    const citations = events.find((event) => event.type === "citations");
    expect(citations?.type === "citations" && citations.items[0]?.fileName).toBe("policy.txt");
  });

  it("keeps a chat's files inside that chat, out of the library and out of other chats", async () => {
    // One file in the library, one attached to a chat. Both belong to Alice.
    const shared = await uploadFile(alice, { name: "handbook.txt", mime: "text/plain", bytes: Buffer.from("Everyone gets 25 days of paid leave each year.") });
    await processFile(alice, shared.id);
    const first = await createConversation(alice, "First chat");
    const private_ = await uploadFile(alice, {
      name: "offer.txt",
      mime: "text/plain",
      bytes: Buffer.from("The acquisition price discussed with Northwind is 4.2 million euro."),
      scope: "chat",
      conversationId: first.id,
    });
    await processFile(alice, private_.id);

    // The library listing and the library-wide plugin only ever see the library file.
    expect((await listFiles(alice, { scopes: ["library"] })).map((file) => file.name)).toEqual(["handbook.txt"]);
    const retrieved = await retrieveChunks(alice, { allFiles: true }, "acquisition price Northwind");
    expect(retrieved.map((chunk) => chunk.sourceName)).not.toContain("offer.txt");
    const plugins = await applyPlugins(["library"], { userId: alice, question: "What is the acquisition price?", excludeFileIds: [] });
    expect(plugins.system.join(" ")).not.toContain("4.2 million");

    // Attaching it to a different chat is refused, so it cannot be carried across.
    const second = await createConversation(alice, "Second chat");
    await expect(
      (async () => {
        // The generator rejects on its first event, before anything is written.
        const turn = runTurn(alice, { kind: "send", conversationId: second.id, content: "What was the price?", attachmentIds: [private_.id], think: false }, new AbortController().signal);
        await turn.next();
      })(),
    ).rejects.toThrow(/another chat/);

    // In its own chat it still answers.
    const events = [];
    for await (const event of runTurn(alice, { kind: "send", conversationId: first.id, content: "What was the price?", attachmentIds: [private_.id], think: false }, new AbortController().signal)) events.push(event);
    expect(events.find((event) => event.type === "done")).toEqual({ type: "done", status: "complete" });
    expect(events.filter((event) => event.type === "citations").length).toBe(1);
  });

  it("keeps a generated document in the chat that made it", async () => {
    const events = [];
    for await (const event of runTurn(alice, { kind: "send", content: "Create a PDF about warehouse safety", attachmentIds: [], think: false }, new AbortController().signal)) events.push(event);
    const artifact = events.find((event) => event.type === "artifact");
    expect(artifact?.type).toBe("artifact");
    const made = artifact?.type === "artifact" ? artifact.item : null;
    expect(made?.kind).toBe("file");
    // It is a file of that chat, not of the library, so the library-wide plugin never reads it.
    const record = made ? await getFile(alice, made.refId) : null;
    expect(record?.scope).toBe("chat");
    expect(record?.conversationId).not.toBeNull();
    expect((await listFiles(alice, { scopes: ["library"] })).map((file) => file.id)).not.toContain(made?.refId);
  });

  it("keeps bots, their knowledge and their public key to their owner", async () => {
    const bot = await createBot(alice, "Aria");
    await addTextSource(alice, bot.id, { name: "Hours", text: "We are open 9am to 6pm Monday to Saturday and closed on Sunday." });

    expect(await getBot(bob, bot.id)).toBeNull();
    expect(await listBots(bob)).toEqual([]);
    expect(await updateBot(bob, bot.id, { name: "Hacked" })).toBe(false);
    expect((await getBot(alice, bot.id))?.name).toBe("Aria");

    // Bob cannot retrieve Alice's bot knowledge even with the bot id.
    expect(await retrieveChunks(bob, { botId: bot.id }, "open Sunday")).toEqual([]);
    expect((await retrieveChunks(alice, { botId: bot.id }, "open Sunday"))[0]?.sourceName).toBe("Hours");

    // A draft bot is invisible to the public; a live one resolves to its owner.
    expect(await getLiveBotByKey(bot.publicKey)).toBeNull();
    await updateBot(alice, bot.id, { status: "live" });
    expect((await getLiveBotByKey(bot.publicKey))?.ownerId).toBe(alice);
    expect(await getLiveBotByKey("gx_not-a-real-key-000000")).toBeNull();
  });
});
