"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { detachConversationsFromProject } from "@/lib/chat/repository";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { createProject, deleteProjectRecord, updateProject } from "./repository";
import { createProjectSchema, projectIdSchema, updateProjectSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC = "Something went wrong on our side. Please try again.";

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  let projectId: string;
  try {
    projectId = (await createProject(user.id, parsed.data.name)).id;
  } catch (error) {
    console.error("[projects] create failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath("/app", "layout");
  redirect(workspaceRoutes.project(projectId));
}

export async function updateProjectAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { projectId, ...patch } = parsed.data;
  try {
    const updated = await updateProject(user.id, projectId, patch);
    if (!updated) return { ok: false, message: "That project was not found." };
  } catch (error) {
    console.error("[projects] update failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteProjectAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const deleted = await deleteProjectRecord(user.id, parsed.data.projectId);
    if (!deleted) return { ok: false, message: "That project was not found." };
    await detachConversationsFromProject(user.id, parsed.data.projectId);
  } catch (error) {
    console.error("[projects] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath("/app", "layout");
  redirect(workspaceRoutes.projects);
}
