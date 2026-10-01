import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { RateLimiter } from "@/lib/security/rate-limit";
import { retryMessage } from "@/lib/security/ai-rate-limits";

/** Shared helpers for route handlers: uniform JSON errors, auth, limits, streaming. */

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ ok: false, message, ...extra }, { status });
}

/** Route handlers answer 401 instead of redirecting, so fetch() callers get a clear signal. */
export async function requireApiUser(): Promise<CurrentUser | Response> {
  const user = await getCurrentUser();
  return user ?? jsonError(401, "Please sign in again.");
}

export async function enforceLimit(limiter: RateLimiter, key: string): Promise<Response | null> {
  const result = await limiter.consume(key);
  if (result.allowed) return null;
  return jsonError(429, retryMessage(result.retryAfterSeconds), { retryAfterSeconds: result.retryAfterSeconds });
}

/**
 * Newline-delimited JSON over a streaming response. Each event is one line,
 * so the client can act on tokens as they arrive without an SSE parser.
 */
export function ndjsonStream<T>(events: AsyncIterable<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      } catch (error) {
        console.error("[api] stream failed", error instanceof Error ? error.message : error);
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: "Something went wrong on our side. Please try again." })}\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
