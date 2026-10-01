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
import { loginSchema } from "./validation";

function googleProviderIfConfigured() {
  const env = getEnv();
  if (!GOOGLE_SIGN_IN_ENABLED || !env.AUTH_GOOGLE_ID || !env.AUTH_GOOGLE_SECRET) return [];
  return [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })];
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
}));
