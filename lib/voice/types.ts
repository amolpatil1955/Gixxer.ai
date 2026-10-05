/** Client-safe shapes for the voice assistant. No keys, no provider objects. */

/**
 * What the browser needs to open a realtime voice session. The token is
 * short-lived, single-use and bound to this user's session configuration on
 * the server; it is not the provider's API key. With `mock` set, the browser
 * runs the deterministic stand-in instead (tests only).
 */
export type VoiceSessionDto =
  | { mock: true; conversationId: string | null }
  | {
      mock: false;
      token: string;
      /** Opaque identifier the realtime client needs to address the session. Never shown. */
      model: string;
      /** ISO time after which the token no longer opens new sessions. */
      newSessionExpiresAt: string;
      conversationId: string | null;
    };

export interface VoiceTurnDto {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  title: string;
}

/** The one state the window shows at a time. */
export type VoiceState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "reconnecting" | "denied" | "unsupported" | "error" | "ended";

export interface TranscriptLine {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Still being spoken or recognised. */
  partial: boolean;
}
