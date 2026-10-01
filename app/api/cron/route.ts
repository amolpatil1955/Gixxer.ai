import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { jsonError } from "@/lib/api/respond";
import { runDueSchedules } from "@/lib/schedules/service";

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-cron-secret") ?? "");
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Runs everyone's due schedules. Meant for an external scheduler (a platform
 * cron, a systemd timer) that calls it every few minutes with the shared
 * secret. Closed entirely when CRON_SECRET is not set.
 */
export async function POST(request: Request) {
  if (!authorised(request)) return jsonError(404, "Not found");
  try {
    const ran = await runDueSchedules();
    return Response.json({ ok: true, ran });
  } catch (error) {
    console.error("[cron] sweep failed", error instanceof Error ? error.message : error);
    return jsonError(500, "The sweep failed.");
  }
}
