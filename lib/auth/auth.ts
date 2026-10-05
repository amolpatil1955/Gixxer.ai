import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getEnv } from "@/lib/env";
import { getClientIp } from "@/lib/security/request";
import { authConfig } from "./auth.config";
import { verifyCredentials } from "./auth-service";
import { GOOGLE_SIGN_IN_ENABLED } from "./features";
import { clearLoginAttempts, consumeLoginAttempt, RateLimitedSignin } from "./login-guard";
import { upsertOAuthUser } from "./user-repository";
import { loginSchema } from "./validation";

/**
 * Google OAuth. The credentials come from AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (server-side,
 * via lib/env). The callback Auth.js answers on is `<APP_URL>/api/auth/callback/google`,
 * which must be registered on the Google client for every origin the app runs on.
 * The provider is only mounted while GOOGLE_SIGN_IN_ENABLED is true, so the sign-in
 * endpoint cannot be reached while the button is disabled.
 */
export function googleProviderIfConfigured() {
  const env = getEnv();
  if (!GOOGLE_SIGN_IN_ENABLED || !env.AUTH_GOOGLE_ID || !env.AUTH_GOOGLE_SECRET) return [];
  return [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Always ask which account to use; never silently reuse the last one.
      authorization: { params: { prompt: "select_account", access_type: "online", scope: "openid email profile" } },
    }),
  ];
}

/** Whether Google is fully configured, for diagnostics. Never exposes the values. */
export function googleAuthStatus(): { configured: boolean; enabled: boolean; available: boolean; callbackPath: string } {
  const env = getEnv();
  const configured = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  return {
    configured,
    enabled: GOOGLE_SIGN_IN_ENABLED,
    available: configured && GOOGLE_SIGN_IN_ENABLED,
    callbackPath: "/api/auth/callback/google",
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  secret: getEnv().AUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      /**
       * The single gate for credentials sign-in. Both the server action and the
       * `/api/auth/callback/credentials` endpoint end up here, so the rate limit
       * lives here rather than in the action.
       */
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const guard = await consumeLoginAttempt(email, getClientIp(request.headers));
        if (!guard.allowed) throw new RateLimitedSignin();

        const user = await verifyCredentials(email, password);
        if (!user) return null;

        await clearLoginAttempts(email);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    ...googleProviderIfConfigured(),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /** Only verified Google emails may link to or create an account. */
    signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return Boolean(profile?.email && profile.email_verified);
    },
    /**
     * There is no database adapter: sessions are JWTs that carry our own user id. A Google
     * sign-in therefore has to be mapped to a user document here, on the first callback.
     */
    async jwt(params) {
      const { token, account, profile, user } = params;
      if (account?.provider === "google" && profile?.email) {
        const linked = await upsertOAuthUser({
          email: profile.email,
          name: typeof profile.name === "string" && profile.name ? profile.name : (user?.name ?? profile.email),
          image: typeof profile.picture === "string" ? profile.picture : (user?.image ?? null),
          provider: "google",
        });
        token.uid = linked.id;
        token.sv = linked.sessionVersion;
        token.name = linked.name;
        token.email = linked.email;
        token.picture = linked.image ?? undefined;
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
}));
