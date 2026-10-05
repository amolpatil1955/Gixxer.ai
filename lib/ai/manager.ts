import "server-only";
import { getEnv } from "@/lib/env";
import { isProviderError, ProviderError } from "./errors";
import { groqProvider, groqTranscribe } from "./providers/groq";
import { generateImage as hfGenerateImage, hfEmbed } from "./providers/huggingface";
import { mockEmbed, mockImage, mockProvider, mockTranscribe } from "./providers/mock";
import { geminiLiveConfigured, mintLiveToken, type LiveTokenInput } from "./realtime/gemini-live";
import type { ChatTurn, ImageRequest, ImageResult, ProviderName, StreamOptions, TextProvider, TranscriptionRequest, TranscriptionResult } from "./types";

/*
 * The provider manager is the only thing the rest of the app talks to.
 *
 * Text runs on Groq. The chat model answers first; with Think mode on, the
 * reasoning model answers first and streams its thinking as it goes. A
 * retryable failure before the first token is retried once with a short
 * backoff, then handed to the next model in the chain. A failure after
 * tokens have flowed is handed over too, with the partial reply supplied so
 * the next model continues the same answer rather than starting over. The
 * reader sees one stream and a `provider` event when the hand-over happens.
 * If every model fails, one ProviderError surfaces.
 */

export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "provider"; name: ProviderName; model: string; switched: boolean };

export interface ChatStreamOptions extends StreamOptions {
  /** Overrides for tests. */
  providers?: TextProvider[];
  retryDelayMs?: number;
}

const RETRY_DELAY_MS = 800;

function textProviders(think: boolean): TextProvider[] {
  const env = getEnv();
  if (env.AI_MOCK) return [mockProvider];
  if (!env.GROQ_API) return [];
  const chain = think ? [env.GROQ_THINK_MODEL, env.GROQ_MODEL, env.GROQ_FALLBACK_MODEL] : [env.GROQ_MODEL, env.GROQ_FALLBACK_MODEL];
  return [...new Set(chain)].map(groqProvider);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });
}

/** One attempt: yields deltas, accumulating the answer text so a hand-over can continue it. */
async function* attempt(provider: TextProvider, turns: ChatTurn[], options: StreamOptions, produced: { text: string }): AsyncGenerator<ChatEvent> {
  for await (const delta of provider.stream(turns, options)) {
    if (delta.reasoning) yield { type: "reasoning", text: delta.reasoning };
    if (delta.text) {
      produced.text += delta.text;
      yield { type: "token", text: delta.text };
    }
  }
}

function continuationTurns(turns: ChatTurn[], partial: string): ChatTurn[] {
  return [
    ...turns,
    { role: "assistant", content: partial },
    {
      role: "user",
      content:
        "Continue your previous answer exactly from where it stopped. Do not repeat what you already wrote and do not add a preamble.",
    },
  ];
}

export async function* streamChat(turns: ChatTurn[], options: ChatStreamOptions = {}): AsyncGenerator<ChatEvent> {
  const providers = options.providers ?? textProviders(Boolean(options.reasoning));
  if (providers.length === 0) {
    throw new ProviderError("none", "not_configured", "No text provider is configured", { retryable: false });
  }
  const retryDelay = options.retryDelayMs ?? RETRY_DELAY_MS;
  const produced = { text: "" };
  let lastError: ProviderError | null = null;

  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index]!;
    yield { type: "provider", name: provider.name, model: provider.model, switched: index > 0 };
    const input = produced.text ? continuationTurns(turns, produced.text) : turns;
    // One retry per provider, only when nothing has been produced yet by this provider.
    for (let tryIndex = 0; tryIndex < 2; tryIndex++) {
      const before = produced.text.length;
      try {
        yield* attempt(provider, input, options, produced);
        return;
      } catch (error) {
        if (options.signal?.aborted) throw new ProviderError(provider.name, "aborted", "Stopped by the user", { retryable: false });
        const failure = isProviderError(error)
          ? error
          : new ProviderError(provider.name, "unknown", error instanceof Error ? error.message : "Unknown failure");
        lastError = failure;
        const partial = produced.text.length > before;
        console.warn(`[ai] ${provider.name}/${provider.model} failed (${failure.code}${partial ? ", mid-stream" : ""}): ${failure.message}`);
        // A missing key moves on to the next provider; a refused request is final.
        if (!failure.retryable) {
          if (failure.code === "not_configured") break;
          throw failure;
        }
        if (partial || tryIndex === 1) break;
        await sleep(retryDelay, options.signal);
      }
    }
  }
  throw lastError ?? new ProviderError("none", "unknown", "No provider produced a reply");
}

/** Embeddings for retrieval; returns null when no embedding provider is available, so callers fall back to lexical search. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const env = getEnv();
  if (env.AI_MOCK) return mockEmbed(texts);
  if (!env.HUGGINGFACE_API_KEY) return null;
  try {
    return await hfEmbed(texts);
  } catch (error) {
    console.warn(`[ai] embeddings unavailable: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

export async function generateImage(request: ImageRequest): Promise<ImageResult> {
  if (getEnv().AI_MOCK) return mockImage(request);
  return hfGenerateImage(request);
}

export async function transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResult> {
  if (getEnv().AI_MOCK) return mockTranscribe(request);
  return groqTranscribe(request);
}

/** Whether realtime voice conversations can be opened at all. */
export function voiceConfigured(): boolean {
  return getEnv().AI_MOCK || geminiLiveConfigured();
}

export type VoiceSessionToken = { mock: true } | { mock: false; token: string; model: string; newSessionExpiresAt: string };

/**
 * A short-lived credential the browser uses to hold one voice conversation.
 * Realtime voice is the one capability a browser must reach directly, so the
 * manager mints a single-use token bound to a locked configuration instead of
 * ever handing out the provider's key.
 */
export async function createVoiceSessionToken(input: LiveTokenInput): Promise<VoiceSessionToken> {
  if (getEnv().AI_MOCK) return { mock: true };
  const minted = await mintLiveToken(input);
  return { mock: false, token: minted.token, model: minted.model, newSessionExpiresAt: minted.newSessionExpiresAt };
}

/** A message safe to show a person for any provider failure. Details go to the log. */
export function userFacingProviderMessage(error: unknown): string {
  if (isProviderError(error)) {
    switch (error.code) {
      case "aborted":
        return "Stopped.";
      case "not_configured":
        return "This capability is not configured yet. Please try again later.";
      case "rate_limited":
        return "The AI provider is busy right now. Please try again in a moment.";
      case "timeout":
        return "The reply took too long. Please try again.";
      case "content_blocked":
        return "That request was declined by the model's safety filters. Try rephrasing.";
      default:
        return "The AI provider is unavailable right now. Please try again.";
    }
  }
  return "Something went wrong on our side. Please try again.";
}
