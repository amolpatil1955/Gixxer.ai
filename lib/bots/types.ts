import type { BotTone, WidgetPosition } from "./constants";

/** Serialisable bot shapes for client components. */
export interface BotDto {
  id: string;
  name: string;
  publicKey: string;
  status: "draft" | "live";
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  businessInfo: string;
  instructions: string;
  tone: BotTone;
  useCase: string;
  suggestedQuestions: string[];
  theme: { accent: string; position: WidgetPosition; preset: string };
  behavior: { collectLeads: boolean; citeSources: boolean; knowledgeOnly: boolean };
  allowedOrigins: string[];
  published: boolean;
  createdAt: string;
}

export interface SourceDto {
  id: string;
  type: "file" | "url" | "text";
  name: string;
  url: string | null;
  /** pending and crawling are website sources waiting on the crawler. */
  status: "pending" | "crawling" | "processing" | "indexing" | "indexed" | "failed";
  chunkCount: number;
  pageCount: number;
  title: string | null;
  error: string | null;
  createdAt: string;
}

/** True while a source is still being read, so the screen keeps polling. */
export function sourceWorking(status: SourceDto["status"]): boolean {
  return status === "pending" || status === "crawling" || status === "processing" || status === "indexing";
}

export interface PublicBotDto {
  key: string;
  name: string;
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  suggestedQuestions: string[];
  /** `radius` lets the launcher's iframe match the panel without shipping the palette. */
  theme: { accent: string; position: WidgetPosition; preset: string; radius: number };
  collectLeads: boolean;
}

export type WidgetWireEvent =
  | { type: "token"; text: string }
  | { type: "sources"; items: string[] }
  | { type: "done" }
  | { type: "error"; message: string };
