import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` is a Next.js build-time guard; it has no runtime meaning under Vitest.
      "server-only": fileURLToPath(new URL("./tests/setup/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
