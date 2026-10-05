import { isProviderError } from "@/lib/ai/errors";
import { voiceConfigured } from "@/lib/ai/manager";
import { enforceLimit, jsonError, readJson, requireApiUser } from "@/lib/api/respond";
import { ChatError } from "@/lib/chat/service";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { openVoiceSession } from "@/lib/voice/service";
import { voiceSessionSchema } from "@/lib/voice/validation";

export const maxDuration = 30;

/**
 * What to tell the reader. A refused or misconfigured request is ours to fix and
 * says so plainly, rather than blaming a provider that is answering fine.
 */
function voiceFailureMessage(error: { code: string }): string {
  switch (error.code) {
    case "not_configured":
      return "Voice conversations are not set up on this deployment yet.";
    case "rate_limited":
      return "Too many voice conversations just now. Try again in a minute.";
    case "timeout":
      return "The voice service did not answer in time. Please try again.";
    case "bad_request":
      return "Voice could not start because of a problem on our side. It has been logged; please try again shortly.";
    default:
      return "The voice service is unavailable right now. Please try again.";
  }
}

/**
 * Opens a realtime voice session for the signed-in user's conversation. The
 * response carries a short-lived, single-use token bound to a configuration the
 * server locked; the provider's own key never leaves this process.
 */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!voiceConfigured()) return jsonError(503, "Voice conversations are not set up on this deployment yet.");

  const limited = await enforceLimit(aiRateLimits.voiceSessionsByUser, `voice:${user.id}`);
  if (limited) return limited;

  const parsed = voiceSessionSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError(400, "Invalid request");

  try {
    return Response.json({ ok: true, session: await openVoiceSession(user.id, parsed.data) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ChatError) return jsonError(error.code === "not_found" ? 404 : 400, error.message);
    if (isProviderError(error)) {
      // The detail goes to the log; the reader gets the one sentence that tells them what to do.
      console.error(`[voice] session refused (${error.code}${error.status ? ` ${error.status}` : ""}): ${error.message}`);
      const status = error.code === "rate_limited" ? 429 : error.code === "not_configured" ? 503 : error.code === "bad_request" ? 500 : 502;
      return jsonError(status, voiceFailureMessage(error));
    }
    console.error("[voice] session failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
