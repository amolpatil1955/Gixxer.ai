import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Bumped server-side to invalidate every existing session for the user. */
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    sessionVersion?: number;
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt` with `export *`, which module
 * augmentation does not merge through. Augment the declaring module directly.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    /** User id. Short key: the JWT travels in a cookie on every request. */
    uid?: string;
    /** Session version, matched against the database to revoke sessions. */
    sv?: number;
  }
}
