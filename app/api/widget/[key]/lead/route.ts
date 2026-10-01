import type { NextRequest } from "next/server";
import { enforceLimit, jsonError, readJson } from "@/lib/api/respond";
import { createLead, getLiveBotByKey, getOrCreateVisitorConversation } from "@/lib/bots/repository";
import { leadSchema } from "@/lib/bots/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { getClientIp } from "@/lib/security/request";

/** Public: a visitor leaves their contact details. Stored under the bot's owner. */
export async function POST(request: NextRequest, context: RouteContext<"/api/widget/[key]/lead">) {
  const { key } = await context.params;
  const found = await getLiveBotByKey(key);
  if (!found || !found.bot.behavior.collectLeads) return jsonError(404, "This chatbot is not available.");

  const limited = await enforceLimit(aiRateLimits.leadsByIp, `lead:${getClientIp(request.headers)}`);
  if (limited) return limited;

  const parsed = leadSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Please check the form.");

  try {
    const conversation = await getOrCreateVisitorConversation(found.ownerId, found.bot.id, parsed.data.sessionId, null);
    await createLead(found.ownerId, found.bot.id, conversation.id, {
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[widget] lead failed", error instanceof Error ? error.message : error);
    return jsonError(500, "Something went wrong on our side. Please try again.");
  }
}
