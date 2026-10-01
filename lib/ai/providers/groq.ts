import "server-only";
import { getEnv } from "@/lib/env";
import { codeForStatus, isAbortError, ProviderError } from "../errors";
import { readSseData } from "../sse";
import type { StreamOptions, TextDelta, TextProvider, TranscriptionRequest, TranscriptionResult } from "../types";
import { withTimeouts } from "./timing";

/*
 * Groq, through its OpenAI-compatible API. Three models play three roles:
 *   - the chat model answers everyday turns as fast as Groq can serve them,
 *   - the think model is a reasoning model whose thinking Groq streams as
 *     separate `reasoning` deltas when asked to (the workspace's Think mode),
 *   - the fallback model continues a reply when the model in front of it
 *     stalls or errors.
 * Whisper, also on Groq, turns the composer's voice recordings into text.
 */

const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

interface GroqChunk {
  choices?: { delta?: { content?: string | null; reasoning?: string | null }; finish_reason?: string | null }[];
  error?: { message?: string };
}

/** Models known to accept Groq's reasoning parameters. Others are asked to answer plainly. */
function supportsReasoning(model: string): boolean {
  return /gpt-oss|deepseek-r1|qwen3(?!\.8)|qwq/i.test(model);
}

export function groqProvider(model: string): TextProvider {
  return {
    name: "groq",
    model,
    async *stream(turns, options: StreamOptions = {}): AsyncGenerator<TextDelta> {
      const env = getEnv();
      if (!env.GROQ_API) throw new ProviderError("groq", "not_configured", "GROQ_API is not set", { retryable: false });

      const reasoning = Boolean(options.reasoning) && supportsReasoning(model);
      const timing = withTimeouts(options);
      let response: Response;
      try {
        response = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API}` },
          body: JSON.stringify({
            model,
            messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
            stream: true,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxOutputTokens ?? 4096,
            ...(reasoning ? { reasoning_format: "parsed", reasoning_effort: "medium" } : {}),
          }),
          signal: timing.signal,
        });
      } catch (error) {
        throw timing.classify(error, "groq");
      }

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        timing.done();
        throw new ProviderError("groq", codeForStatus(response.status), `Groq responded ${response.status}: ${text.slice(0, 200)}`, {
          status: response.status,
        });
      }

      try {
        for await (const data of readSseData(response.body, timing.signal)) {
          if (data === "[DONE]") break;
          let chunk: GroqChunk;
          try {
            chunk = JSON.parse(data) as GroqChunk;
          } catch {
            continue;
          }
          if (chunk.error) throw new ProviderError("groq", "unavailable", chunk.error.message ?? "Groq error");
          const delta = chunk.choices?.[0]?.delta;
          const thought = reasoning ? (delta?.reasoning ?? "") : "";
          if (thought) {
            timing.gotFirstToken();
            yield { reasoning: thought };
          }
          const text = delta?.content ?? "";
          if (text) {
            timing.gotFirstToken();
            yield { text };
          }
        }
      } catch (error) {
        if (isAbortError(error)) throw timing.classify(error, "groq");
        throw error;
      } finally {
        timing.done();
      }
    },
  };
}

const TRANSCRIBE_TIMEOUT_MS = 45_000;

/** Speech to text through Groq's hosted Whisper. */
export async function groqTranscribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
  const env = getEnv();
  if (!env.GROQ_API) throw new ProviderError("groq", "not_configured", "GROQ_API is not set", { retryable: false });
  const extension = request.mime.includes("ogg") ? "ogg" : request.mime.includes("mp4") ? "mp4" : request.mime.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(request.bytes)], { type: request.mime }), `voice.${extension}`);
  form.append("model", env.GROQ_TRANSCRIBE_MODEL);
  form.append("response_format", "json");
  if (request.language) form.append("language", request.language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
  request.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  let response: Response;
  try {
    response = await fetch(TRANSCRIBE_URL, { method: "POST", headers: { authorization: `Bearer ${env.GROQ_API}` }, body: form, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) throw new ProviderError("groq", request.signal?.aborted ? "aborted" : "timeout", "Transcription timed out", { retryable: false });
    throw new ProviderError("groq", "unavailable", error instanceof Error ? error.message : "Network failure");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ProviderError("groq", codeForStatus(response.status), `Whisper responded ${response.status}: ${text.slice(0, 200)}`, { status: response.status });
  }
  const json = (await response.json()) as { text?: string };
  return { text: (json.text ?? "").trim(), model: env.GROQ_TRANSCRIBE_MODEL };
}
