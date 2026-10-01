"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { deleteFile, processFile } from "./service";
import { fileIdSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function deleteFileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const deleted = await deleteFile(user.id, parsed.data.fileId);
    if (!deleted) return { ok: false, message: "That file was not found." };
  } catch (error) {
    console.error("[files] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
  revalidatePath(workspaceRoutes.library);
  return { ok: true };
}

export async function reindexFileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  await processFile(user.id, parsed.data.fileId);
  revalidatePath(workspaceRoutes.library);
  return { ok: true };
}
