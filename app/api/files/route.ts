import { after } from "next/server";
import { enforceLimit, jsonError, requireApiUser } from "@/lib/api/respond";
import { getConversation } from "@/lib/chat/repository";
import { listFiles } from "@/lib/files/repository";
import { processFile, uploadFile, UploadError } from "@/lib/files/service";
import { MAX_UPLOAD_BYTES } from "@/lib/files/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";

export const maxDuration = 120;

/** The library, for the composer's "Add from library" picker. Chat files never appear here. */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  return Response.json({ ok: true, files: await listFiles(user.id, { scopes: ["library"] }) });
}

const SCOPES = new Set(["library", "chat", "bot"]);

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

  // Files dropped into a chat belong to that chat; the library page uploads library files.
  const rawScope = form.get("scope");
  const scope = typeof rawScope === "string" && SCOPES.has(rawScope) ? (rawScope as "library" | "chat" | "bot") : "library";
  const rawConversation = form.get("conversationId");
  let conversationId: string | null = null;
  if (scope === "chat" && typeof rawConversation === "string" && rawConversation) {
    const conversation = await getConversation(user.id, rawConversation);
    if (!conversation) return jsonError(404, "That conversation was not found.");
    conversationId = conversation.id;
  }

  try {
    const bytes = Buffer.from(await entry.arrayBuffer());
    const file = await uploadFile(user.id, { name: entry.name, mime: entry.type, bytes, scope, conversationId });
    if (file.status === "indexing") after(() => processFile(user.id, file.id));
    return Response.json({ ok: true, file }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return jsonError(400, error.message);
    console.error("[files] upload failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
