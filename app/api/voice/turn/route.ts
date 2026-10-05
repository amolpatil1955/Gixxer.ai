import { enforceLimit, jsonError, readJson, requireApiUser } from "@/lib/api/respond";
import { ChatError } from "@/lib/chat/service";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { recordVoiceTurn } from "@/lib/voice/service";
import { voiceTurnSchema } from "@/lib/voice/validation";

/** Saves one finished spoken exchange into the owner's chat. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const limited = await enforceLimit(aiRateLimits.voiceTurnsByUser, `voice-turn:${user.id}`);
  if (limited) return limited;

  const parsed = voiceTurnSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  try {
    return Response.json({ ok: true, turn: await recordVoiceTurn(user.id, parsed.data) });
  } catch (error) {
    if (error instanceof ChatError) return jsonError(error.code === "not_found" ? 404 : 400, error.message);
    console.error("[voice] turn failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
