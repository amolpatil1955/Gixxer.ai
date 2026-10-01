import "server-only";
import { InferenceClient } from "@huggingface/inference";
import { getEnv } from "@/lib/env";
import { isAbortError, ProviderError } from "../errors";
import type { ImageRequest, ImageResult } from "../types";

const IMAGE_TIMEOUT_MS = 90_000;
const EMBED_TIMEOUT_MS = 30_000;
const EMBED_BATCH = 32;

/** A second model to try when the first one is cold, deprecated or over quota. */
const FALLBACK_MODEL = "Tongyi-MAI/Z-Image-Turbo";

function classify(error: unknown): ProviderError {
  if (isAbortError(error)) return new ProviderError("huggingface", "timeout", "Image generation timed out");
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|too many/i.test(message)) return new ProviderError("huggingface", "rate_limited", message);
  if (/402|credit|quota|payment/i.test(message)) return new ProviderError("huggingface", "unavailable", message, { retryable: false });
  if (/401|403|invalid.*token/i.test(message)) return new ProviderError("huggingface", "not_configured", message, { retryable: false });
  if (/50\d|unavailable|loading|timeout/i.test(message)) return new ProviderError("huggingface", "unavailable", message);
  return new ProviderError("huggingface", "unknown", message, { retryable: false });
}

async function generateWith(model: string, request: ImageRequest, token: string): Promise<ImageResult> {
  const client = new InferenceClient(token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  request.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const blob = await client.textToImage(
      {
        model,
        inputs: request.prompt,
        parameters: { width: request.width, height: request.height, seed: request.seed },
      },
      { outputType: "blob", signal: controller.signal },
    );
    return { bytes: Buffer.from(await blob.arrayBuffer()), mime: blob.type || "image/jpeg", model };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Text-to-image through Hugging Face's inference providers. The client picks
 * a live provider for the model; a retryable failure tries the fallback model
 * once before giving up.
 */
export async function generateImage(request: ImageRequest): Promise<ImageResult> {
  const env = getEnv();
  if (!env.HUGGINGFACE_API_KEY) {
    throw new ProviderError("huggingface", "not_configured", "HUGGINGFACE_API_KEY is not set", { retryable: false });
  }
  try {
    return await generateWith(env.HF_IMAGE_MODEL, request, env.HUGGINGFACE_API_KEY);
  } catch (error) {
    const first = classify(error);
    if (!first.retryable || env.HF_IMAGE_MODEL === FALLBACK_MODEL) throw first;
    console.warn(`[images] ${env.HF_IMAGE_MODEL} failed (${first.code}); trying ${FALLBACK_MODEL}`);
    try {
      return await generateWith(FALLBACK_MODEL, request, env.HUGGINGFACE_API_KEY);
    } catch (second) {
      throw classify(second);
    }
  }
}

/** One vector per text, from a sentence-embedding model. Batched so a large file indexes in a few calls. */
export async function hfEmbed(texts: string[]): Promise<number[][]> {
  const env = getEnv();
  if (!env.HUGGINGFACE_API_KEY) throw new ProviderError("huggingface", "not_configured", "HUGGINGFACE_API_KEY is not set", { retryable: false });
  const client = new InferenceClient(env.HUGGINGFACE_API_KEY);
  const out: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const batch = texts.slice(start, start + EMBED_BATCH);
    let result: unknown[];
    try {
      result = await client.featureExtraction({ model: env.HF_EMBEDDING_MODEL, inputs: batch }, { signal: AbortSignal.timeout(EMBED_TIMEOUT_MS) });
    } catch (error) {
      throw classify(error);
    }
    // One string in, one vector out; several in, one vector each. Token-level
    // outputs (a matrix per text) are mean-pooled so the shape is always [n][d].
    const rows: unknown[] = batch.length === 1 && typeof result[0] === "number" ? [result] : result;
    for (const row of rows) {
      if (Array.isArray(row) && Array.isArray(row[0])) {
        const matrix = row as number[][];
        const width = matrix[0]?.length ?? 0;
        const pooled = new Array<number>(width).fill(0);
        for (const token of matrix) for (let i = 0; i < width; i++) pooled[i] = (pooled[i] ?? 0) + (token[i] ?? 0);
        out.push(pooled.map((value) => value / Math.max(1, matrix.length)));
      } else if (Array.isArray(row)) {
        out.push(row as number[]);
      }
    }
  }
  if (out.length !== texts.length) throw new ProviderError("huggingface", "unknown", `Embedding returned ${out.length} vectors for ${texts.length} texts`, { retryable: false });
  return out;
}
