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
  suggestedQuestions: string[];
  theme: { accent: string; position: WidgetPosition };
  behavior: { collectLeads: boolean; citeSources: boolean; knowledgeOnly: boolean };
  allowedOrigins: string[];
  createdAt: string;
}

export interface SourceDto {
  id: string;
  type: "file" | "url" | "text";
  name: string;
  url: string | null;
  status: "indexing" | "indexed" | "failed";
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

export interface PublicBotDto {
  key: string;
  name: string;
  avatarLetter: string;
  welcomeMessage: string;
  businessName: string;
  suggestedQuestions: string[];
  theme: { accent: string; position: WidgetPosition };
  collectLeads: boolean;
}

export type WidgetWireEvent =
  | { type: "token"; text: string }
  | { type: "sources"; items: string[] }
  | { type: "done" }
  | { type: "error"; message: string };
