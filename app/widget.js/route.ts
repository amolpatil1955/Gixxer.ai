import { getEnv } from "@/lib/env";
import { widgetScript } from "@/lib/widget/script";

/** The embeddable loader. Any site may fetch it; it carries no secrets. */
export async function GET() {
  const origin = new URL(getEnv().APP_URL).origin;
  return new Response(widgetScript(origin), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    },
  });
}
