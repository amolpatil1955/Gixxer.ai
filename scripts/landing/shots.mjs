/**
 * Screenshots of every landing section at desktop, tablet and phone sizes in both themes,
 * against a running server (default http://localhost:3100). Run with `node scripts/landing/shots.mjs`.
 * SHOT_SET=desktop|mobile|tablet limits the run; SHOT_OUT sets the folder.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3100";
const OUT = process.env.SHOT_OUT ?? "playwright-report/landing-shots";
const ONLY = process.env.SHOT_ONLY?.split(",") ?? null;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const SECTIONS = ["workspace", "capabilities", "deploy", "knowledge", "faq", "start"];

async function shoot(ctxOptions, tag, theme) {
  const context = await browser.newContext(ctxOptions);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("gixxer-theme", t);
      // Headless Chromium renders through SwiftShader, which the app refuses by
      // default. Force the WebGL hero on so screenshots show the real scene.
      localStorage.setItem("gixxer-force-webgl", "1");
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

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Software WebGL compiles the hero shader slowly; give the scene time to fade in.
  await page.waitForTimeout(Number(process.env.SHOT_HERO_WAIT ?? 4500));
  page.setDefaultTimeout(90_000);
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.screenshot({ path: `${OUT}/${tag}-hero.png` });

  await page.evaluate(async () => {
    const step = Math.floor(window.innerHeight * 0.5);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.waitForTimeout(800);

  for (const id of SECTIONS) {
    if (ONLY && !ONLY.includes(id)) continue;
    const section = page.locator(`section#${id}`);
    await section.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy(0, -72));
    await page.waitForTimeout(1900);
    await page.screenshot({ path: `${OUT}/${tag}-${id}.png` });
    // Tall sections get a second frame further down, so the mockups themselves are reviewed.
    const height = await section.evaluate((el) => el.getBoundingClientRect().height);
    const viewport = page.viewportSize()?.height ?? 900;
    if (height > viewport * 1.15) {
      await page.evaluate((dy) => window.scrollBy(0, dy), Math.round(viewport * 0.8));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${tag}-${id}-b.png` });
    }
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${tag}-footer.png` });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${tag}: theme=${applied} overflow=${overflow}px height=${height}px errors=${JSON.stringify(errors)}`);
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
if (which === "all" || which === "tablet") {
  await shoot({ viewport: { width: 1024, height: 800 } }, "dark-tablet", "dark");
  await shoot({ ...devices["iPad Mini"] }, "light-tablet", "light");
}
await browser.close();
console.log("done");
