"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { deleteImage } from "./service";
import { imageIdSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function deleteImageAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = imageIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const deleted = await deleteImage(user.id, parsed.data.imageId);
    if (!deleted) return { ok: false, message: "That image was not found." };
  } catch (error) {
    console.error("[images] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
  revalidatePath(workspaceRoutes.images);
  return { ok: true };
}
