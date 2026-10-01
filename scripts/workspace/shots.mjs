/**
 * Screenshots of every workspace page at desktop and phone sizes in both themes, against a
 * running test server (default http://localhost:3100, AI_MOCK=1). Registers a throwaway
 * account, makes some content, then photographs each page. Run with `node scripts/workspace/shots.mjs`.
 * SHOT_SET=desktop|mobile limits the run; SHOT_OUT sets the folder.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3100";
const OUT = process.env.SHOT_OUT ?? "playwright-report/workspace-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const PASSWORD = "Sup3r-secure-pass";

async function shoot(ctxOptions, tag, theme) {
  const context = await browser.newContext(ctxOptions);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("gixxer-theme", t);
    } catch {}
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (!t.startsWith("Failed to load resource")) errors.push(`${m.type()}: ${t.slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.setDefaultTimeout(60_000);
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });

  // Account and content.
  const email = `shots-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@gixxer.test`;
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full name").fill("Amol Dev");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app$/);
  await page.waitForTimeout(900);
  await shot("home");

  await page.getByRole("textbox", { name: "Message" }).fill("Give me short notes on Next.js");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForSelector("[data-message-status='complete']");
  await page.getByRole("textbox", { name: "Message" }).fill("Now a haiku about it");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForSelector("[data-message-role='assistant'] >> nth=1");
  await page.waitForFunction(() => document.querySelectorAll("[data-message-status='complete']").length >= 2);
  await page.waitForTimeout(600);
  await shot("chat");

  await page.goto(`${BASE}/app/images`);
  await page.waitForTimeout(500);
  await page.getByRole("textbox", { name: "Image prompt" }).fill("A red circle on white");
  await page.getByRole("button", { name: "Generate" }).click();
  await page.waitForTimeout(450);
  await shot("images-generating");
  await page.getByRole("img", { name: "A red circle on white" }).waitFor();
  await page.waitForTimeout(400);
  await shot("images");
  await page.getByRole("tab", { name: "Styles" }).click();
  await page.waitForTimeout(700);
  await shot("images-styles");

  await page.goto(`${BASE}/app/library`);
  await page.locator("input[type=file]").setInputFiles({ name: "handbook.txt", mimeType: "text/plain", buffer: Buffer.from("Employees get 25 days of paid leave each year.") });
  await page.locator("[data-file-status='indexed']").waitFor();
  await page.waitForTimeout(400);
  await shot("library");

  await page.goto(`${BASE}/app/scheduled`);
  await page.waitForTimeout(500);
  await shot("scheduled");

  await page.goto(`${BASE}/app/plugins`);
  await page.waitForTimeout(500);
  await shot("plugins");

  await page.goto(`${BASE}/app/projects`);
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Project name").fill("CRM making");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/app\/projects\/[a-f0-9]{24}$/);
  await page.waitForTimeout(400);
  await shot("project");
  await page.goto(`${BASE}/app/projects`);
  await page.waitForTimeout(500);
  await shot("projects");

  // Account menu and settings.
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("aside [aria-haspopup='menu']").filter({ visible: true }).last().click();
  await page.waitForTimeout(300);
  await shot("account-menu");
  await page.getByRole("menuitem", { name: "Personalization" }).click();
  await page.waitForTimeout(400);
  await shot("settings");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${tag}: overflow=${overflow}px errors=${JSON.stringify(errors)}`);
  await context.close();
}

const which = process.env.SHOT_SET ?? "all";
if (which === "all" || which === "desktop") {
  await shoot({ viewport: { width: 1440, height: 900 } }, "dark-desktop", "dark");
  await shoot({ viewport: { width: 1440, height: 900 } }, "light-desktop", "light");
}
if (which === "all" || which === "mobile") {
  await shoot({ ...devices["Pixel 7"] }, "dark-mobile", "dark");
  await shoot({ ...devices["Pixel 7"] }, "light-mobile", "light");
}
await browser.close();
console.log("done");
