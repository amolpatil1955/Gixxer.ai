import { z } from "zod";
import { BOT_TONES, WIDGET_POSITIONS } from "./constants";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const line = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);

const origin = z
  .string()
  .trim()
  .transform((value) => value.replace(/\/+$/, ""))
  .refine((value) => /^https?:\/\/[^\s/]+$/i.test(value), "Enter an origin like https://example.com");

export const createBotSchema = z.object({
  name: line(60).min(1, "Give the bot a name"),
});

export const botIdSchema = z.object({ botId: objectId });

export const settingsSchema = z.object({
  botId: objectId,
  name: line(60).min(1, "Give the bot a name"),
  businessName: line(80),
  businessInfo: line(4000),
  welcomeMessage: line(300).min(1, "Write a welcome line"),
  suggestedQuestions: z.array(line(120).min(1)).max(6, "Up to six suggested questions"),
  allowedOrigins: z.array(origin).max(10, "Up to ten origins"),
});

export const instructionsSchema = z.object({
  botId: objectId,
  instructions: line(4000),
  tone: z.enum(BOT_TONES),
});

export const appearanceSchema = z.object({
  botId: objectId,
  avatarLetter: line(2),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #030000"),
  position: z.enum(WIDGET_POSITIONS),
});

export const behaviorSchema = z.object({
  botId: objectId,
  collectLeads: z.boolean(),
  citeSources: z.boolean(),
  knowledgeOnly: z.boolean(),
});

export const statusSchema = z.object({
  botId: objectId,
  status: z.enum(["draft", "live"]),
});

export const textSourceSchema = z.object({
  botId: objectId,
  name: line(120).min(1, "Name this source"),
  text: z.string().trim().min(20, "Paste at least a sentence or two").max(120_000, "That is too much text for one source; split it up"),
});

export const urlSourceSchema = z.object({
  botId: objectId,
  url: z.string().trim().min(1, "Enter an address").max(2000),
});

export const fileSourceSchema = z.object({
  botId: objectId,
  fileId: objectId,
});

export const sourceIdSchema = z.object({ botId: objectId, sourceId: objectId });

/* Public widget traffic */

export const widgetMessageSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid session"),
  message: z.string().trim().min(1).max(2000),
});

export const leadSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid session"),
  name: line(120),
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address")),
  message: line(2000),
});
