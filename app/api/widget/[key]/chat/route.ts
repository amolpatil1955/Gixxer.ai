import type { NextRequest } from "next/server";
import { enforceLimit, jsonError, ndjsonStream, readJson } from "@/lib/api/respond";
import { getLiveBotByKey } from "@/lib/bots/repository";
import { answerVisitor } from "@/lib/bots/service";
import { widgetMessageSchema } from "@/lib/bots/validation";
import { aiRateLimits } from "@/lib/security/ai-rate-limits";
import { getClientIp } from "@/lib/security/request";

export const maxDuration = 120;

/** The host page's origin, as reported by the embed page. Checked against the bot's allow-list when one is set. */
function hostOrigin(request: NextRequest): string | null {
  const fromQuery = request.nextUrl.searchParams.get("host");
  if (fromQuery) {
    try {
      return new URL(fromQuery).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** Public: one visitor message, answered as a stream. No account, no keys, rate limited twice. */
export async function POST(request: NextRequest, context: RouteContext<"/api/widget/[key]/chat">) {
  const { key } = await context.params;
  const found = await getLiveBotByKey(key);
  if (!found) return jsonError(404, "This chatbot is not available.");
  const { bot, ownerId } = found;

  const origin = hostOrigin(request);
  if (bot.allowedOrigins.length > 0 && (!origin || !bot.allowedOrigins.includes(origin))) {
    return jsonError(403, "This chatbot is not enabled for this website.");
  }

  const ip = getClientIp(request.headers);
  const byIp = await enforceLimit(aiRateLimits.widgetByIp, `widget:ip:${ip}`);
  if (byIp) return byIp;
  const byBot = await enforceLimit(aiRateLimits.widgetByBot, `widget:bot:${bot.id}`);
  if (byBot) return byBot;

  const parsed = widgetMessageSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "Please type a message.");

  return ndjsonStream(answerVisitor(bot, ownerId, { ...parsed.data, origin }, request.signal));
}
