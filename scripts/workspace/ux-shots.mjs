/** Screenshots of the chat UX states: clean new chat, voice window, code card, image loader. Needs the test server (AI_MOCK=1). */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
const BASE = process.env.SHOT_BASE ?? "http://localhost:3100";
const OUT = process.env.SHOT_OUT ?? "playwright-report/ux-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
async function run(ctxOptions, tag) {
  const context = await browser.newContext(ctxOptions);
  await context.addInitScript(() => localStorage.setItem("gixxer-theme", "dark"));
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !m.text().startsWith("Failed to load resource") && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.setDefaultTimeout(60_000);
  const shot = (n) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full name").fill("Amol Dev");
  await page.getByLabel("Email").fill(`ux-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@gixxer.test`);
  await page.getByLabel("Password", { exact: true }).fill("Sup3r-secure-pass");
  await page.getByLabel("Confirm password").fill("Sup3r-secure-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app$/);
  await page.waitForTimeout(800);
  await shot("new-chat");

  // Voice window states.
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  await page.getByRole("button", { name: "Dictate" }).click();
  await page.waitForSelector("[data-voice-state='requesting']");
  await shot("voice-requesting");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  await page.getByRole("button", { name: "Dictate" }).click();
  await page.waitForSelector("[data-voice-state='denied']");
  await shot("voice-denied");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      await context.resume();
      return destination.stream;
    };
  });
  await page.getByRole("button", { name: "Dictate" }).click();
  await page.waitForSelector("[data-voice-state='listening']");
  await page.waitForTimeout(600);
  await shot("voice-listening");
  await page.getByRole("button", { name: "Stop" }).click();
  await page.waitForFunction(() => (document.querySelector("textarea[aria-label='Message']")?.value ?? "").length > 0);
  await shot("voice-inserted");

  // A code reply, rendered in the code card. The mock echoes, so send fenced code to see the card.
  await page.getByRole("textbox", { name: "Message" }).fill("```ts\nexport function gearRatio(chainring: number, cog: number): number {\n  // teeth on the front divided by teeth on the back\n  return chainring / cog;\n}\n```");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForSelector("[data-message-status='complete']");
  await page.waitForSelector("[data-code-card]");
  await page.waitForTimeout(1200);
  await shot("code-card");

  // Image: loader, then the picture.
  await page.getByRole("textbox", { name: "Message" }).fill("create a robot image");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForSelector("[data-generating='image']");
  await page.waitForTimeout(1200);
  await shot("image-loading");
  await page.waitForFunction(() => document.querySelector("[data-generating='image']") === null, null, { timeout: 40_000 });
  await page.waitForTimeout(500);
  await shot("image-done");
  console.log(`${tag}: errors=${JSON.stringify(errors)}`);
  await context.close();
}
await run({ viewport: { width: 1440, height: 900 } }, "desktop");
await run({ ...devices["Pixel 7"] }, "mobile");
await browser.close();
console.log("done");
