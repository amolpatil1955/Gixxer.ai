import { enforceLimit, jsonError, readJson, requireApiUser } from "@/lib/api/respond";
import { getEnv } from "@/lib/env";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { trackDownload, UnsplashError } from "@/lib/unsplash/client";
import { mockDownload } from "@/lib/unsplash/mock";
import { unsplashDownloadSchema } from "@/lib/unsplash/validation";

/** Reports a download to Unsplash (required by its guidelines) and returns the file's address. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const parsed = unsplashDownloadSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  const limited = await enforceLimit(aiRateLimits.photoSearchByUser, `photos:${user.id}`);
  if (limited) return limited;

  if (getEnv().AI_MOCK) {
    const mocked = mockDownload(parsed.data.photoId);
    return mocked ? Response.json({ ok: true, ...mocked }) : jsonError(404, "That photo was not found.");
  }

  try {
    return Response.json({ ok: true, ...(await trackDownload(parsed.data.photoId)) });
  } catch (error) {
    if (error instanceof UnsplashError) {
      console.warn(`[unsplash] download failed (${error.code}): ${error.message}`);
      if (error.code === "bad_request") return jsonError(404, "That photo was not found.");
      return jsonError(error.code === "rate_limited" ? 429 : 502, "The photo could not be fetched right now. Please try again.");
    }
    console.error("[unsplash] download failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
