import { userFacingProviderMessage } from "@/lib/ai/manager";
import { isProviderError } from "@/lib/ai/errors";
import { enforceLimit, jsonError, readJson, requireApiUser } from "@/lib/api/respond";
import { listImages } from "@/lib/images/repository";
import { createImage } from "@/lib/images/service";
import { generateImageSchema } from "@/lib/images/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";

export const maxDuration = 120;

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  return Response.json({ ok: true, images: await listImages(user.id) });
}

/** Generates one image and returns its record. The bytes are fetched from /api/images/[id]. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const limited = await enforceLimit(aiRateLimits.imagesByUser, `images:${user.id}`);
  if (limited) return limited;

  const parsed = generateImageSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  try {
    const image = await createImage(user.id, { ...parsed.data, signal: request.signal });
    return Response.json({ ok: true, image }, { status: 201 });
  } catch (error) {
    if (isProviderError(error)) {
      console.warn(`[images] generation failed (${error.code}): ${error.message}`);
      return jsonError(error.code === "rate_limited" ? 429 : 502, userFacingProviderMessage(error));
    }
    console.error("[images] generation failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
