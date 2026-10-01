import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Guards outbound fetches made on a user's behalf (bot knowledge sources).
 * Only public http(s) hosts are allowed: no loopback, link-local, private
 * ranges, metadata endpoints or raw IP literals that resolve there.
 */

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) return ipv4Blocked(lower.slice(7));
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Blocked(ip);
  if (version === 6) return ipv6Blocked(ip);
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Syntactic checks only. Cheap enough for validation; `resolvePublicUrl` does the DNS part. */
export function parsePublicUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Enter a full address, starting with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Only http and https addresses are supported" };
  if (url.username || url.password) return { ok: false, reason: "Addresses with credentials are not allowed" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "That address is not reachable from here" };
  }
  if (isIP(host) && isBlockedAddress(host)) return { ok: false, reason: "That address is not reachable from here" };
  return { ok: true, url };
}

/** Resolves the host and refuses anything that lands on a private network. */
export async function resolvePublicUrl(raw: string): Promise<UrlCheck> {
  const parsed = parsePublicUrl(raw);
  if (!parsed.ok) return parsed;
  const host = parsed.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return parsed;
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return { ok: false, reason: "That address is not reachable from here" };
    }
  } catch {
    return { ok: false, reason: "That address could not be resolved" };
  }
  return parsed;
}
