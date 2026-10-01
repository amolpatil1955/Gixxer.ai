export type AuthErrorCode = "EMAIL_TAKEN" | "INVALID_CREDENTIALS" | "RATE_LIMITED" | "UNAVAILABLE";

/** Errors the auth service raises on purpose. Anything else is a bug or an outage. */
export class AuthServiceError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

export function isAuthServiceError(error: unknown, code?: AuthErrorCode): error is AuthServiceError {
  return error instanceof AuthServiceError && (code === undefined || error.code === code);
}
