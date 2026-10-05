"use client";

/*
 * The two halves of the browser's audio for a voice conversation.
 *
 * `MicCapture` opens the microphone once, runs it through the capture worklet
 * and hands out 16-bit PCM at 16 kHz in 100 ms chunks. `PcmPlayer` takes the
 * model's 16-bit PCM at 24 kHz and plays it gaplessly, scheduling each chunk
 * right after the last; `interrupt()` silences it at once, which is what makes
 * talking over the assistant feel immediate. Both own exactly one AudioContext
 * and release every track, node and context in `close()`.
 */

export const INPUT_RATE = 16_000;
export const OUTPUT_RATE = 24_000;

export function voiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Boolean(window.isSecureContext && AudioContextCtor && typeof AudioWorkletNode === "function" && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof WebSocket === "function");
}

function audioContextFor(sampleRate: number): AudioContext {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  try {
    return new AudioContextCtor({ sampleRate, latencyHint: "interactive" });
  } catch {
    // Some browsers refuse a fixed rate; the worklet resamples instead.
    return new AudioContextCtor({ latencyHint: "interactive" });
  }
}

export function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function base64ToPcm(data: string): Int16Array {
  const binary = atob(data);
  const even = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(even);
  for (let index = 0; index < even; index++) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
}

export interface MicCaptureHandlers {
  onChunk: (pcm: Int16Array, level: number) => void;
}

export class MicCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private closed = false;

  /** Asks for the microphone. Throws the browser's own error (NotAllowedError, NotFoundError…) so the caller can explain it. */
  async open(handlers: MicCaptureHandlers): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (this.closed) {
      this.stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.context = audioContextFor(INPUT_RATE);
    await this.context.audioWorklet.addModule("/voice/pcm-capture.worklet.js");
    if (this.closed) return this.close();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, "pcm-capture", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 });
    this.node.port.onmessage = (event: MessageEvent<{ type: string; pcm: ArrayBuffer; level: number }>) => {
      if (event.data?.type === "chunk") handlers.onChunk(new Int16Array(event.data.pcm), event.data.level);
    };
    this.source.connect(this.node);
    if (this.context.state === "suspended") await this.context.resume();
    // A track that ends on its own (device unplugged, permission revoked) must surface as a stop, not silence.
    for (const track of this.stream.getAudioTracks()) track.addEventListener("ended", () => this.onEnded?.());
  }

  onEnded: (() => void) | null = null;

  setMuted(muted: boolean) {
    this.node?.port.postMessage({ type: "mute", muted });
    // The track itself is also disabled, so the browser's recording indicator reflects it where supported.
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  close() {
    this.closed = true;
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.node = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}

export class PcmPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null;

  async open(): Promise<void> {
    this.context = audioContextFor(OUTPUT_RATE);
    this.gain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.gain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    if (this.context.state === "suspended") await this.context.resume();
  }

  /** Whether anything is scheduled or still sounding. */
  get playing(): boolean {
    return this.sources.size > 0;
  }

  /** Loudness right now, 0 to 1, for the visualiser. Cheap enough to read a few times a second. */
  level(): number {
    if (!this.analyser || !this.levelBuffer || this.sources.size === 0) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (const value of this.levelBuffer) {
      const centred = (value - 128) / 128;
      sum += centred * centred;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuffer.length) * 2.2);
  }

  enqueue(pcm: Int16Array, onDrained: () => void) {
    const context = this.context;
    const gain = this.gain;
    if (!context || !gain || pcm.length === 0) return;
    const buffer = context.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index++) channel[index] = pcm[index]! / 0x8000;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    // Start right after the previous chunk, or almost now if the queue had run dry.
    const startAt = Math.max(context.currentTime + 0.02, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (this.sources.size === 0) onDrained();
    };
  }

  /** Silences playback at once and forgets what was queued. */
  interrupt() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished.
      }
      source.disconnect();
    }
    this.sources.clear();
    this.nextStart = 0;
  }

  close() {
    this.interrupt();
    this.gain?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.gain = null;
    this.analyser = null;
  }
}
