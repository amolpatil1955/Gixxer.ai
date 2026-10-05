import { isProviderError } from "@/lib/ai/errors";
import { userFacingProviderMessage, voiceConfigured } from "@/lib/ai/manager";
import { enforceLimit, jsonError, readJson, requireApiUser } from "@/lib/api/respond";
import { ChatError } from "@/lib/chat/service";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { openVoiceSession } from "@/lib/voice/service";
import { voiceSessionSchema } from "@/lib/voice/validation";

export const maxDuration = 30;

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
      console.warn(`[voice] session refused (${error.code}): ${error.message}`);
      return jsonError(error.code === "rate_limited" ? 429 : error.code === "not_configured" ? 503 : 502, userFacingProviderMessage(error));
    }
    console.error("[voice] session failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
