import type { NextRequest } from "next/server";
import { enforceLimit, jsonError, requireApiUser } from "@/lib/api/respond";
import { getEnv } from "@/lib/env";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { searchPhotos, UnsplashError } from "@/lib/unsplash/client";
import { mockSearch } from "@/lib/unsplash/mock";
import { unsplashSearchSchema } from "@/lib/unsplash/validation";

/** Photo search, signed-in only. The browser never talks to Unsplash and never sees a key. */
export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const parsed = unsplashSearchSchema.safeParse({ query: request.nextUrl.searchParams.get("q") ?? "", page: request.nextUrl.searchParams.get("page") ?? "1" });
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  const limited = await enforceLimit(aiRateLimits.photoSearchByUser, `photos:${user.id}`);
  if (limited) return limited;

  if (getEnv().AI_MOCK) return Response.json({ ok: true, ...mockSearch(parsed.data.query, parsed.data.page, 24) });

  try {
    return Response.json({ ok: true, ...(await searchPhotos(parsed.data.query, parsed.data.page)) });
  } catch (error) {
    if (error instanceof UnsplashError) {
      console.warn(`[unsplash] search failed (${error.code}): ${error.message}`);
      if (error.code === "not_configured") return jsonError(503, "Photo search is not set up on this deployment yet.");
      if (error.code === "rate_limited") return jsonError(429, "Photo search is busy right now. Try again in a minute.");
      return jsonError(502, "Photos could not be fetched right now. Please try again.");
    }
    console.error("[unsplash] search failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
