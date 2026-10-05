import "server-only";
import type { BotRecord, SourceRecord } from "./repository";
import type { BotDto, SourceDto } from "./types";

export function toBotDto(bot: BotRecord): BotDto {
  return {
    id: bot.id,
    name: bot.name,
    publicKey: bot.publicKey,
    status: bot.status,
    avatarLetter: bot.avatarLetter,
    welcomeMessage: bot.welcomeMessage,
    businessName: bot.businessName,
    businessInfo: bot.businessInfo,
    instructions: bot.instructions,
    tone: bot.tone,
    useCase: bot.useCase,
    suggestedQuestions: bot.suggestedQuestions,
    theme: bot.theme,
    behavior: bot.behavior,
    allowedOrigins: bot.allowedOrigins,
    published: bot.publishedAt !== null,
    createdAt: bot.createdAt.toISOString(),
  };
}

export function toSourceDto(source: SourceRecord): SourceDto {
  return {
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    status: source.status,
    chunkCount: source.chunkCount,
    pageCount: source.pageCount,
    title: source.title,
    error: source.error,
    createdAt: source.createdAt.toISOString(),
  };
}
