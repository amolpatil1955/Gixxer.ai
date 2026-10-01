import { enforceLimit, jsonError, ndjsonStream, readJson, requireApiUser } from "@/lib/api/respond";
import { ChatError, runTurn } from "@/lib/chat/service";
import { chatRequestSchema } from "@/lib/chat/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";

export const maxDuration = 180;

/** One assistant turn, streamed. The client's abort (stop button) ends the stream and keeps the partial reply. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const limited = await enforceLimit(aiRateLimits.chatByUser, `chat:${user.id}`);
  if (limited) return limited;

  const parsed = chatRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  try {
    const events = runTurn(user.id, parsed.data, request.signal);
    // The first event resolves or rejects before we commit to a streaming response.
    const iterator = events[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) return jsonError(500, "The reply could not be started.");
    async function* rest() {
      yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    }
    return ndjsonStream(rest());
  } catch (error) {
    if (error instanceof ChatError) return jsonError(error.code === "not_found" ? 404 : 400, error.message);
    console.error("[chat] request failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
