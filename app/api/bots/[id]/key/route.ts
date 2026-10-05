import type { NextRequest } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api/respond";
import { getBot } from "@/lib/bots/repository";

/**
 * A bot's public key, for the owner only. It identifies the bot to the widget and
 * nothing else; the wizard needs it to show the embed snippet.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/bots/[id]/key">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await context.params;
  const bot = await getBot(user.id, id);
  if (!bot) return jsonError(404, "That chatbot was not found.");
  return Response.json({ ok: true, publicKey: bot.publicKey, status: bot.status });
}
