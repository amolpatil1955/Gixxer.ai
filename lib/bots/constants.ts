/** Client-safe constants for Chatbot Pro. Mirrors the enums in the Mongoose schema. */
export const BOT_TONES = ["friendly", "professional", "concise"] as const;
export type BotTone = (typeof BOT_TONES)[number];

export const WIDGET_POSITIONS = ["left", "right"] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export const TONE_LABELS: Record<BotTone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  concise: "Concise",
};

export const TONE_GUIDANCE: Record<BotTone, string> = {
  friendly: "Warm and conversational. Short sentences, plain words, an occasional light touch.",
  professional: "Courteous and precise. Complete sentences, no slang, no exclamation marks.",
  concise: "As brief as possible. Answer first, one or two sentences, no preamble.",
};
