"use client";

import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { MicCapture, PcmPlayer, voiceSupported } from "./audio";
import { MockTransport, RealtimeTransport, type TransportEvents, type VoiceTransport } from "./transport";
import type { TranscriptLine, VoiceSessionDto, VoiceState, VoiceTurnDto } from "./types";

/*
 * One voice conversation, from the click that opens it to the last byte of
 * audio. The manager owns the microphone, the player and the connection, runs
 * the state machine the window shows (listening → thinking → speaking), writes
 * each finished exchange into the chat, reconnects when the connection drops,
 * and releases everything on stop. Only one can be live at a time; a second
 * `start` while one is live is refused rather than opening a second microphone.
 *
 * The React side reads it through `subscribe`/`getSnapshot`, so the window
 * re-renders only when something it shows has changed. Loudness is delivered
 * through a callback instead, because it changes many times a second.
 */

export interface VoiceSnapshot {
  state: VoiceState;
  /** A sentence for the person when `state` is error, denied or unsupported. */
  message: string | null;
  muted: boolean;
  lines: TranscriptLine[];
  conversationId: string | null;
  reconnectAttempt: number;
}

export interface StartOptions {
  conversationId: string | null;
  projectId: string | null;
  /** Fired when a voice exchange creates the conversation this chat had not yet started. */
  onConversation?: (turn: VoiceTurnDto) => void;
}

const MAX_RECONNECTS = 3;
const THINKING_AFTER_MS = 650;
const IDLE_END_MS = 3 * 60_000;
const LEVEL_INTERVAL_MS = 66;
const MAX_LINES = 40;

/*
 * The id of the manager holding the microphone, if any. An id rather than the
 * instance, so nothing keeps a disposed manager alive.
 */
let liveId: number | null = null;
let nextId = 1;

/** How many conversations are live right now. Always 0 or 1; the window shows it for the tests. */
export function liveVoiceSessions(): number {
  return liveId === null ? 0 : 1;
}

function denialReason(error: unknown): { state: VoiceState; message: string | null } {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return { state: "denied", message: null };
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { state: "error", message: "No microphone was found. Plug one in or check your sound settings, then try again." };
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return { state: "error", message: "The microphone is busy or blocked by the system. Close other apps using it, then try again." };
  return { state: "error", message: "The microphone could not be started. Please try again." };
}

export class VoiceSessionManager {
  private snapshot: VoiceSnapshot = { state: "idle", message: null, muted: false, lines: [], conversationId: null, reconnectAttempt: 0 };
  private listeners = new Set<() => void>();
  private mic: MicCapture | null = null;
  private player: PcmPlayer | null = null;
  private transport: VoiceTransport | null = null;
  private options: StartOptions | null = null;
  private resumptionHandle: string | null = null;
  private userText = "";
  private assistantText = "";
  private userLineId: string | null = null;
  private assistantLineId: string | null = null;
  private turnComplete = false;
  private lastInputAt = 0;
  private lastActivityAt = 0;
  private thinkTimer: number | null = null;
  private idleTimer: number | null = null;
  private levelTimer: number | null = null;
  private stopping = false;
  private connecting = false;
  /** The call is opened once per conversation, not once per connection. */
  private greeted = false;
  private counter = 0;
  private readonly id = nextId++;

  private onLevel: ((level: number) => void) | null = null;

  /** Loudness for the visualiser: 0 to 1, from the microphone while listening and the speaker while speaking. */
  setLevelListener(listener: ((level: number) => void) | null) {
    this.onLevel = listener;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): VoiceSnapshot => this.snapshot;

  private set(patch: Partial<VoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  get state(): VoiceState {
    return this.snapshot.state;
  }

  /** Opens the microphone and the connection. Refused while another conversation is live. */
  async start(options: StartOptions): Promise<void> {
    if (liveId !== null && liveId !== this.id) {
      this.set({ state: "error", message: "A voice conversation is already open in another window." });
      return;
    }
    if (this.connecting || (this.state !== "idle" && this.state !== "ended" && this.state !== "error" && this.state !== "denied" && this.state !== "unsupported")) return;
    liveId = this.id;
    this.options = options;
    this.stopping = false;
    this.greeted = false;
    this.connecting = true;
    this.set({ state: "connecting", message: null, conversationId: options.conversationId, reconnectAttempt: 0, lines: this.snapshot.state === "ended" ? [] : this.snapshot.lines });

    if (!voiceSupported()) {
      this.connecting = false;
      this.finish("unsupported", window.isSecureContext === false ? "Voice conversations need a secure connection. Open Gixxer over https." : null);
      return;
    }
    try {
      const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName }).catch(() => null);
      if (permission?.state === "denied") {
        this.connecting = false;
        this.finish("denied", null);
        return;
      }
    } catch {
      // Not every browser answers; the microphone request itself decides.
    }

    this.mic = new MicCapture();
    try {
      await this.mic.open({ onChunk: (pcm, level) => this.onMicChunk(pcm, level) });
    } catch (error) {
      const reason = denialReason(error);
      this.connecting = false;
      this.finish(reason.state, reason.message);
      return;
    }
    if (this.stopping) return;
    this.mic.onEnded = () => {
      if (!this.stopping) this.finish("error", "The microphone stopped. Check the device and try again.");
    };
    this.mic.setMuted(this.snapshot.muted);

    this.player = new PcmPlayer();
    await this.player.open();

    try {
      await this.connect();
    } catch (error) {
      this.connecting = false;
      this.finish("error", error instanceof Error && error.message ? error.message : "The voice connection could not be opened. Please try again.");
      return;
    }
    this.connecting = false;
  }

  /** Fetches a fresh token and opens the connection; used for the first connection and for every reconnect. */
  private async connect(): Promise<void> {
    const options = this.options!;
    const response = await fetch("/api/voice/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: this.snapshot.conversationId ?? options.conversationId ?? undefined, projectId: options.projectId ?? undefined }),
    });
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, response.status === 401 ? "Please sign in again." : "The voice connection could not be opened. Please try again."));
    }
    const { session } = (await response.json()) as { session: VoiceSessionDto };
    if (this.stopping) return;
    this.transport?.close();
    this.transport = session.mock ? new MockTransport() : new RealtimeTransport(session.token, session.model);
    await this.transport.connect(this.events(), { resumptionHandle: this.resumptionHandle });
  }

  private events(): TransportEvents {
    return {
      onReady: () => {
        if (this.stopping) return;
        this.set({ state: "listening", message: null, reconnectAttempt: 0 });
        this.touch();
        this.startLevelLoop();
        this.armIdle();
        /*
         * Gixxer speaks first, in its own voice, once the session is really
         * ready. Guarded so a reconnect or a re-render never greets twice, and
         * skipped once the person has started talking: by then a greeting would
         * be speaking over them.
         */
        if (!this.greeted && !this.userText.trim()) {
          this.greeted = true;
          this.transport?.sendText("The call has just connected. Greet the person now.");
        }
      },
      onAudio: (pcm) => {
        if (this.stopping || !this.player) return;
        this.touch();
        this.clearThinkTimer();
        if (this.state !== "speaking") this.set({ state: "speaking" });
        this.player.enqueue(pcm, () => this.onDrained());
      },
      onInputTranscript: (text, finished) => {
        if (this.stopping) return;
        this.touch();
        this.userText += text;
        this.lastInputAt = performance.now();
        this.upsertLine("user", this.userText, !finished);
        if (finished) this.enterThinking();
        else this.armThinkTimer();
      },
      onOutputTranscript: (text) => {
        if (this.stopping) return;
        this.assistantText += text;
        this.upsertLine("assistant", this.assistantText, true);
      },
      onInterrupted: () => {
        if (this.stopping) return;
        this.player?.interrupt();
        this.clearThinkTimer();
        // Whatever was said up to the interruption stands; the next words start a new exchange.
        if (this.assistantText.trim()) this.upsertLine("assistant", this.assistantText.trimEnd(), false);
        void this.commitTurn();
        this.set({ state: "listening" });
      },
      onTurnComplete: () => {
        if (this.stopping) return;
        this.turnComplete = true;
        this.clearThinkTimer();
        if (this.userText.trim()) this.upsertLine("user", this.userText, false);
        if (!this.player?.playing) this.onDrained();
      },
      onGoAway: () => {
        // The server is about to close; reconnect now with the handle so no context is lost.
        if (!this.stopping) void this.reconnect("goaway");
      },
      onResumptionHandle: (handle) => {
        this.resumptionHandle = handle;
      },
      onError: () => {
        // The close that follows decides whether to reconnect.
      },
      onClose: () => {
        if (!this.stopping) void this.reconnect("closed");
      },
    };
  }

  private onDrained() {
    if (this.stopping || !this.turnComplete) return;
    this.turnComplete = false;
    this.upsertLine("assistant", this.assistantText, false);
    void this.commitTurn();
    if (this.state === "speaking" || this.state === "thinking") this.set({ state: "listening" });
    this.armIdle();
  }

  private onMicChunk(pcm: Int16Array, level: number) {
    if (this.stopping) return;
    if (!this.snapshot.muted && level > 0.02) this.touch();
    if (this.state === "listening" && this.onLevel) this.onLevel(Math.min(1, level * 6));
    this.transport?.sendAudio(pcm);
  }

  private enterThinking() {
    if (this.state === "listening" && this.userText.trim()) this.set({ state: "thinking" });
  }

  private armThinkTimer() {
    this.clearThinkTimer();
    this.thinkTimer = window.setTimeout(() => {
      this.thinkTimer = null;
      if (performance.now() - this.lastInputAt >= THINKING_AFTER_MS - 20) this.enterThinking();
    }, THINKING_AFTER_MS);
  }

  private clearThinkTimer() {
    if (this.thinkTimer !== null) window.clearTimeout(this.thinkTimer);
    this.thinkTimer = null;
  }

  private touch() {
    this.lastActivityAt = performance.now();
  }

  /** A quiet room for a few minutes ends the call rather than keeping a microphone open for nothing. */
  private armIdle() {
    if (this.idleTimer !== null) window.clearInterval(this.idleTimer);
    this.idleTimer = window.setInterval(() => {
      if (this.stopping) return;
      if (performance.now() - this.lastActivityAt > IDLE_END_MS && this.state === "listening") {
        this.stop("Ended after a few minutes of quiet. Start again whenever you like.");
      }
    }, 5000);
  }

  private startLevelLoop() {
    if (this.levelTimer !== null) return;
    this.levelTimer = window.setInterval(() => {
      if (!this.onLevel) return;
      if (this.state === "speaking") this.onLevel(this.player?.level() ?? 0);
      else if (this.state !== "listening") this.onLevel(0);
    }, LEVEL_INTERVAL_MS);
  }

  private upsertLine(role: "user" | "assistant", text: string, partial: boolean) {
    const id = role === "user" ? (this.userLineId ??= `u${++this.counter}`) : (this.assistantLineId ??= `a${++this.counter}`);
    const lines = this.snapshot.lines.filter((line) => line.id !== id);
    lines.push({ id, role, text, partial });
    this.set({ lines: lines.slice(-MAX_LINES) });
  }

  /** Writes the finished exchange into the chat and starts a fresh one. */
  private async commitTurn() {
    const userText = this.userText.trim();
    const assistantText = this.assistantText.trim();
    this.userText = "";
    this.assistantText = "";
    this.userLineId = null;
    this.assistantLineId = null;
    if (!userText) return;
    const options = this.options;
    try {
      const response = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: this.snapshot.conversationId ?? undefined, projectId: options?.projectId ?? undefined, userText, assistantText }),
      });
      if (!response.ok) return;
      const { turn } = (await response.json()) as { turn: VoiceTurnDto };
      if (!this.snapshot.conversationId) {
        this.set({ conversationId: turn.conversationId });
        options?.onConversation?.(turn);
      }
    } catch {
      // The spoken exchange still happened; a lost save is not worth interrupting the call for.
    }
  }

  private async reconnect(reason: "closed" | "goaway") {
    if (this.stopping || this.connecting) return;
    const attempt = this.snapshot.reconnectAttempt + 1;
    if (attempt > MAX_RECONNECTS) {
      this.finish("error", "The voice connection was lost. Check your network and try again.");
      return;
    }
    this.connecting = true;
    this.player?.interrupt();
    this.set({ state: "reconnecting", reconnectAttempt: attempt });
    this.transport?.close();
    this.transport = null;
    if (reason === "closed") await new Promise((resolve) => window.setTimeout(resolve, Math.min(4000, 500 * 2 ** (attempt - 1))));
    if (this.stopping) return;
    try {
      await this.connect();
    } catch {
      this.connecting = false;
      if (!this.stopping) void this.reconnect("closed");
      return;
    }
    this.connecting = false;
  }

  setMuted(muted: boolean) {
    this.set({ muted });
    this.mic?.setMuted(muted);
    if (muted) this.transport?.sendAudioStreamEnd();
  }

  /** Ends the conversation and releases the microphone, the speaker and the connection. */
  stop(message: string | null = null) {
    this.finish("ended", message);
  }

  private finish(state: VoiceState, message: string | null) {
    this.stopping = true;
    this.connecting = false;
    this.clearThinkTimer();
    if (this.idleTimer !== null) window.clearInterval(this.idleTimer);
    if (this.levelTimer !== null) window.clearInterval(this.levelTimer);
    this.idleTimer = null;
    this.levelTimer = null;
    this.transport?.close();
    this.transport = null;
    this.mic?.close();
    this.mic = null;
    this.player?.close();
    this.player = null;
    this.onLevel?.(0);
    // An exchange cut short by the stop is still kept.
    if (this.userText.trim()) void this.commitTurn();
    this.turnComplete = false;
    if (liveId === this.id) liveId = null;
    this.set({ state, message });
  }

  /** Forgets the conversation entirely; for unmount. */
  dispose() {
    if (this.state !== "idle" && this.state !== "ended") this.finish("idle", null);
    else if (liveId === this.id) liveId = null;
    this.listeners.clear();
    this.onLevel = null;
  }
}
