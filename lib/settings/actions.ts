"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/auth";
import { routes } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { bumpSessionVersion, updateUserName } from "@/lib/auth/user-repository";
import { deleteAllConversations } from "@/lib/chat/repository";
import { countUsage, getSettings, updateSettings } from "./repository";
import type { UsageDto, UserSettingsDto } from "./types";
import { personalizationSchema, pluginToggleSchema, profileSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };
export type SettingsResult = { ok: true; settings: UserSettingsDto } | { ok: false; message: string };

const GENERIC = "Something went wrong on our side. Please try again.";

export async function savePersonalizationAction(input: unknown): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = personalizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  try {
    const settings = await updateSettings(user.id, parsed.data);
    revalidatePath("/app", "layout");
    return { ok: true, settings };
  } catch (error) {
    console.error("[settings] save failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function togglePluginAction(input: unknown): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = pluginToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const current = await getSettings(user.id);
    const plugins = parsed.data.enabled
      ? [...new Set([...current.plugins, parsed.data.plugin])]
      : current.plugins.filter((id) => id !== parsed.data.plugin);
    const settings = await updateSettings(user.id, { plugins });
    revalidatePath("/app", "layout");
    return { ok: true, settings };
  } catch (error) {
    console.error("[settings] plugin toggle failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function saveProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form.", fieldErrors: { name: parsed.error.issues[0]?.message ?? "Invalid name" } };
  try {
    await updateUserName(user.id, parsed.data.name);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[settings] profile save failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}

export async function usageAction(): Promise<UsageDto | null> {
  const user = await requireUser();
  try {
    return await countUsage(user.id);
  } catch (error) {
    console.error("[settings] usage failed", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Invalidates every session, including this one, then lands on the login page. */
export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await bumpSessionVersion(user.id);
  await signOut({ redirect: false });
  redirect(`${routes.login}?reason=signed-out-everywhere`);
}

export async function deleteAllConversationsAction(): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteAllConversations(user.id);
  } catch (error) {
    console.error("[settings] delete all chats failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
