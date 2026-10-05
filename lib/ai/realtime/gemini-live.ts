import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import { getEnv } from "@/lib/env";
import { ProviderError } from "../errors";

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
        // Nothing beyond what the browser legitimately adds (session resumption) may be changed.
        lockAdditionalFields: ["temperature", "topP", "topK", "maxOutputTokens", "tools", "toolConfig", "enableAffectiveDialog", "thinkingConfig", "proactivity"],
        httpOptions: { timeout: 15_000 },
      },
    });
    if (!token.name) throw new ProviderError("gemini", "unknown", "The token response carried no name");
    return { token: token.name, model: env.GEMINI_LIVE_MODEL, newSessionExpiresAt: newSessionExpireTime, expiresAt: expireTime };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const status = /\b(\d{3})\b/.exec(message)?.[1];
    const code = status === "429" ? "rate_limited" : status === "401" || status === "403" ? "not_configured" : /timeout|timed out/i.test(message) ? "timeout" : "unavailable";
    throw new ProviderError("gemini", code, message, { retryable: code !== "not_configured" });
  }
}
