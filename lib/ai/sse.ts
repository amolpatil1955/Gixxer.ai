/**
 * Parses a Server-Sent Events body into its `data:` payloads. Shared by the
 * Groq client, which streams this way. Yields raw data
 * strings; callers decode JSON and pick the text out.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", abort, { once: true });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) yield data;
        boundary = buffer.indexOf("\n\n");
      }
    }
    // A final event without a trailing blank line.
    const tail = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (tail) yield tail;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
