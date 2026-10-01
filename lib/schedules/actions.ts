"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { aiRateLimits, retryMessage } from "@/lib/security/ai-rate-limits";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { deleteSchedule, getSchedule, setScheduleActive } from "./repository";
import { createScheduleFor, followingRun, runScheduleNow, ScheduleError } from "./service";
import { createScheduleSchema, scheduleIdSchema, setScheduleActiveSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type RunResult = { ok: true; conversationId: string | null } | { ok: false; message: string };

const GENERIC = "Something went wrong on our side. Please try again.";

export async function createScheduleAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  try {
    await createScheduleFor(user.id, parsed.data);
  } catch (error) {
    if (error instanceof ScheduleError) return { ok: false, message: error.message };
    console.error("[schedules] create failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.scheduled);
  return { ok: true };
}

export async function setScheduleActiveAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setScheduleActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const schedule = await getSchedule(user.id, parsed.data.scheduleId);
    if (!schedule) return { ok: false, message: "That schedule was not found." };
    // Resuming skips any runs missed while paused instead of firing them all at once.
    const nextRunAt = parsed.data.active && schedule.nextRunAt.getTime() <= Date.now() ? followingRun(schedule) : undefined;
    await setScheduleActive(user.id, schedule.id, parsed.data.active, nextRunAt);
  } catch (error) {
    console.error("[schedules] toggle failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.scheduled);
  return { ok: true };
}

export async function deleteScheduleAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = scheduleIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  try {
    const deleted = await deleteSchedule(user.id, parsed.data.scheduleId);
    if (!deleted) return { ok: false, message: "That schedule was not found." };
  } catch (error) {
    console.error("[schedules] delete failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
  revalidatePath(workspaceRoutes.scheduled);
  return { ok: true };
}

export async function runScheduleNowAction(input: unknown): Promise<RunResult> {
  const user = await requireUser();
  const parsed = scheduleIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };
  const limit = await aiRateLimits.scheduleRunsByUser.consume(`schedule-run:${user.id}`);
  if (!limit.allowed) return { ok: false, message: retryMessage(limit.retryAfterSeconds) };
  try {
    const result = await runScheduleNow(user.id, parsed.data.scheduleId);
    if (!result.ran) return { ok: false, message: "That schedule was not found or is paused." };
    revalidatePath("/app", "layout");
    return { ok: true, conversationId: result.conversationId };
  } catch (error) {
    console.error("[schedules] run now failed", error instanceof Error ? error.message : error);
    return { ok: false, message: GENERIC };
  }
}
