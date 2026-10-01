/**
 * Best-effort client IP from proxy headers. Only trustworthy when the app sits
 * behind a proxy that overwrites these headers; used for rate limiting, never for authorization.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}
