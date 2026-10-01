import type { NextAuthConfig } from "next-auth";
import { routes } from "./routes";

const DAY = 24 * 60 * 60;

/**
 * Auth.js configuration that is safe to load anywhere, including the proxy:
 * no database access, no provider `authorize` logic. `auth.ts` completes it.
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: routes.login, error: routes.login },
  session: { strategy: "jwt", maxAge: 30 * DAY, updateAge: 1 * DAY },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sv = user.sessionVersion ?? 1;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.sessionVersion = token.sv ?? 1;
      return session;
    },
  },
  logger: {
    error(error) {
      // Wrong passwords are expected traffic, not incidents.
      if (error.name === "CredentialsSignin") return;
      console.error("[auth]", error);
    },
    warn(code) {
      console.warn("[auth]", code);
    },
    debug() {},
  },
} satisfies NextAuthConfig;
