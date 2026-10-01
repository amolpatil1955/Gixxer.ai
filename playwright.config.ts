import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against their own server on port 3100 and their own
 * MongoDB database, so they never touch the developer's data on port 3000.
 *
 * The default is a production build, which is what the security assertions
 * (CSP without `unsafe-eval`, headers, no dev overlay) need to mean anything.
 * Set E2E_DEV=1 for a faster dev-server run while iterating; note that Next.js
 * allows only one dev server per project directory, so stop `npm run dev` first.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const E2E_MONGODB_URI = process.env.MONGODB_URI_E2E ?? "mongodb://127.0.0.1:27017/gixxer_e2e";
const useDevServer = process.env.E2E_DEV === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  // Auth requests are deliberately slow (scrypt), and parallel workers queue on them.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: useDevServer ? `npx next dev -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    env: {
      NODE_ENV: useDevServer ? "development" : "production",
      MONGODB_URI: E2E_MONGODB_URI,
      APP_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      // Every browser in the run shares one IP; the per-email limit stays untouched.
      AUTH_RATE_LIMIT_IP_SCALE: "50",
      // scrypt runs on libuv's thread pool, which defaults to 4. Concurrent
      // sign-ins queue behind it. Production needs this sizing too, see
      // docs/architecture/auth.md.
      UV_THREADPOOL_SIZE: "16",
      // Every AI provider is replaced by a deterministic local stand-in.
      AI_MOCK: "1",
    },
  },
});
