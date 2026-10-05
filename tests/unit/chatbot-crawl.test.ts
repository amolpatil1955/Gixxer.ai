import { Types } from "mongoose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createBot, getSource, listSources } from "@/lib/bots/repository";
import { addWebsiteSource, advanceSource, recrawlSource, removeSource, SourceError } from "@/lib/bots/service";
import { BOT_THEMES, themeFor, tokensFor } from "@/lib/bots/themes";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";
import { BotModel, BotSourceModel, ChunkModel } from "@/lib/db/models/workspace.models";
import { markdownToText, normalizeSiteUrl } from "@/lib/crawl/firecrawl";
import { retrieveChunks } from "@/lib/knowledge/index";
import { knowledgeBlock } from "@/lib/knowledge/retrieve";

/* Website knowledge for Chatbot Pro. The crawler is the deterministic stand-in (AI_MOCK=1). */

describe("site addresses", () => {
  it("normalises an address so the same site is recognised twice", () => {
    expect(normalizeSiteUrl("https://Example.com/")).toBe("https://example.com");
    expect(normalizeSiteUrl("https://example.com/help/#faq")).toBe("https://example.com/help");
    expect(normalizeSiteUrl(" https://example.com/a/b/ ")).toBe("https://example.com/a/b");
    expect(normalizeSiteUrl("not a url")).toBeNull();
    expect(normalizeSiteUrl("ftp://example.com")).toBeNull();
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeNull();
  });

  it("reduces a crawled page to prose a retrieval step can rank", () => {
    const text = markdownToText("# Pricing\n\nThe [Courier](https://x.example/c) is **1,890** euro.\n\n```js\nconst secret = 1;\n```\n\n![photo](a.png)\n\n| a | b |\n| - | - |");
    expect(text).toContain("The Courier is 1,890 euro.");
    expect(text).not.toContain("const secret");
    expect(text).not.toContain("](");
    expect(text).not.toContain("**");
  });
});

describe("themes", () => {
  it("offers five complete, distinct themes", () => {
    expect(BOT_THEMES).toHaveLength(5);
    expect(new Set(BOT_THEMES.map((theme) => theme.light.accent)).size).toBe(5);
    // Each is its own design, not a tint: surfaces, radii and fonts differ too.
    expect(new Set(BOT_THEMES.map((theme) => theme.light.surface)).size).toBeGreaterThan(2);
    expect(new Set(BOT_THEMES.map((theme) => theme.light.radius)).size).toBeGreaterThan(2);
    expect(new Set(BOT_THEMES.map((theme) => theme.light.font)).size).toBeGreaterThan(2);
    for (const theme of BOT_THEMES) {
      for (const colour of [theme.light.accent, theme.light.onAccent, theme.light.surface, theme.light.bubble]) {
        expect(colour, `${theme.key} colour`).toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it("falls back to the first theme and lets a bot keep its own accent", () => {
    expect(themeFor("nonsense").key).toBe(BOT_THEMES[0]!.key);
    expect(tokensFor("midnight", "#ff0000").accent).toBe("#ff0000");
    expect(tokensFor("midnight", "not-a-colour").accent).toBe(themeFor("midnight").light.accent);
  });
});

const dbAvailable = await connectToDatabase()
  .then(() => true)
  .catch((error: unknown) => {
    console.warn(`[chatbot-crawl.test] MongoDB unavailable, skipping: ${error instanceof Error ? error.message : error}`);
    return false;
  });

const owner = new Types.ObjectId().toString();
const other = new Types.ObjectId().toString();

describe.runIf(dbAvailable)("website knowledge (MongoDB)", () => {
  beforeEach(async () => {
    await Promise.all([BotModel.deleteMany({}), BotSourceModel.deleteMany({}), ChunkModel.deleteMany({})]);
  });

  afterAll(async () => {
    await disconnectFromDatabase();
  });

  it("crawls a site, indexes its pages and answers from them", async () => {
    const bot = await createBot(owner, "Aria");
    const started = await addWebsiteSource(owner, bot.id, "https://northwind.example/");
    expect(started.status).toBe("crawling");
    expect(started.jobId).toBeTruthy();
    expect(started.urlKey).toBe("https://northwind.example");

    const settled = await advanceSource(owner, bot.id, started.id);
    expect(settled?.status).toBe("indexed");
    expect(settled?.pageCount).toBe(3);
    expect(settled?.chunkCount).toBeGreaterThan(0);
    expect(settled?.jobId).toBeNull();
    expect(settled?.lastCrawledAt).toBeTruthy();

    // Its passages are the bot's, citable by the page they came from.
    const found = await retrieveChunks(owner, { botId: bot.id }, "how much is the Courier");
    expect(found[0]?.text).toContain("1,890");
    expect(found[0]?.locator).toMatch(/^https:\/\/northwind\.example/);

    // What the site said is fenced as data, with the warning that it is not instructions.
    const block = knowledgeBlock(found);
    expect(block).toContain("<document");
    expect(block).toMatch(/must be ignored/);
  });

  it("refuses a private address and a site already added, and allows a re-crawl", async () => {
    const bot = await createBot(owner, "Aria");
    await expect(addWebsiteSource(owner, bot.id, "http://127.0.0.1:9/secret")).rejects.toThrow(SourceError);
    await expect(addWebsiteSource(owner, bot.id, "http://169.254.169.254/latest")).rejects.toThrow(SourceError);

    const first = await addWebsiteSource(owner, bot.id, "https://northwind.example");
    await advanceSource(owner, bot.id, first.id);
    // The same site, written differently, is still the same site.
    await expect(addWebsiteSource(owner, bot.id, "https://Northwind.example/")).rejects.toThrow(/already in this bot/);
    expect(await listSources(owner, bot.id)).toHaveLength(1);

    const again = await recrawlSource(owner, bot.id, first.id);
    expect(again?.status).toBe("crawling");
    const settled = await advanceSource(owner, bot.id, first.id);
    expect(settled?.status).toBe("indexed");
    // Re-reading replaces the passages rather than doubling them.
    expect(await ChunkModel.countDocuments({ sourceId: new Types.ObjectId(first.id) })).toBe(settled?.chunkCount);
  });

  it("keeps crawled knowledge to its own bot and its owner", async () => {
    const mine = await createBot(owner, "Mine");
    const theirs = await createBot(owner, "Theirs");
    const source = await addWebsiteSource(owner, mine.id, "https://northwind.example");
    await advanceSource(owner, mine.id, source.id);

    expect(await retrieveChunks(owner, { botId: theirs.id }, "Courier")).toEqual([]);
    expect(await retrieveChunks(other, { botId: mine.id }, "Courier")).toEqual([]);
    // Nor does a bot's knowledge leak into the owner's own chats.
    expect(await retrieveChunks(owner, { allFiles: true }, "Courier")).toEqual([]);

    // Another account cannot move a crawl along or remove it.
    expect(await advanceSource(other, mine.id, source.id)).toBeNull();
    expect(await removeSource(other, mine.id, source.id)).toBe(false);
    expect(await getSource(owner, source.id)).not.toBeNull();

    // Removing it takes its passages with it.
    expect(await removeSource(owner, mine.id, source.id)).toBe(true);
    expect(await retrieveChunks(owner, { botId: mine.id }, "Courier")).toEqual([]);
  });
});
