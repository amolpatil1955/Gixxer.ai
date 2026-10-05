export interface CspOptions {
  nonce: string;
  isDevelopment: boolean;
  /** The embed page is designed to be framed by other sites; nothing else is. */
  embeddable?: boolean;
}

/**
 * Per-request Content Security Policy. Scripts require the request nonce
 * (Next.js applies it to its own scripts); inline styles stay allowed because
 * React and Motion set style attributes at runtime.
 */
export function buildContentSecurityPolicy({ nonce, isDevelopment, embeddable = false }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // 'wasm-unsafe-eval' lets the PDF viewer compile its WebAssembly image decoders. It permits
    // WebAssembly only, never eval() of a string, so no script can be built from text at runtime.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Unsplash reference photos load straight from its CDN; the API itself is only ever called server-side.
    "img-src 'self' blob: data: https://lh3.googleusercontent.com https://images.unsplash.com https://plus.unsplash.com",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    embeddable ? "frame-ancestors *" : "frame-ancestors 'none'",
  ];
  if (!isDevelopment) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** 128 bits of randomness, base64 encoded. Works in Node and edge runtimes. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
