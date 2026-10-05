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

/** What the bot is for. Chosen in the wizard; it seeds the instructions and the greeting. */
export const BOT_USE_CASES = ["support", "sales", "booking", "faq", "internal"] as const;
export type BotUseCase = (typeof BOT_USE_CASES)[number];

export interface UseCaseDetail {
  label: string;
  description: string;
  /** The greeting a new bot starts with. */
  welcome: string;
  /** Seed instructions the owner can then edit. */
  instructions: string;
  questions: string[];
}

export const USE_CASES: Record<BotUseCase, UseCaseDetail> = {
  support: {
    label: "Customer support",
    description: "Answers questions about your product, orders, policies and hours.",
    welcome: "Hi there 👋 If you need any assistance, we're here for you!",
    instructions:
      "Answer support questions from the knowledge provided. Be practical: give the steps, not a lecture. If something needs a human, say so and offer to take the visitor's details.",
    questions: ["What are your hours?", "How do I track my order?", "What is your return policy?"],
  },
  sales: {
    label: "Sales and enquiries",
    description: "Explains what you offer, qualifies interest and collects leads.",
    welcome: "Hi there 👋 Looking for something in particular? Ask away.",
    instructions:
      "Help the visitor work out whether what we offer fits them. Quote only prices that appear in the knowledge. When they show real interest, invite them to leave their name and email.",
    questions: ["What do you offer?", "How much does it cost?", "Can I talk to someone?"],
  },
  booking: {
    label: "Bookings and appointments",
    description: "Explains availability, what to expect and how to book.",
    welcome: "Hi there 👋 Want to book in? I can help.",
    instructions:
      "Explain how booking works, what is available and what a visitor should bring or expect. Never confirm a specific slot yourself: take their details and say the team will confirm.",
    questions: ["How do I book?", "What are your opening hours?", "Where are you based?"],
  },
  faq: {
    label: "Website FAQ",
    description: "Answers the questions your pages already answer, in one place.",
    welcome: "Hi there 👋 Ask me anything about this site.",
    instructions: "Answer from the website's own pages. Keep answers to two or three sentences and point to the page the answer came from.",
    questions: ["What is this about?", "How does it work?", "How do I get in touch?"],
  },
  internal: {
    label: "Internal helpdesk",
    description: "Answers staff questions from your handbooks and policies.",
    welcome: "Hi there 👋 Need to look something up?",
    instructions:
      "Answer staff questions from the handbooks and policies provided. Be exact and quote the rule. If a policy does not cover the question, say so rather than guessing.",
    questions: ["How much leave do I get?", "What is the expenses policy?", "Who do I ask about IT?"],
  },
};

/** Theme keys, mirrored from lib/bots/themes.ts so validation does not import the palette. */
export const BOT_THEME_KEYS = ["clarity", "midnight", "warmth", "forest", "monochrome"] as const;

export const TONE_GUIDANCE: Record<BotTone, string> = {
  friendly: "Warm and conversational. Short sentences, plain words, an occasional light touch.",
  professional: "Courteous and precise. Complete sentences, no slang, no exclamation marks.",
  concise: "As brief as possible. Answer first, one or two sentences, no preamble.",
};
