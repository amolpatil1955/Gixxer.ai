import "server-only";
import { deflateSync } from "node:zlib";
import type { ChatTurn, ImageRequest, ImageResult, StreamOptions, TextDelta, TextProvider, TranscriptionRequest, TranscriptionResult } from "../types";

/*
 * Deterministic stand-ins for every provider, used when AI_MOCK=1. The chat
 * mock echoes the last user turn so tests can assert on it; the image mock
 * draws a real PNG so the storage and download paths are exercised for real.
 */

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      },
      { once: true },
    );
  });
}

export const mockProvider: TextProvider = {
  name: "mock",
  model: "mock",
  async *stream(turns: ChatTurn[], options: StreamOptions = {}): AsyncGenerator<TextDelta> {
    const lastUser = [...turns].reverse().find((turn) => turn.role === "user")?.content ?? "";
    const context = turns.filter((turn) => turn.role === "system").map((turn) => turn.content).join("\n");
    const cited = context.match(/\[source: ([^\]]+)\]/g) ?? [];
    if (options.reasoning) {
      for (const word of `Thinking about: ${lastUser.slice(0, 80)}. Checking the context first.`.split(/(?<= )/)) {
        await sleep(8, options.signal);
        yield { reasoning: word };
      }
    }
    const reply = `Mock reply to: ${lastUser.slice(0, 200)}${cited.length ? ` (using ${cited.length} source${cited.length === 1 ? "" : "s"}: ${cited.join(" ")})` : ""}`;
    for (const word of reply.split(/(?<= )/)) {
      await sleep(12, options.signal);
      yield { text: word };
    }
  },
};

/** Deterministic pseudo-embedding: a bag of character trigrams hashed into 64 buckets. */
export function mockEmbed(texts: string[]): number[][] {
  return texts.map((text) => {
    const vector = new Array<number>(64).fill(0);
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length - 2; i++) {
      const gram = lower.slice(i, i + 3);
      let hash = 0;
      for (const char of gram) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      vector[hash % 64] = (vector[hash % 64] ?? 0) + 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  });
}

/** The mock hears the same sentence in every recording; tests assert on it. */
export async function mockTranscribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
  await sleep(120, request.signal);
  return { text: request.bytes.length > 0 ? "Mock transcript of your recording." : "", model: "mock" };
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** A real PNG: a diagonal greyscale gradient whose phase depends on the seed. */
export async function mockImage(request: ImageRequest): Promise<ImageResult> {
  // Long enough for the studio's progress ring to be seen doing its job.
  await sleep(900, request.signal);
  const { width, height, seed } = request;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const value = Math.round((((x + y + seed) % (width + height)) / (width + height)) * 255);
      row[1 + x * 3] = value;
      row[2 + x * 3] = value;
      row[3 + x * 3] = value;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return { bytes: png, mime: "image/png", model: "mock" };
}
