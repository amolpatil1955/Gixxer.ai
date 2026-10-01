import type { NextRequest } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api/respond";
import { previewFile } from "@/lib/files/preview";

/** A file's contents shaped for the preview panel: sheets, pages or text. Owner only. */
export async function GET(_request: NextRequest, context: RouteContext<"/api/files/[id]/preview">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  try {
    const preview = await previewFile(user.id, id);
    if (!preview) return jsonError(404, "That file was not found.");
    return Response.json({ ok: true, preview }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (error) {
    console.error("[files] preview failed", error instanceof Error ? error.message : error);
    return jsonError(500, "The preview could not be built.");
  }
}
