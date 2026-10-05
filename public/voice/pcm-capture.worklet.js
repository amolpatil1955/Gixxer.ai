/*
 * Microphone capture for the voice assistant. Runs on the audio thread: turns
 * the float samples the browser hands us into 16-bit PCM at 16 kHz (resampling
 * by decimation when the context runs at another rate), batches them into
 * 100 ms chunks and posts each chunk with its loudness. Muting zeroes the
 * samples here, so a muted microphone sends silence rather than nothing and the
 * server's turn detection stays in step.
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = 16000;
    this.step = sampleRate / this.target;
    this.cursor = 0;
    this.chunk = new Int16Array(1600);
    this.filled = 0;
    this.energy = 0;
    this.muted = false;
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "mute") this.muted = Boolean(event.data.muted);
    };
  }

  push(sample) {
    const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    this.energy += clamped * clamped;
    this.chunk[this.filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    if (this.filled === this.chunk.length) {
      const level = Math.sqrt(this.energy / this.filled);
      // A copy is transferred so the next chunk can reuse this buffer at once.
      const pcm = this.chunk.slice().buffer;
      this.port.postMessage({ type: "chunk", pcm, level }, [pcm]);
      this.filled = 0;
      this.energy = 0;
    }
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    if (this.step === 1) {
      for (let i = 0; i < input.length; i++) this.push(this.muted ? 0 : input[i]);
      return true;
    }
    // Decimate to 16 kHz: take one sample every `step` input samples.
    for (let i = 0; i < input.length; i++) {
      this.cursor += 1;
      if (this.cursor >= this.step) {
        this.cursor -= this.step;
        this.push(this.muted ? 0 : input[i]);
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
