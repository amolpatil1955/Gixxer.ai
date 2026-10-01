export type ProviderErrorCode =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "bad_request"
  | "content_blocked"
  | "aborted"
  | "unknown";

/**
 * Every failure a provider can produce, normalised. `retryable` decides
 * whether the manager retries and then hands over to the fallback provider.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(provider: string, code: ProviderErrorCode, message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? (code === "timeout" || code === "rate_limited" || code === "unavailable");
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/** Maps an HTTP status from a provider to a normalised code. */
export function codeForStatus(status: number): ProviderErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "unavailable";
  if (status === 400 || status === 404 || status === 422) return "bad_request";
  if (status === 401 || status === 403) return "not_configured";
  return "unknown";
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "AbortError")
  );
}
