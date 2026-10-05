import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import { getEnv } from "@/lib/env";
import { codeForStatus, ProviderError } from "../errors";

/*
 * Realtime voice runs on Gemini's Live API, the one place Gemini is used in this
 * workspace (restored for voice only, at the owner's request, October 2026).
 *
 * The browser never sees the API key. This module mints an ephemeral token on
 * the server: single use, good for one new session within a minute, bound to a
 * locked configuration (model, voice, system instruction, transcription). The
 * browser connects with that token and can change nothing the server locked.
 */

export interface LiveTokenInput {
  systemInstruction: string;
  /** How long a session opened with this token may run, in minutes. */
  sessionMinutes?: number;
}

export interface LiveToken {
  token: string;
  model: string;
  /** New sessions are refused after this moment. */
  newSessionExpiresAt: string;
  /** Messages are refused after this moment. */
  expiresAt: string;
}

export function geminiLiveConfigured(): boolean {
  return Boolean(getEnv().GEMINI_API_KEY);
}

/**
 * The session configuration the token locks. Audio in both directions, both
 * sides transcribed, the server's voice-activity detection tuned so a short
 * pause does not end the user's turn and the user can talk over the model.
 */
export function liveSessionConfig(systemInstruction: string) {
  const env = getEnv();
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction,
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env.GEMINI_LIVE_VOICE } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        prefixPaddingMs: 120,
        silenceDurationMs: 700,
      },
    },
    contextWindowCompression: { slidingWindow: {} },
  };
}

export async function mintLiveToken(input: LiveTokenInput): Promise<LiveToken> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) throw new ProviderError("gemini", "not_configured", "GEMINI_API_KEY is not set", { retryable: false });

  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
  const now = Date.now();
  const newSessionExpireTime = new Date(now + 90_000).toISOString();
  const expireTime = new Date(now + (input.sessionMinutes ?? 30) * 60_000).toISOString();

  try {
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: env.GEMINI_LIVE_MODEL,
          config: liveSessionConfig(input.systemInstruction),
        },
        /*
         * An empty list locks exactly the fields supplied above and nothing more,
         * which is what we want: the browser may add session resumption and may
         * change nothing else. Naming further fields here is not a tighter lock,
         * it is a field mask over BidiGenerateContentSetup, and any name that is
         * not a field of that message makes the whole request INVALID_ARGUMENT.
         */
        lockAdditionalFields: [],
        httpOptions: { timeout: 15_000 },
      },
    });
    if (!token.name) throw new ProviderError("gemini", "unknown", "The token response carried no name");
    return { token: token.name, model: env.GEMINI_LIVE_MODEL, newSessionExpiresAt: newSessionExpireTime, expiresAt: expireTime };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw asProviderError(error);
  }
}

/**
 * The provider reports failures as a JSON body inside the error's message.
 * Reading the status out of it is what lets a request this app got wrong (4xx)
 * be told apart from a provider that is genuinely down (5xx), so a reader is
 * never told to "try again later" about something that will never fix itself.
 */
export function asProviderError(error: unknown): ProviderError {
  const message = error instanceof Error ? error.message : String(error);
  const body = /\{[\s\S]*\}/.exec(message)?.[0];
  let status: number | undefined;
  let detail = message;
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: { code?: number; message?: string } };
      if (typeof parsed.error?.code === "number") status = parsed.error.code;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Not JSON after all; the raw message is logged instead.
    }
  }
  if (status === undefined) {
    const loose = /\b(4\d{2}|5\d{2})\b/.exec(message)?.[1];
    if (loose) status = Number(loose);
  }
  const timedOut = /timeout|timed out|ETIMEDOUT|ECONNRESET|fetch failed/i.test(message);
  const code = status ? codeForStatus(status) : timedOut ? "timeout" : "unavailable";
  return new ProviderError("gemini", code, detail, { status, retryable: code === "timeout" || code === "rate_limited" || code === "unavailable" });
}

