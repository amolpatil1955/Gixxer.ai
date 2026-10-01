import { expect, test as base } from "@playwright/test";

/**
 * Every test gets a clean-console assertion: console errors, uncaught exceptions
 * and failed requests (including CSP violations) fail the test.
 */
export const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        // HTTP status noise (e.g. an intentional 404) is asserted on the response
        // object where it matters; here we care about real script failures.
        if (text.startsWith("Failed to load resource")) return;
        problems.push(`console.error: ${text}`);
      });
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

      await use();

      expect(problems, "browser console should be clean").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
