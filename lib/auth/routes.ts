/** Route table shared by the proxy, pages and components. Client-safe. */
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  app: "/app",
  sessionExpired: "/session-expired",
} as const;

const PROTECTED_PREFIXES: readonly string[] = [routes.app];
const AUTH_PAGES: readonly string[] = [routes.login, routes.register];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthPagePath(pathname: string): boolean {
  return AUTH_PAGES.includes(pathname);
}

/**
 * Only ever redirect to a same-origin path. Rejects protocol-relative URLs,
 * absolute URLs, control characters and anything not starting with a single slash.
 */
export function safeInternalPath(candidate: string | null | undefined, fallback: string = routes.app): string {
  if (typeof candidate !== "string") return fallback;
  const value = candidate.trim();
  if (!/^\/(?![/\\])/.test(value)) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (isAuthPagePath(value.split("?")[0] ?? "")) return fallback;
  return value;
}
