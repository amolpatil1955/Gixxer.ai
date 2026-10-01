import { z } from "zod";
import { nameSchema } from "@/lib/auth/validation";
import { PLUGIN_IDS, type PluginId } from "@/lib/plugins/catalog";
import { RESPONSE_TONES } from "./types";

export const CUSTOM_INSTRUCTIONS_MAX = 1500;

export const personalizationSchema = z.object({
  tone: z.enum(RESPONSE_TONES),
  nickname: z.string().trim().max(40, "Keep the nickname under 40 characters"),
  customInstructions: z.string().trim().max(CUSTOM_INSTRUCTIONS_MAX, `Keep the instructions under ${CUSTOM_INSTRUCTIONS_MAX} characters`),
});

export const pluginsSchema = z.object({
  plugins: z.array(z.enum(PLUGIN_IDS as [PluginId, ...PluginId[]])).max(PLUGIN_IDS.length),
});

export const pluginToggleSchema = z.object({
  plugin: z.enum(PLUGIN_IDS as [PluginId, ...PluginId[]]),
  enabled: z.boolean(),
});

export const profileSchema = z.object({ name: nameSchema });

export type PersonalizationInput = z.input<typeof personalizationSchema>;
