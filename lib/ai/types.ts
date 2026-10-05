/** Provider-neutral shapes. Client-safe: no secrets, no environment access. */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export type ProviderName = "groq" | "gemini" | "mock";

export interface StreamOptions {
  signal?: AbortSignal;
  /** Milliseconds allowed before the first token. */
  firstTokenTimeoutMs?: number;
  /** Milliseconds allowed for the whole reply. */
  totalTimeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Ask a reasoning model to think before it answers and stream its
   * reasoning as separate deltas. Providers that cannot reason ignore it.
   */
  reasoning?: boolean;
}

/** One streamed piece of a reply: answer text, or the model's reasoning while it thinks. */
export interface TextDelta {
  text?: string;
  reasoning?: string;
}

export interface TextProvider {
  readonly name: ProviderName;
  /** The model behind this provider, for logs and the reply's badge. */
  readonly model: string;
  /** Streams the reply as deltas. Throws ProviderError on failure. */
  stream(turns: ChatTurn[], options?: StreamOptions): AsyncIterable<TextDelta>;
}

export interface ImageRequest {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  signal?: AbortSignal;
}

export interface ImageResult {
  bytes: Buffer;
  mime: string;
  model: string;
}

export interface TranscriptionRequest {
  bytes: Buffer;
  mime: string;
  /** BCP-47 language hint, e.g. "en". Omit to let the model detect it. */
  language?: string;
  signal?: AbortSignal;
}

export interface TranscriptionResult {
  text: string;
  model: string;
}
