import { Types } from "mongoose";
import type { NextRequest } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api/respond";
import { openBlobStream } from "@/lib/db/storage";
import { getImage } from "@/lib/images/repository";
import { deleteImage } from "@/lib/images/service";

/** The image bytes, owner only. `?download=1` sends it as an attachment. */
export async function GET(request: NextRequest, context: RouteContext<"/api/images/[id]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const image = await getImage(user.id, id);
  if (!image) return jsonError(404, "That image was not found.");

  const stream = await openBlobStream(new Types.ObjectId(image.storageId));
  const extension = image.mime.includes("png") ? "png" : image.mime.includes("webp") ? "webp" : "jpg";
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new Response(stream, {
    headers: {
      "content-type": image.mime,
      "content-disposition": `${download ? "attachment" : "inline"}; filename="gixxer-${image.seed}.${extension}"`,
      "cache-control": "private, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/images/[id]">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const deleted = await deleteImage(user.id, id);
  return deleted ? Response.json({ ok: true }) : jsonError(404, "That image was not found.");
}
