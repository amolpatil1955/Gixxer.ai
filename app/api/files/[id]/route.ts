import { Types } from "mongoose";
import type { NextRequest } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api/respond";
import { openBlobStream } from "@/lib/db/storage";
import { getFile } from "@/lib/files/repository";
import { deleteFile } from "@/lib/files/service";

/** The file's status as JSON (`?meta=1`), or its bytes. Both only for the owner. */
export async function GET(request: NextRequest, context: RouteContext<"/api/files/[id]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const file = await getFile(user.id, id);
  if (!file) return jsonError(404, "That file was not found.");

  if (request.nextUrl.searchParams.get("meta") === "1") return Response.json({ ok: true, file });

  const stream = await openBlobStream(new Types.ObjectId(file.storageId));
  const inline = (file.kind === "image" || file.kind === "pdf" || file.kind === "txt") && request.nextUrl.searchParams.get("download") !== "1";
  const encoded = encodeURIComponent(file.name);
  return new Response(stream, {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/files/[id]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const deleted = await deleteFile(user.id, id);
  return deleted ? Response.json({ ok: true }) : jsonError(404, "That file was not found.");
}
