"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { aiRateLimits, retryMessage } from "@/lib/security/ai-rate-limits";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { createBot, getBot, updateBot } from "./repository";
import { addFileSource, addTextSource, addUrlSource, deleteBot, removeSource, SourceError } from "./service";
import {
  appearanceSchema,
  behaviorSchema,
  botIdSchema,
  createBotSchema,
  fileSourceSchema,
  instructionsSchema,
  settingsSchema,
  sourceIdSchema,
  statusSchema,
  textSourceSchema,
  urlSourceSchema,
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
  } catch (error) {
    console.error("[bots] create failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbots);
  redirect(workspaceRoutes.chatbot(botId, "knowledge"));
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

export async function addTextSourceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = textSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  try {
    await addTextSource(user.id, parsed.data.botId, { name: parsed.data.name, text: parsed.data.text });
  } catch (error) {
    console.error("[bots] text source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  return { ok: true };
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

export async function addFileSourceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = fileSourceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const missing = await ownedBot(user.id, parsed.data.botId);
  if (missing) return missing;
  try {
    await addFileSource(user.id, parsed.data.botId, parsed.data.fileId);
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, message: error.message };
    console.error("[bots] file source failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.chatbot(parsed.data.botId, "knowledge"));
  return { ok: true };
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
