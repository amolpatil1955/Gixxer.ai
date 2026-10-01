/** Client-safe reader for newline-delimited JSON responses. */
export async function readNdjson<T>(response: Response, onEvent: (event: T) => void): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as T);
    } catch {
      // A torn line from a dropped connection; nothing to act on.
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    handle(buffer);
  } finally {
    reader.releaseLock();
  }
}

/** Reads a JSON error body from a failed fetch, falling back to a generic line. */
export async function errorMessageFrom(response: Response, fallback = "Something went wrong. Please try again."): Promise<string> {
  try {
    const json = (await response.json()) as { message?: string };
    return json.message || fallback;
  } catch {
    return fallback;
  }
}
