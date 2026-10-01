import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";
import { isAuthPagePath, isProtectedPath, routes } from "@/lib/auth/routes";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";

const { auth } = NextAuth(authConfig);

/** The public chatbot embed is the one page other sites may frame. */
function isEmbedPath(pathname: string): boolean {
  return pathname === "/embed" || pathname.startsWith("/embed/");
}

/**
 * Runs before every page request (see `config.matcher`):
 * 1. Gate protected routes on a valid session cookie. Pages still perform the
 *    authoritative check against the database via `requireUser()`.
 * 2. Keep signed-in users away from the login/register pages.
 * 3. Attach a per-request nonce-based Content Security Policy.
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth?.user);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL(routes.login, request.nextUrl);
    if (pathname !== routes.app) loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPagePath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL(routes.app, request.nextUrl));
  }

  const nonce = generateNonce();
  const embeddable = isEmbedPath(pathname);
  const csp = buildContentSecurityPolicy({ nonce, isDevelopment: process.env.NODE_ENV === "development", embeddable });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
});

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|icon\\.svg|widget\\.js|.*\\.(?:png|jpg|jpeg|gif|webp|ico|svg|txt|xml|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
