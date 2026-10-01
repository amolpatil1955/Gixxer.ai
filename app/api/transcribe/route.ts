import { transcribeAudio, userFacingProviderMessage } from "@/lib/ai/manager";
import { isProviderError } from "@/lib/ai/errors";
import { enforceLimit, jsonError, requireApiUser } from "@/lib/api/respond";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const ACCEPTED = /^audio\/(webm|ogg|wav|x-wav|mp4|mpeg|m4a)|^video\/(webm|mp4)/;

/** Voice input for the composer: a short recording in, its transcript out. Nothing is stored. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const limited = await enforceLimit(aiRateLimits.transcribeByUser, `transcribe:${user.id}`);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Send the recording as multipart form data.");
  }
  const entry = form.get("audio");
  if (!(entry instanceof File)) return jsonError(400, "No recording was attached.");
  if (entry.size === 0) return jsonError(400, "The recording is empty.");
  if (entry.size > MAX_AUDIO_BYTES) return jsonError(413, "Keep recordings under 8 MB.");
  const mime = entry.type.split(";")[0]?.trim() || "audio/webm";
  if (!ACCEPTED.test(mime)) return jsonError(415, "That recording format is not supported.");
  const language = form.get("language");

  try {
    const bytes = Buffer.from(await entry.arrayBuffer());
    const result = await transcribeAudio({ bytes, mime, language: typeof language === "string" && /^[a-z]{2}$/.test(language) ? language : undefined, signal: request.signal });
    return Response.json({ ok: true, text: result.text });
  } catch (error) {
    if (isProviderError(error)) {
      console.warn(`[transcribe] failed (${error.code}): ${error.message}`);
      return jsonError(error.code === "rate_limited" ? 429 : 502, userFacingProviderMessage(error));
    }
    console.error("[transcribe] failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
