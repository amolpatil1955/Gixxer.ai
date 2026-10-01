import type { NextRequest } from "next/server";
import { getLiveBotByKey, toPublicConfig } from "@/lib/bots/repository";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "public, max-age=60",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Public: what the launcher needs to draw itself. Contains nothing an owner would not print on the widget. */
export async function GET(_request: NextRequest, context: RouteContext<"/api/widget/[key]/config">) {
  const { key } = await context.params;
  const found = await getLiveBotByKey(key);
  if (!found) return Response.json({ ok: false, message: "Not found" }, { status: 404, headers: CORS });
  return Response.json({ ok: true, ...toPublicConfig(found.bot) }, { headers: CORS });
}
