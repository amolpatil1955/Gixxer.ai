import "server-only";
import { renameConversation } from "@/lib/chat/repository";
import { runTurn } from "@/lib/chat/service";
import { claimDueSchedule, createSchedule, recordScheduleRun, type ScheduleRecord } from "./repository";
import { nextRunAfter, wallTimeIn, isValidTimeZone } from "./timing";
import type { CreateScheduleInput } from "./validation";

/*
 * Scheduled prompts run through the ordinary chat pipeline: a run is a new
 * conversation whose first message is the prompt, answered to completion.
 *
 * Two things trigger runs. Opening the workspace runs the owner's own due
 * schedules right after the page is served (`after()` in the layout), so a
 * single-instance deployment needs nothing else. An external scheduler may
 * also POST /api/cron with the shared secret to run everyone's due schedules
 * on time, whether or not they are looking.
 */

const RUN_TIMEOUT_MS = 150_000;
const MAX_RUNS_PER_SWEEP = 5;

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

export async function createScheduleFor(userId: string, input: CreateScheduleInput): Promise<ScheduleRecord> {
  if (!isValidTimeZone(input.timeZone)) throw new ScheduleError("That time zone is not recognised.");
  const nextRunAt = nextRunAfter(new Date(), input);
  return createSchedule(userId, { ...input, nextRunAt });
}

/** The run after `record.nextRunAt`, keeping the weekday and day of month the schedule was made with. */
export function followingRun(record: ScheduleRecord, now = new Date()): Date {
  const anchor = wallTimeIn(record.nextRunAt, record.timeZone);
  const from = new Date(Math.max(now.getTime(), record.nextRunAt.getTime()));
  return nextRunAfter(from, { cadence: record.cadence, hour: record.hour, minute: record.minute, timeZone: record.timeZone, weekday: anchor.weekday, dayOfMonth: anchor.day });
}

/** Performs one run: a fresh conversation, the prompt, the whole reply. Never throws. */
async function perform(schedule: ScheduleRecord): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  let conversationId: string | null = null;
  let error: string | null = null;
  try {
    for await (const event of runTurn(schedule.userId, { kind: "send", content: schedule.prompt, attachmentIds: [], think: false, timeZone: schedule.timeZone }, controller.signal)) {
      if (event.type === "meta") conversationId = event.conversationId;
      if (event.type === "error") error = event.message;
      if (event.type === "done" && event.status === "stopped") error = "The run timed out.";
    }
    if (conversationId) {
      const stamp = new Intl.DateTimeFormat("en", { timeZone: schedule.timeZone, dateStyle: "medium" }).format(new Date());
      await renameConversation(schedule.userId, conversationId, `${schedule.name} · ${stamp}`.slice(0, 120));
    }
  } catch (caught) {
    console.error("[schedules] run failed", schedule.id, caught instanceof Error ? caught.message : caught);
    error = "The run could not be completed.";
  } finally {
    clearTimeout(timer);
  }
  await recordScheduleRun(schedule.id, { conversationId, error });
}

/** Runs every due schedule (for one user, or for everyone). Returns how many ran. */
export async function runDueSchedules(filter: { userId?: string } = {}, now = new Date()): Promise<number> {
  let ran = 0;
  while (ran < MAX_RUNS_PER_SWEEP) {
    const claimed = await claimDueSchedule(filter, now, (record) => followingRun(record, now));
    if (!claimed) break;
    await perform(claimed);
    ran += 1;
  }
  return ran;
}

/** Runs one schedule immediately, leaving its next scheduled run where it was. */
export async function runScheduleNow(userId: string, scheduleId: string): Promise<{ ran: boolean; conversationId: string | null }> {
  const claimed = await claimDueSchedule({ userId, scheduleId, force: true }, new Date(), (record) => record.nextRunAt);
  if (!claimed) return { ran: false, conversationId: null };
  await perform(claimed);
  const { getSchedule } = await import("./repository");
  const after = await getSchedule(userId, scheduleId);
  return { ran: true, conversationId: after?.lastConversationId ?? null };
}
