import { after } from "next/server";
import { enforceLimit, jsonError, requireApiUser } from "@/lib/api/respond";
import { listFiles } from "@/lib/files/repository";
import { processFile, uploadFile, UploadError } from "@/lib/files/service";
import { MAX_UPLOAD_BYTES } from "@/lib/files/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";

export const maxDuration = 120;

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  return Response.json({ ok: true, files: await listFiles(user.id) });
}

/** Multipart upload of one file. Indexing runs after the response so the upload returns at once. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const limited = await enforceLimit(aiRateLimits.uploadsByUser, `upload:${user.id}`);
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 4096) return jsonError(413, "Files must be 20 MB or smaller.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Send the file as multipart form data.");
  }
  const entry = form.get("file");
  if (!(entry instanceof File)) return jsonError(400, "No file was attached.");
  if (entry.size > MAX_UPLOAD_BYTES) return jsonError(413, "Files must be 20 MB or smaller.");

  try {
    const bytes = Buffer.from(await entry.arrayBuffer());
    const file = await uploadFile(user.id, { name: entry.name, mime: entry.type, bytes });
    if (file.status === "indexing") after(() => processFile(user.id, file.id));
    return Response.json({ ok: true, file }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return jsonError(400, error.message);
    console.error("[files] upload failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
