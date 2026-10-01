import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 * The Content-Security-Policy is generated per request (with a nonce) in `proxy.ts`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    // The workspace composer records voice input, so the page itself may use the microphone; nothing framed can.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  {
    // Ignored by browsers over plain HTTP, honoured as soon as the app is served over HTTPS.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Mongoose relies on Node.js internals and must not be bundled.
  serverExternalPackages: ["mongoose", "unpdf", "mammoth", "xlsx"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Everything except the chatbot embed page refuses to be framed. The
      // embed page relies on the CSP frame-ancestors directive from proxy.ts.
      { source: "/((?!embed).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
