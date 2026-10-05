"use client";

import { base64ToPcm, pcmToBase64 } from "./audio";

/*
 * What the session manager needs from a realtime connection, and the two things
 * that provide it: the live provider, reached with the single-use token the
 * server minted, and a deterministic stand-in for the test suites.
 */

export interface TransportEvents {
  onReady: () => void;
  /** 16-bit PCM at 24 kHz. */
  onAudio: (pcm: Int16Array) => void;
  onInputTranscript: (text: string, finished: boolean) => void;
  onOutputTranscript: (text: string) => void;
  /** The user spoke over the model; whatever is queued must be dropped. */
  onInterrupted: () => void;
  onTurnComplete: () => void;
  /** The server will close soon; reconnecting with the handle keeps the context. */
  onGoAway: (timeLeftMs: number | null) => void;
  onResumptionHandle: (handle: string) => void;
  onError: (message: string) => void;
  onClose: (code: number, reason: string) => void;
}

export interface ConnectOptions {
  resumptionHandle: string | null;
}

export interface VoiceTransport {
  connect(events: TransportEvents, options: ConnectOptions): Promise<void>;
  sendAudio(pcm: Int16Array): void;
  /** Nudges the model to take a turn. Used once, to open the call. */
  sendText(text: string): void;
  /** The microphone went quiet on purpose (muted or stopped). */
  sendAudioStreamEnd(): void;
  close(): void;
}

/* ------------------------------------------------------------------ */
/* The live provider                                                   */
/* ------------------------------------------------------------------ */

interface LiveSessionLike {
  sendRealtimeInput(params: { audio?: { data: string; mimeType: string }; audioStreamEnd?: boolean }): void;
  sendClientContent(params: { turns: string; turnComplete: boolean }): void;
  close(): void;
}

export class RealtimeTransport implements VoiceTransport {
  private session: LiveSessionLike | null = null;
  private closed = false;
  /*
   * Setup can complete while the connect call is still resolving, so anything
   * asked for in that window (the opening greeting) is held here and sent the
   * moment the session exists. Without this the greeting is silently dropped.
   */
  private pendingText: string | null = null;

  constructor(
    private readonly token: string,
    private readonly model: string,
  ) {}

  async connect(events: TransportEvents, options: ConnectOptions): Promise<void> {
    // Loaded only when a conversation starts, so the chat never pays for it otherwise.
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey: this.token, httpOptions: { apiVersion: "v1alpha" } });
    let ready = false;
    const session = await client.live.connect({
      model: this.model,
      // Everything that matters was locked into the token on the server; the connection adds only resumption.
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: options.resumptionHandle ? { handle: options.resumptionHandle } : {},
      },
      callbacks: {
        onopen: () => {
          // The session is usable once setup completes; `onReady` fires from that message.
        },
        onmessage: (message) => {
          if (this.closed) return;
          if (message.setupComplete && !ready) {
            ready = true;
            events.onReady();
          }
          const content = message.serverContent;
          if (content) {
            if (content.interrupted) events.onInterrupted();
            for (const part of content.modelTurn?.parts ?? []) {
              const data = part.inlineData?.data;
              if (data) events.onAudio(base64ToPcm(data));
            }
            if (content.inputTranscription?.text) events.onInputTranscript(content.inputTranscription.text, Boolean(content.inputTranscription.finished));
            if (content.outputTranscription?.text) events.onOutputTranscript(content.outputTranscription.text);
            if (content.turnComplete) events.onTurnComplete();
          }
          if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
            events.onResumptionHandle(message.sessionResumptionUpdate.newHandle);
          }
          if (message.goAway) events.onGoAway(parseDuration(message.goAway.timeLeft));
        },
        onerror: () => {
          if (!this.closed) events.onError("The voice connection hit a problem.");
        },
        onclose: (event) => {
          if (!this.closed) events.onClose(event.code, event.reason);
        },
      },
    });
    if (this.closed) {
      session.close();
      return;
    }
    this.session = session;
    // Some servers send setupComplete before the SDK resolves; either way the session is live now.
    if (!ready) {
      ready = true;
      events.onReady();
    }
    if (this.pendingText !== null) {
      const text = this.pendingText;
      this.pendingText = null;
      session.sendClientContent({ turns: text, turnComplete: true });
    }
  }

  sendAudio(pcm: Int16Array) {
    this.session?.sendRealtimeInput({ audio: { data: pcmToBase64(pcm), mimeType: "audio/pcm;rate=16000" } });
  }

  sendText(text: string) {
    if (this.session) this.session.sendClientContent({ turns: text, turnComplete: true });
    else this.pendingText = text;
  }

  sendAudioStreamEnd() {
    this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }

  close() {
    this.closed = true;
    try {
      this.session?.close();
    } catch {
      // Already gone.
    }
    this.session = null;
  }
}

/** "12.5s" → 12500. */
function parseDuration(value: string | undefined): number | null {
  if (!value) return null;
  const seconds = Number.parseFloat(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

/* ------------------------------------------------------------------ */
/* The stand-in (AI_MOCK=1)                                            */
/* ------------------------------------------------------------------ */

const SPEECH_RMS = 0.015;
const SPEECH_START_MS = 400;
const SILENCE_END_MS = 600;
const BARGE_IN_MS = 250;
const REPLY_MS = 2400;
const CHUNK_MS = 100;
const THINK_MS = 500;

/** Set in the browser by the tests to make the stand-in drop the connection once, after its first reply. */
export const MOCK_DROP_FLAG = "gixxer-voice-mock-drop";

/**
 * A voice provider that never leaves the browser: it listens for loudness in the
 * audio it is sent, treats a run of it as speech, answers with a tone and a
 * written reply, and lets itself be interrupted. It exists so the whole window,
 * the turn-taking and the persistence can be exercised without a network.
 */
export class MockTransport implements VoiceTransport {
  private events: TransportEvents | null = null;
  private phase: "listening" | "thinking" | "speaking" = "listening";
  private speechMs = 0;
  private silenceMs = 0;
  private bargeMs = 0;
  private heard = false;
  private turns = 0;
  private timers = new Set<number>();
  private closed = false;

  async connect(events: TransportEvents): Promise<void> {
    this.events = events;
    this.after(30, () => events.onReady());
  }

  private after(ms: number, run: () => void): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.closed) run();
    }, ms);
    this.timers.add(id);
    return id;
  }

  sendAudio(pcm: Int16Array) {
    if (!this.events || this.closed) return;
    let sum = 0;
    for (let index = 0; index < pcm.length; index += 4) {
      const sample = pcm[index]! / 0x8000;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.ceil(pcm.length / 4));
    const ms = (pcm.length / 16_000) * 1000;
    const speaking = rms > SPEECH_RMS;

    if (this.phase === "speaking") {
      this.bargeMs = speaking ? this.bargeMs + ms : 0;
      if (this.bargeMs >= BARGE_IN_MS) this.interrupt();
      return;
    }
    if (this.phase !== "listening") return;

    if (speaking) {
      this.speechMs += ms;
      this.silenceMs = 0;
      if (!this.heard && this.speechMs >= SPEECH_START_MS) this.heard = true;
    } else if (this.heard) {
      this.silenceMs += ms;
      if (this.silenceMs >= SILENCE_END_MS) this.endOfSpeech();
    }
  }

  private endOfSpeech() {
    const events = this.events!;
    const seconds = Math.round(this.speechMs / 100) / 10;
    const said = `Something said for ${seconds} seconds`;
    this.phase = "thinking";
    this.speechMs = 0;
    this.silenceMs = 0;
    this.heard = false;
    events.onInputTranscript(said, true);
    this.after(THINK_MS, () => this.speak(`Mock voice reply to: ${said}.`));
  }

  private speak(reply: string) {
    const events = this.events!;
    this.phase = "speaking";
    this.bargeMs = 0;
    events.onOutputTranscript(reply);
    const samplesPerChunk = (24_000 * CHUNK_MS) / 1000;
    const chunks = REPLY_MS / CHUNK_MS;
    let sent = 0;
    const tick = () => {
      if (this.phase !== "speaking") return;
      const pcm = new Int16Array(samplesPerChunk);
      for (let index = 0; index < pcm.length; index++) {
        const t = (sent * samplesPerChunk + index) / 24_000;
        // A soft two-note tone, quiet enough to sit under a voice if one ever played alongside it.
        pcm[index] = Math.round(Math.sin(2 * Math.PI * 330 * t) * 0.18 * 0x7fff * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * t)));
      }
      events.onAudio(pcm);
      sent += 1;
      if (sent < chunks) this.after(CHUNK_MS, tick);
      else this.after(CHUNK_MS, () => this.finishTurn());
    };
    tick();
  }

  private finishTurn() {
    if (this.phase !== "speaking") return;
    this.phase = "listening";
    this.turns += 1;
    this.events!.onTurnComplete();
    let drop = false;
    try {
      drop = localStorage.getItem(MOCK_DROP_FLAG) === "1";
      if (drop) localStorage.removeItem(MOCK_DROP_FLAG);
    } catch {
      drop = false;
    }
    if (drop) this.after(150, () => this.events!.onClose(1006, "mock drop"));
  }

  private interrupt() {
    this.phase = "listening";
    this.bargeMs = 0;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.heard = false;
    this.events!.onInterrupted();
    this.events!.onTurnComplete();
  }

  sendText() {
    // Whatever it is asked to open with, the stand-in answers in its own words.
    if (this.phase !== "listening") return;
    this.phase = "thinking";
    this.after(THINK_MS, () => this.speak("Hi, I'm Gixxer. How can I help you?"));
  }

  sendAudioStreamEnd() {
    this.speechMs = 0;
    this.silenceMs = 0;
    this.heard = false;
  }

  close() {
    this.closed = true;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    this.events = null;
  }
}
