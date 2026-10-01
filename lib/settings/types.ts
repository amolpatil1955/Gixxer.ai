/** Client-safe settings shapes and labels. */
import type { PluginId } from "@/lib/plugins/catalog";

export const RESPONSE_TONES = ["default", "concise", "friendly", "professional", "detailed"] as const;
export type ResponseTone = (typeof RESPONSE_TONES)[number];

export const TONE_LABELS: Record<ResponseTone, string> = {
  default: "Default",
  concise: "Concise",
  friendly: "Friendly",
  professional: "Professional",
  detailed: "Detailed",
};

export const TONE_GUIDANCE: Record<ResponseTone, string> = {
  default: "",
  concise: "Be brief. Lead with the answer, skip preamble, and use a list only when it is shorter than prose.",
  friendly: "Be warm and conversational. Plain words, short sentences, an occasional light touch.",
  professional: "Be courteous and precise. Complete sentences, no slang, no exclamation marks.",
  detailed: "Be thorough. Explain the reasoning, cover edge cases, and add a short example when it helps.",
};

export interface UserSettingsDto {
  tone: ResponseTone;
  nickname: string;
  customInstructions: string;
  plugins: PluginId[];
}

export const DEFAULT_SETTINGS: UserSettingsDto = { tone: "default", nickname: "", customInstructions: "", plugins: [] };

export interface UsageDto {
  conversations: number;
  messages: number;
  files: number;
  images: number;
  bots: number;
  schedules: number;
  projects: number;
}
