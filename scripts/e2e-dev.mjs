/**
 * Runs the Playwright suite against the dev server instead of a production build.
 * A small wrapper rather than a shell prefix, so it works the same on Windows,
 * macOS and Linux without adding a dependency.
 *
 * Note: Next.js allows only one dev server per project directory. Stop
 * `npm run dev` before using this.
 */
import { spawn } from "node:child_process";

const child = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, E2E_DEV: "1" },
});

child.on("exit", (code) => process.exit(code ?? 1));
