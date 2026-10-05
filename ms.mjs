import { readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";

/*
 * Builds a WAV of real speech by asking the Live API to say something, then
 * writing what it says back out at 16 kHz. Chromium can play that file as a
 * fake microphone, which is the only way to give the provider's own
 * voice-activity detection something it will actually treat as speech.
 */

const key = readFileSync(process.argv[2], "utf8").trim();
const out = process.argv[3];
const say = process.argv[4] ?? "Say exactly: What are your opening hours on Sunday? Then stop.";
const model = "gemini-3.8-live";

const client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
const chunks = [];

await new Promise((resolve) => {
  setTimeout(resolve, 40_000);
  client.live
    .connect({
      model,
      config: { responseModalities: [Modality.AUDIO], outputAudioTranscription: {} },
      callbacks: {
        onmessage: (m) => {
          for (const part of m.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) chunks.push(Buffer.from(part.inlineData.data, "base64"));
          }
          if (m.serverContent?.turnComplete) resolve();
        },
        onerror: () => resolve(),
        onclose: () => resolve(),
      },
    })
    .then((session) => session.sendClientContent({ turns: say, turnComplete: true }))
    .catch(() => resolve());
});

const raw = Buffer.concat(chunks);
if (raw.length === 0) {
  console.log("NO AUDIO");
  process.exit(1);
}

// 24 kHz in, 16 kHz out: take two of every three samples' worth by linear interpolation.
const input = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
const ratio = 24_000 / 16_000;
const count = Math.floor(input.length / ratio);
const output = new Int16Array(count);
for (let i = 0; i < count; i++) {
  const at = i * ratio;
  const low = Math.floor(at);
  const frac = at - low;
  const a = input[low] ?? 0;
  const b = input[Math.min(input.length - 1, low + 1)] ?? 0;
  output[i] = Math.round(a + (b - a) * frac);
}

const data = Buffer.from(output.buffer);
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(16_000, 24);
header.writeUInt32LE(16_000 * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(out, Buffer.concat([header, data]));
console.log(`WROTE ${out} seconds=${(output.length / 16_000).toFixed(2)}`);
