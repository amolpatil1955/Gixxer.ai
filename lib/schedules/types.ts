import type { Cadence } from "./timing";

/** Serialisable schedule shape for client components. */
export interface ScheduleDto {
  id: string;
  name: string;
  prompt: string;
  cadence: Cadence;
  hour: number;
  minute: number;
  timeZone: string;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastConversationId: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: string;
}

export interface ScheduleTemplate {
  key: string;
  title: string;
  description: string;
  prompt: string;
  cadence: Cadence;
  hour: number;
  minute: number;
}

/** Starting points. Every prompt is one the model can answer on its own, with no service it does not have. */
export const SCHEDULE_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    key: "focus",
    title: "Plan my morning",
    description: "Three questions to set the day's priorities, every weekday at 8:00.",
    prompt: "Ask me three short questions that help me decide today's top priority, then suggest a simple plan for the morning based on typical answers.",
    cadence: "weekdays",
    hour: 8,
    minute: 0,
  },
  {
    key: "language",
    title: "Five-minute language lesson",
    description: "A tiny Spanish lesson with three phrases and a quiz, daily at 7:30.",
    prompt: "Teach me a five-minute Spanish lesson: three useful phrases with pronunciation, one grammar note, and a two-question quiz at the end.",
    cadence: "daily",
    hour: 7,
    minute: 30,
  },
  {
    key: "quiz",
    title: "Quiz me on computer science",
    description: "One tricky question with a worked answer, every weekday at 12:00.",
    prompt: "Give me one challenging computer-science interview question on a random topic, wait a paragraph, then explain the model answer step by step.",
    cadence: "weekdays",
    hour: 12,
    minute: 0,
  },
  {
    key: "review",
    title: "Weekly review",
    description: "Prompts for a Friday reflection on what worked and what to change.",
    prompt: "Guide me through a weekly review: what went well, what did not, what I learned, and one change to make next week. Ask the questions one section at a time.",
    cadence: "weekly",
    hour: 16,
    minute: 30,
  },
  {
    key: "social",
    title: "Social post ideas",
    description: "Three post ideas for a small business, every Monday at 9:00.",
    prompt: "Suggest three social media post ideas for a small business this week, each with a hook, a one-line caption and a suggested image.",
    cadence: "weekly",
    hour: 9,
    minute: 0,
  },
];
