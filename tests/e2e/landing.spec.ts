import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PASSWORD = "Sup3r-secure-pass";

/** Every anchored section on the page, in order. */
const SECTION_IDS = ["workspace", "capabilities", "deploy", "knowledge", "faq", "start"];

async function registerViaUi(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** The primary navigation: inline on desktop, behind the menu button on phones. */
async function openPrimaryNav(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole("navigation", { name: "Primary" });
  await page.getByRole("button", { name: "Open menu" }).click();
  return page.locator("#mobile-menu");
}

/** Scrolls through the whole document so every in-view animation gets a chance to run. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(240, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

/**
 * Waits for the hero to decide between the WebGL scene and the static image,
 * and for that visual to have rendered its first frame. Shader compilation is
 * a one-off startup cost; waiting for it keeps it out of scroll measurements.
 */
async function heroMode(page: Page): Promise<string> {
  const visual = page.locator("[data-hero-visual]");
  await expect(visual).toHaveAttribute("data-hero-visual", /^(scene|static)$/, { timeout: 15_000 });
  await expect(visual).toHaveAttribute("data-hero-ready", "true", { timeout: 25_000 });
  // The server snapshot is "static" with reason "server"; wait for the browser's own decision.
  await expect(visual).not.toHaveAttribute("data-hero-reason", "server", { timeout: 25_000 });
  return (await visual.getAttribute("data-hero-visual")) ?? "";
}

function themeOf(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

test.describe("landing page", () => {
  test("shows every section with the signed-out calls to action", async ({ page, isMobile }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every model.");
    await expect(page.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/register");
    await expect(page.getByRole("link", { name: "See it in action" })).toHaveAttribute("href", "#workspace");

    for (const id of SECTION_IDS) {
      await expect(page.locator(`section#${id}`), `section #${id}`).toHaveCount(1);
    }
    for (const name of [
      "One conversation, every capability.",
      "One assistant. Every capability.",
      "From a name to live on your site, in four steps.",
      "It remembers what you gave it.",
      "Questions worth asking.",
      "Ready when you are.",
    ]) {
      await expect(page.getByRole("heading", { name, exact: true }), name).toBeAttached();
    }

    // No fabricated pages: every internal link resolves to a route that exists.
    const hrefs = await page.locator("a[href^='/']").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    for (const href of new Set(hrefs)) {
      expect(["/", "/login", "/register", "/app"], `link ${href}`).toContain(href);
    }

    const nav = await openPrimaryNav(page, isMobile);
    await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(nav.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
  });

  test("anchors navigate to their sections and content survives a full scroll", async ({ page }) => {
    await page.goto("/");
    await scrollThrough(page);

    for (const id of SECTION_IDS) {
      const height = await page.locator(`section#${id}`).evaluate((element) => element.getBoundingClientRect().height);
      expect(height, `section #${id} has height`).toBeGreaterThan(200);
    }

    await page.locator("section#workspace").scrollIntoViewIfNeeded();
    await expect(page.getByText("cash runway shortened to 14 months", { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test("never overflows horizontally", async ({ page }) => {
    await page.goto("/");
    await heroMode(page);
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("respects reduced motion: no WebGL scene, everything readable at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await heroMode(page)).toBe("static");
    await expect(page.locator("[data-hero-visual]")).toHaveAttribute("data-hero-reason", "reduced-motion");
    await expect(page.locator("canvas")).toHaveCount(0);

    // Typewriter and staged demos skip straight to their final state.
    await page.locator("section#workspace").scrollIntoViewIfNeeded();
    await expect(page.getByText("cash runway shortened to 14 months", { exact: false })).toBeVisible();
    await page.locator("section#capabilities").scrollIntoViewIfNeeded();
    await expect(page.getByText("and it ships Tuesday", { exact: false })).toBeVisible();
  });

  test("mounts the 3D hero when the device allows it", async ({ page }) => {
    await page.goto("/");
    const mode = await heroMode(page);
    const reason = await page.locator("[data-hero-visual]").getAttribute("data-hero-reason");
    // Headless browsers render through SwiftShader, which we deliberately refuse.
    if (mode === "scene") {
      await expect(page.locator("canvas")).toHaveCount(1, { timeout: 15_000 });
      expect(reason).toBe("ok");
    } else {
      expect(reason, "a static hero must say why").toMatch(/^(software-gl|no-webgl|weak-device|reduced-motion|reduced-data)$/);
    }
  });

  test("keeps the main thread responsive while scrolling", async ({ page }) => {
    await page.goto("/");
    // Let the hero finish starting up: its one-off cost is not a scrolling cost.
    await heroMode(page);
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      const longTasks: number[] = [];
      (window as unknown as { __longTasks: number[] }).__longTasks = longTasks;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: false });
    });
    await scrollThrough(page);
    const longTasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
    const worst = Math.max(0, ...longTasks);
    expect(worst, `longest main-thread task while scrolling: ${worst}ms`).toBeLessThan(500);
  });

  test("shows workspace links to signed-in visitors", async ({ page, isMobile }) => {
    await registerViaUi(page, "Landing Visitor", `landing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@gixxer.test`);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("main").getByRole("link", { name: "Open workspace" }).first()).toHaveAttribute("href", "/app");
    await expect(page.getByRole("link", { name: "Start free" })).toHaveCount(0);

    const nav = await openPrimaryNav(page, isMobile);
    await expect(nav.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/app");
  });

  test("mobile menu opens, navigates and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "desktop shows the inline navigation");
    await page.goto("/");
    const menu = await openPrimaryNav(page, true);
    await expect(menu.getByRole("link", { name: "Get started" })).toBeVisible();
    await menu.getByRole("link", { name: "Chatbot", exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/#deploy$/);
  });

  test("has a skip link and one landmark of each kind", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
  });
});

test.describe("theme", () => {
  test("defaults to the system preference", async ({ browser }) => {
    const light = await browser.newContext({ colorScheme: "light" });
    const lightPage = await light.newPage();
    await lightPage.goto("/");
    expect(await themeOf(lightPage)).toBe("light");
    await light.close();

    const dark = await browser.newContext({ colorScheme: "dark" });
    const darkPage = await dark.newPage();
    await darkPage.goto("/");
    expect(await themeOf(darkPage)).toBe("dark");
    await dark.close();
  });

  test("switches, persists across reloads and applies to the auth pages", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("radiogroup", { name: "Colour theme" }).first();

    await toggle.getByRole("radio", { name: "Light theme" }).click();
    expect(await themeOf(page)).toBe("light");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.reload();
    expect(await themeOf(page)).toBe("light");

    // The choice is global, not per page.
    await page.goto("/login");
    expect(await themeOf(page)).toBe("light");

    await page.goto("/");
    await toggle.getByRole("radio", { name: "Dark theme" }).click();
    expect(await themeOf(page)).toBe("dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(3, 0, 0)");
    await page.reload();
    expect(await themeOf(page)).toBe("dark");
  });

  test("applies before first paint, with no flash of the wrong theme", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        localStorage.setItem("gixxer-theme", "light");
      } catch {}
      // Record the theme at the first opportunity after the document element exists.
      document.addEventListener("readystatechange", () => {
        const w = window as unknown as { __firstTheme?: string };
        w.__firstTheme ??= document.documentElement.dataset.theme;
      });
    });
    await page.goto("/");
    const firstTheme = await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme);
    expect(firstTheme, "theme applied before the document finished parsing").toBe("light");
    await context.close();
  });
});

test.describe("interactive sections", () => {
  test("the workspace demo switches panels by click and by keyboard", async ({ page }) => {
    await page.goto("/");
    await page.locator("section#workspace").scrollIntoViewIfNeeded();

    const tabs = page.getByRole("tablist", { name: "Workspace areas" });
    const panel = page.locator("#ws-panel");

    await tabs.getByRole("tab", { name: "Images" }).click();
    await expect(tabs.getByRole("tab", { name: "Images" })).toHaveAttribute("aria-selected", "true");
    await expect(panel).toContainText("friendly robot assistant");

    await tabs.getByRole("tab", { name: "Library" }).click();
    await expect(panel).toContainText("What drove the churn increase?");
    await expect(panel).toContainText("Board-deck.pdf");

    await tabs.getByRole("tab", { name: "Chatbot Pro" }).click();
    await expect(panel).toContainText("Northwind Cycles");

    // Arrow keys move between tabs, as the tablist pattern expects.
    await tabs.getByRole("tab", { name: "Chatbot Pro" }).press("ArrowDown");
    await expect(tabs.getByRole("tab", { name: "New Chat" })).toHaveAttribute("aria-selected", "true");
    await expect(panel).toContainText("Summarize the attached Q3 report");
  });

  test("the chatbot setup walks from naming it to installing it", async ({ page }) => {
    await page.goto("/");
    // Typing before React has attached would be lost; the hero's own decision marks hydration.
    await expect(page.locator("[data-hero-visual]")).not.toHaveAttribute("data-hero-reason", "server", { timeout: 25_000 });
    const section = page.locator("section#deploy");
    await section.scrollIntoViewIfNeeded();

    // Step 1: name and purpose drive the welcome line.
    await section.getByLabel("Bot name").fill("Scout");
    await section.getByRole("button", { name: "Bookings" }).click();
    await expect(section.getByText("Hi! I'm Scout from Northwind Cycles. I can book a fitting or a service for you.").first()).toBeVisible();

    // Step 2: sources index once and report their passages.
    await section.getByRole("tab", { name: /Train it on your data/ }).click();
    await expect(section.getByText("Indexed · 64 passages")).toBeVisible({ timeout: 10_000 });
    await expect(section.getByText("3 sources · 91 passages · ready to answer")).toBeVisible();

    // Step 3: a test question is answered with its source, then the bot goes live.
    await section.getByRole("tab", { name: /Test it, then go live/ }).click();
    await section.getByRole("button", { name: "Do you price match?" }).click();
    await expect(section.getByText("We match any local retailer", { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(section.getByText("Pricing FAQ")).toBeVisible();
    const live = section.getByRole("switch", { name: "Live" });
    await live.click();
    await expect(live).toHaveAttribute("aria-checked", "true");

    // Step 4: the snippet, per-platform placement, and the widget on the site under the chosen name.
    await section.getByRole("button", { name: /Next: Install/ }).click();
    await expect(section.locator("pre")).toContainText('data-bot="gx_');
    await section.getByRole("tab", { name: "Shopify" }).click();
    await expect(section.getByText("layout/theme.liquid", { exact: false })).toBeVisible();
    await section.getByRole("tab", { name: "Next.js" }).click();
    await expect(section.locator("pre")).toContainText("next/script");
    const site = section.getByRole("region", { name: "Website preview" });
    await expect(site.getByText("Scout", { exact: true })).toBeVisible();
    await expect(section.getByRole("link", { name: "Build your bot" })).toHaveAttribute("href", "/register");
  });

  test("the FAQ opens and closes one answer at a time", async ({ page }) => {
    await page.goto("/");
    await page.locator("section#faq").scrollIntoViewIfNeeded();

    const first = page.getByRole("button", { name: "Which models does Gixxer use?" });
    const second = page.getByRole("button", { name: "What happens when a provider fails?" });

    await expect(first).toHaveAttribute("aria-expanded", "true");
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("trigger a controlled retry", { exact: false })).toBeVisible();

    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "false");
  });

  test("the capabilities switch the stage demo and name every integration honestly", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section#capabilities");
    await section.scrollIntoViewIfNeeded();
    const tabs = section.getByRole("tablist", { name: "Capabilities" });
    await expect(tabs.getByRole("tab")).toHaveCount(4);
    await expect(section.getByText("and it ships Tuesday", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(section.getByRole("img", { name: /robot assistant/ })).toBeVisible();

    await tabs.getByRole("tab", { name: /Answers that cite the cell/ }).click();
    await expect(section.locator("#cap-stage")).toContainText("Retention!B3:C3");
    await tabs.getByRole("tab", { name: /Answers that cite the cell/ }).press("ArrowUp");
    await expect(tabs.getByRole("tab", { name: /From prompt to picture/ })).toHaveAttribute("aria-selected", "true");
    await expect(section.locator("#cap-stage")).toContainText("FLUX.1-schnell");

    for (const provider of ["Groq", "Hugging Face"]) {
      await expect(section.getByText(provider, { exact: true }).first()).toBeAttached();
    }
    // The widget embeds on these today; the connectors are labelled as coming with Plugins.
    const connectors = section.getByRole("list", { name: "Connectors, coming with plugins" }).first();
    for (const name of ["Slack", "Google Calendar", "Cloudflare", "n8n"]) {
      await expect(connectors.getByText(name, { exact: true }).first()).toBeAttached();
    }
    const embeds = section.getByRole("list", { name: "Your bot embeds on" }).first();
    for (const name of ["WordPress", "Shopify", "Webflow"]) {
      await expect(embeds.getByText(name, { exact: true }).first()).toBeAttached();
    }
  });
});
