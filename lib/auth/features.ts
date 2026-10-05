/**
 * Auth feature flags. Client-safe: contains no secrets.
 * Google sign-in is on. The provider is still only mounted when its credentials are set,
 * and the pages tell the button whether it is actually available.
 */
export const GOOGLE_SIGN_IN_ENABLED = true;
