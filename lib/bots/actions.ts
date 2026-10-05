"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { aiRateLimits, retryMessage } from "@/lib/security/ai-rate-limits";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { createBot, getBot, updateBot } from "./repository";
import { advanceSource, addFileSource, addTextSource, addUrlSource, addWebsiteSource, deleteBot, recrawlSource, removeSource, SourceError } from "./service";
import { USE_CASES, type BotUseCase } from "./constants";
import { themeFor } from "./themes";
import type { SourceDto } from "./types";
import { toSourceDto } from "./serialize";
import {
  advanceSourceSchema,
  appearanceSchema,
  behaviorSchema,
  botIdSchema,
  createBotSchema,
  fileSourceSchema,
  instructionsSchema,
  settingsSchema,
  sourceIdSchema,
  publishSchema,
  statusSchema,
  textSourceSchema,
  themeSchema,
  urlSourceSchema,
  websiteSourceSchema,
} from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const GENERIC = "Something went wrong on our side. Please try again.";

function invalid(issues: { path: PropertyKey[]; message: string }[]): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, message: issues[0]?.message ?? "Please check the form.", fieldErrors };
}

export async function createBotAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createBotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  let botId: string;
  try {
    const bot = await createBot(user.id, parsed.data.name);
    botId = bot.id;
    // The use case seeds the greeting, the instructions and the suggested questions.
    const useCase = (parsed.data.useCase ?? "support") as BotUseCase;
    const detail = USE_CASES[useCase];
    await updateBot(user.id, botId, {
      useCase,
      welcomeMessage: detail.welcome,
      instructions: detail.instructions,
      suggestedQuestions: detail.questions,
    });
  } catch (error) {
    console.error("[bots] create failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbots);
  redirect(workspaceRoutes.chatbots);
}

/** Creates a bot from the wizard and hands its id back, so the wizard can keep going. */
export async function createBotForWizardAction(input: unknown): Promise<ActionResult & { botId?: string }> {
  const user = await requireUser();
  const parsed = createBotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const bot = await createBot(user.id, parsed.data.name);
    const useCase = (parsed.data.useCase ?? "support") as BotUseCase;
    const detail = USE_CASES[useCase];
    await updateBot(user.id, bot.id, {
      useCase,
      welcomeMessage: detail.welcome,
      instructions: detail.instructions,
      suggestedQuestions: detail.questions,
    });
    revalidatePath(workspaceRoutes.chatbots);
    return { ok: true, botId: bot.id };
  } catch (error) {
    console.error("[bots] create failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function updateThemeAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { botId, preset, position, accent } = parsed.data;
  return applyPatch(user.id, botId, { "theme.preset": themeFor(preset).key, "theme.position": position, "theme.accent": accent });
}

/** Go live and record that the wizard finished. */
export async function publishBotAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return applyPatch(user.id, parsed.data.botId, { status: "live", publishedAt: new Date() });
}

export async function addWebsiteSourceAction(input: unknown): Promise<ActionResult & { source?: SourceDto }> {
  const user = await requireUser();
  const parsed = websiteSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  const budget = await aiRateLimits.sourceFetchByUser.consume(`crawl:${user.id}`);
  if (!budget.allowed) return { ok: false, message: retryMessage(budget.retryAfterSeconds) };
  try {
    const source = await addWebsiteSource(user.id, parsed.data.botId, parsed.data.url);
    revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
    if (source.status === "failed") return { ok: false, message: source.error ?? "That website could not be crawled.", fieldErrors: { url: source.error ?? "" }, source: toSourceDto(source) };
    return { ok: true, source: toSourceDto(source) };
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, message: error.message, fieldErrors: { url: error.message } };
    console.error("[bots] website source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

/** One step of a crawl, driven by the owner's open knowledge screen. */
export async function advanceSourceAction(input: unknown): Promise<ActionResult & { source?: SourceDto }> {
  const user = await requireUser();
  const parsed = advanceSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const source = await advanceSource(user.id, parsed.data.botId, parsed.data.sourceId);
    if (!source) return { ok: false, message: "That source was not found." };
    if (source.status === "indexed" || source.status === "failed") revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
    return { ok: true, source: toSourceDto(source) };
  } catch (error) {
    console.error("[bots] advance source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function recrawlSourceAction(input: unknown): Promise<ActionResult & { source?: SourceDto }> {
  const user = await requireUser();
  const parsed = advanceSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const budget = await aiRateLimits.sourceFetchByUser.consume(`crawl:${user.id}`);
  if (!budget.allowed) return { ok: false, message: retryMessage(budget.retryAfterSeconds) };
  try {
    const source = await recrawlSource(user.id, parsed.data.botId, parsed.data.sourceId);
    if (!source) return { ok: false, message: "That source was not found." };
    revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
    return { ok: true, source: toSourceDto(source) };
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, message: error.message };
    console.error("[bots] recrawl failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

async function applyPatch(userId: string, botId: string, patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    const updated = await updateBot(userId, botId, patch);
    if (!updated) return { ok: false, message: "That bot was not found." };
  } catch (error) {
    console.error("[bots] update failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(`/app/chatbots/${botId}`, "layout");
  return { ok: true };
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { botId, ...patch } = parsed.data;
  return applyPatch(user.id, botId, patch);
}

export async function updateInstructionsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = instructionsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { botId, ...patch } = parsed.data;
  return applyPatch(user.id, botId, patch);
}

export async function updateAppearanceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { botId, avatarLetter, accent, position } = parsed.data;
  return applyPatch(user.id, botId, { avatarLetter, "theme.accent": accent, "theme.position": position });
}

export async function updateBehaviorAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = behaviorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { botId, collectLeads, citeSources, knowledgeOnly } = parsed.data;
  return applyPatch(user.id, botId, { "behavior.collectLeads": collectLeads, "behavior.citeSources": citeSources, "behavior.knowledgeOnly": knowledgeOnly });
}

export async function setBotStatusAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return applyPatch(user.id, parsed.data.botId, { status: parsed.data.status });
}

export async function deleteBotAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = botIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await deleteBot(user.id, parsed.data.botId);
  } catch (error) {
    console.error("[bots] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbots);
  redirect(workspaceRoutes.chatbots);
}

async function ownedBot(userId: string, botId: string): Promise<ActionResult | null> {
  const bot = await getBot(userId, botId);
  return bot ? null : { ok: false, message: "That bot was not found." };
}

/** Returns the source it made, so the screen can show it without waiting for a refresh. */
export async function addTextSourceAction(input: unknown): Promise<ActionResult & { source?: SourceDto }> {
  const user = await requireUser();
  const parsed = textSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  let created;
  try {
    created = await addTextSource(user.id, parsed.data.botId, { name: parsed.data.name, text: parsed.data.text });
  } catch (error) {
    console.error("[bots] text source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  return { ok: true, source: toSourceDto(created) };
}

export async function addUrlSourceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = urlSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  const budget = await aiRateLimits.sourceFetchByUser.consume(`source:${user.id}`);
  if (!budget.allowed) return { ok: false, message: retryMessage(budget.retryAfterSeconds) };
  try {
    const source = await addUrlSource(user.id, parsed.data.botId, parsed.data.url);
    if (source.status === "failed") return { ok: false, message: source.error ?? "That page could not be added.", fieldErrors: { url: source.error ?? "" } };
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, message: error.message, fieldErrors: { url: error.message } };
    console.error("[bots] url source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  return { ok: true };
}

export async function addFileSourceAction(input: unknown): Promise<ActionResult & { source?: SourceDto }> {
  const user = await requireUser();
  const parsed = fileSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  let created;
  try {
    created = await addFileSource(user.id, parsed.data.botId, parsed.data.fileId);
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, message: error.message };
    console.error("[bots] file source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  if (created.status === "failed") return { ok: false, message: created.error ?? "That file could not be read.", source: toSourceDto(created) };
  return { ok: true, source: toSourceDto(created) };
}

export async function removeSourceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = sourceIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const removed = await removeSource(user.id, parsed.data.botId, parsed.data.sourceId);
    if (!removed) return { ok: false, message: "That source was not found." };
  } catch (error) {
    console.error("[bots] remove source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  return { ok: true };
}
