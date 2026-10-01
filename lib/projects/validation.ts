import { z } from "zod";
import { objectIdSchema } from "@/lib/chat/validation";

export const PROJECT_NAME_MAX = 80;
export const PROJECT_INSTRUCTIONS_MAX = 4000;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(PROJECT_NAME_MAX, "That name is too long"),
});

export const updateProjectSchema = z.object({
  projectId: objectIdSchema,
  name: z.string().trim().min(1, "Give the project a name").max(PROJECT_NAME_MAX, "That name is too long").optional(),
  instructions: z.string().trim().max(PROJECT_INSTRUCTIONS_MAX, `Keep the instructions under ${PROJECT_INSTRUCTIONS_MAX} characters`).optional(),
});

export const projectIdSchema = z.object({ projectId: objectIdSchema });
