import { isAbortError, ProviderError } from "../errors";
import type { StreamOptions } from "../types";

export const DEFAULT_FIRST_TOKEN_MS = 20_000;
export const DEFAULT_TOTAL_MS = 120_000;

/**
 * Two clocks for a streamed reply: one until the first token, one for the
 * whole thing. Either firing aborts the request with a `timeout` error,
 * while the caller's own abort (the user pressing stop) stays an `aborted`.
 */
export function withTimeouts(options: StreamOptions) {
  const controller = new AbortController();
  let timedOut = false;
  let firstTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_MS);
  const totalTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.totalTimeoutMs ?? DEFAULT_TOTAL_MS);

  const forward = () => controller.abort();
  options.signal?.addEventListener("abort", forward, { once: true });
  if (options.signal?.aborted) controller.abort();

  return {
    signal: controller.signal,
    gotFirstToken() {
      if (firstTimer) {
        clearTimeout(firstTimer);
        firstTimer = null;
      }
    },
    done() {
      if (firstTimer) clearTimeout(firstTimer);
      clearTimeout(totalTimer);
      options.signal?.removeEventListener("abort", forward);
    },
    classify(error: unknown, provider: string): ProviderError {
      this.done();
      if (error instanceof ProviderError) return error;
      if (isAbortError(error) || controller.signal.aborted) {
        if (options.signal?.aborted) return new ProviderError(provider, "aborted", "Request aborted", { retryable: false });
        if (timedOut) return new ProviderError(provider, "timeout", "Provider timed out");
      }
      return new ProviderError(provider, "unavailable", error instanceof Error ? error.message : "Network failure");
    },
  };
}
