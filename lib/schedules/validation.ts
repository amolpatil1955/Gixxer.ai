import { z } from "zod";
import { objectIdSchema, timeZoneSchema } from "@/lib/chat/validation";
import { CADENCES, type Cadence } from "./timing";

export const SCHEDULE_PROMPT_MAX = 4000;

export const createScheduleSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80, "That name is too long"),
  prompt: z.string().trim().min(3, "Describe what should run").max(SCHEDULE_PROMPT_MAX, "That prompt is too long"),
  cadence: z.enum(CADENCES as [Cadence, ...Cadence[]]),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  timeZone: timeZoneSchema,
});

export type CreateScheduleInput = z.input<typeof createScheduleSchema>;

export const scheduleIdSchema = z.object({ scheduleId: objectIdSchema });

export const setScheduleActiveSchema = z.object({ scheduleId: objectIdSchema, active: z.boolean() });
