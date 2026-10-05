"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProject } from "@/lib/projects/repository";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { deleteConversation, renameConversation, setConversationPinned, setConversationProject, setMessageFeedback } from "./repository";
import { deleteConversationFiles } from "@/lib/files/service";
import { switchBranch } from "./service";
import { conversationIdSchema, feedbackSchema, moveSchema, pinSchema, renameSchema, switchBranchSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC = "Something went wrong on our side. Please try again.";

export async function renameConversationAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const renamed = await renameConversation(user.id, parsed.data.conversationId, parsed.data.title);
    if (!renamed) return { ok: false, message: "That conversation was not found." };
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[chat] rename failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function pinConversationAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const pinned = await setConversationPinned(user.id, parsed.data.conversationId, parsed.data.pinned);
    if (!pinned) return { ok: false, message: "That conversation was not found." };
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[chat] pin failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function moveConversationAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    if (parsed.data.projectId && !(await getProject(user.id, parsed.data.projectId))) return { ok: false, message: "That project was not found." };
    const moved = await setConversationProject(user.id, parsed.data.conversationId, parsed.data.projectId);
    if (!moved) return { ok: false, message: "That conversation was not found." };
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[chat] move failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function deleteConversationAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const deleted = await deleteConversation(user.id, parsed.data.conversationId);
    if (deleted) await deleteConversationFiles(user.id, parsed.data.conversationId);
  } catch (error) {
    console.error("[chat] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath("/app", "layout");
  redirect(workspaceRoutes.home);
}

export async function messageFeedbackAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const saved = await setMessageFeedback(user.id, parsed.data.messageId, parsed.data.feedback);
    if (!saved) return { ok: false, message: "That message was not found." };
    return { ok: true };
  } catch (error) {
    console.error("[chat] feedback failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function switchBranchAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = switchBranchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const switched = await switchBranch(user.id, parsed.data.conversationId, parsed.data.messageId);
    if (!switched) return { ok: false, message: "That message was not found." };
    revalidatePath(workspaceRoutes.chat(parsed.data.conversationId));
    return { ok: true };
  } catch (error) {
    console.error("[chat] switch branch failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}
