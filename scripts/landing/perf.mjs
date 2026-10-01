/**
 * Core Web Vitals, scroll smoothness and script weight for the landing page, against a running
 * server (default http://localhost:3100). Run with `node scripts/landing/perf.mjs`.
 */
import { chromium, devices } from "@playwright/test";

const BASE = process.env.PERF_BASE ?? "http://localhost:3100";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function measure(ctxOptions, tag, theme, force = false) {
  const context = await browser.newContext(ctxOptions);
  await context.addInitScript(
    ([t, f]) => {
      try {
        localStorage.setItem("gixxer-theme", t);
        if (f) localStorage.setItem("gixxer-force-webgl", "1");
      } catch {}
      const w = window;
      w.__lcp = 0;
      w.__cls = 0;
      new PerformanceObserver((l) => {
        const last = l.getEntries().at(-1);
        if (last) w.__lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    },
    [theme, force],
  );
  const page = await context.newPage();

  const scripts = [];
  let loadedAt = 0;
  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (!url.startsWith(BASE) || !url.includes(".js")) return;
    const sizes = await request.sizes().catch(() => null);
    if (sizes) scripts.push({ bytes: sizes.responseBodySize, lazy: loadedAt > 0, url });
  });

  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(120);
  loadedAt = Date.now();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  const vitals = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      ttfb: Math.round(nav?.responseStart ?? 0),
      fcp: Math.round(fcp?.startTime ?? 0),
      lcp: Math.round(window.__lcp ?? 0),
      cls: Math.round((window.__cls ?? 0) * 1000) / 1000,
    };
  });

  // Longest main-thread block while scrolling the whole page, plus frame timing.
  const scroll = await page.evaluate(async () => {
    const tasks = [];
    const observer = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) tasks.push(Math.round(e.duration));
    });
    observer.observe({ type: "longtask", buffered: false });
    let frames = 0;
    let slow = 0;
    let last = performance.now();
    let running = true;
    const tick = (now) => {
      frames += 1;
      if (now - last > 34) slow += 1;
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const started = performance.now();
    const step = Math.max(240, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    await new Promise((r) => setTimeout(r, 400));
    running = false;
    observer.disconnect();
    const elapsed = performance.now() - started;
    return {
      worstTask: Math.round(Math.max(0, ...tasks)),
      longTasks: tasks.sort((a, b) => b - a).slice(0, 6),
      fps: Math.round((frames / elapsed) * 1000),
      slowFrames: slow,
      frames,
    };
  });

  const mode = await page.locator("[data-hero-visual]").getAttribute("data-hero-visual");
  const reason = await page.locator("[data-hero-visual]").getAttribute("data-hero-reason");
  const kb = (n) => Math.round(n / 1024);
  const initial = scripts.filter((s) => !s.lazy).reduce((a, s) => a + s.bytes, 0);
  const lazy = scripts.filter((s) => s.lazy).reduce((a, s) => a + s.bytes, 0);
  const cls = await page.evaluate(() => Math.round((window.__cls ?? 0) * 1000) / 1000);

  console.log(
    `${tag} ttfb=${vitals.ttfb}ms fcp=${vitals.fcp}ms lcp=${vitals.lcp}ms cls(load)=${vitals.cls} cls(total)=${cls} worstScrollTask=${scroll.worstTask}ms longTasks=[${scroll.longTasks}] fps=${scroll.fps} slowFrames=${scroll.slowFrames}/${scroll.frames} hero=${mode}/${reason} js_initial=${kb(initial)}KB js_deferred=${kb(lazy)}KB`,
  );
  if (process.env.PERF_VERBOSE) {
    for (const s of scripts.sort((a, b) => b.bytes - a.bytes).slice(0, 12)) console.log(`   ${kb(s.bytes)}KB ${s.lazy ? "(deferred)" : ""} ${s.url.split("/").pop()}`);
  }
  await context.close();
}

await measure({ viewport: { width: 1440, height: 900 } }, "dark  desktop      :", "dark");
await measure({ viewport: { width: 1440, height: 900 } }, "dark  desktop+webgl:", "dark", true);
await measure({ viewport: { width: 1440, height: 900 } }, "light desktop      :", "light");
await measure({ ...devices["Pixel 7"] }, "dark  mobile       :", "dark");
await measure({ ...devices["Pixel 7"] }, "dark  mobile+webgl :", "dark", true);
await browser.close();
