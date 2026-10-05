import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * The workspace features around the chat: Think mode, pinning, projects,
 * plugins, personalization, schedules, voice transcription and the export.
 * Against mock AI providers (AI_MOCK=1 on the test server).
 */

const PASSWORD = "Sup3r-secure-pass";

function uniqueEmail(tag: string): string {
  return `wf-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`;
}

async function register(page: Page, name: string): Promise<string> {
  const email = uniqueEmail(name.toLowerCase().replace(/\s+/g, "-"));
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return email;
}

async function sendMessage(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

/** The sidebar is a drawer on phones. Opens it when needed and returns the visible one. */
async function sidebar(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  return page.locator("aside").filter({ visible: true }).first();
}

async function openSettings(page: Page, item: string) {
  const aside = await sidebar(page);
  await aside.locator("[aria-haspopup='menu']").last().click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
}

const assistantMessages = (page: Page) => page.locator("[data-message-role='assistant']");

test.describe("chat features", () => {
  test("Booster answers without ever showing the model's reasoning", async ({ page }) => {
    await register(page, "Think Tester");
    await page.getByRole("button", { name: "Booster off" }).click();
    await expect(page.getByRole("button", { name: "Booster on" })).toBeVisible();
    await sendMessage(page, "How many legs do three spiders have?");
    const reply = assistantMessages(page).first();
    await expect(reply).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await expect(reply).toContainText("Mock reply to: How many legs");
    // The first turn of a new chat ends with a refresh that mounts the conversation page; wait for it.
    await expect(page.locator("[data-chat-header]")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Thought process" })).toHaveCount(0);
    await expect(page.getByText(/Thinking about:/)).toHaveCount(0);
    await page.reload();
    await expect(assistantMessages(page).first()).toContainText("Mock reply to: How many legs");
    await expect(page.getByText(/Thinking about:/)).toHaveCount(0);
  });

  test("feedback, pinning and the conversation menu", async ({ page }) => {
    await register(page, "Pin Tester");
    await sendMessage(page, "Remember this one");
    const reply = assistantMessages(page).first();
    await expect(reply).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await reply.getByRole("button", { name: "Good response" }).click();
    await expect(reply.getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "true");

    // Pin from the header menu; the sidebar shows it under Pinned.
    await page.getByRole("button", { name: "Conversation options" }).click();
    await page.getByRole("menuitem", { name: "Pin" }).click();
    const aside = await sidebar(page);
    await expect(aside.getByText("Pinned", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(aside.locator('a[href^="/app/chat/"]', { hasText: "Remember this one" })).toBeVisible();

    await page.reload();
    await expect(assistantMessages(page).first().getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the voice window asks, listens, writes the words into the message box, and explains a blocked microphone", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "fake audio input is a Chromium feature");
    await register(page, "Voice Tester");

    // A microphone that refuses: the window says so and offers a retry.
    await page.evaluate(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as unknown as { __realGetUserMedia: typeof original }).__realGetUserMedia = original;
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    });
    await page.getByRole("button", { name: "Dictate" }).click();
    const dialog = page.getByRole("dialog", { name: "Microphone blocked" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Allow the microphone for this site");
    await expect(page.locator("[data-voice-state='denied']")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A microphone that works (a silent oscillator stands in): listen, stop, transcribe, insert.
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
    const listening = page.getByRole("dialog", { name: "Listening" });
    await expect(listening).toBeVisible({ timeout: 10_000 });
    await expect(listening.getByText(/00:0\d \/ 01:00/)).toBeVisible();
    await page.waitForTimeout(700);
    await listening.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Mock transcript of your recording.", { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The endpoint itself refuses empty recordings.
    const empty = await page.request.post("/api/transcribe", { multipart: { audio: { name: "voice.webm", mimeType: "audio/webm", buffer: Buffer.alloc(0) } } });
    expect(empty.status()).toBe(400);
  });
});

test.describe("personalization and plugins", () => {
  test("custom instructions and a nickname reach the model and the greeting", async ({ page }) => {
    await register(page, "Custom Tester");
    await openSettings(page, "Personalization");
    await page.getByLabel("Nickname").fill("Captain");
    await page.getByLabel("Custom instructions").fill("Always end with a haiku.");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Saved");
    await page.getByRole("button", { name: "Close settings" }).click();

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Hey, Captain. Ready to dive in?" })).toBeVisible();
    // The mock echoes the last user turn; the instructions travel as a system turn, which the export shows.
    await sendMessage(page, "Ping");
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    const exported = await page.request.get("/api/export");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-disposition"]).toContain("attachment");
    const body = await exported.json();
    expect(body.settings.customInstructions).toBe("Always end with a haiku.");
    expect(body.conversations[0].messages.map((message: { content: string }) => message.content)).toContain("Ping");
  });

  test("the library plugin answers from files that were never attached", async ({ page }) => {
    await register(page, "Plugin Tester");
    await page.goto("/app/library");
    await page.locator("input[type=file]").setInputFiles({ name: "wifi.txt", mimeType: "text/plain", buffer: Buffer.from("The office wifi password is pelican-42.") });
    await expect(page.locator("[data-file-status]").filter({ hasText: "wifi.txt" })).toHaveAttribute("data-file-status", "indexed", { timeout: 20_000 });

    await page.goto("/app/plugins");
    const toggle = page.getByRole("switch", { name: /Library knowledge/ });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(page.getByRole("switch", { name: /Library knowledge/ })).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
    await expect(page.getByRole("list", { name: "Installed plugins" }).getByText("Library knowledge")).toBeAttached();

    await page.goto("/app");
    await sendMessage(page, "What is the office wifi password?");
    await expect(assistantMessages(page).first()).toContainText("using 1 source", { timeout: 20_000 });
    await expect(assistantMessages(page).first().getByRole("link", { name: /wifi\.txt/ })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("projects", () => {
  test("a project collects chats and its instructions follow them", async ({ page }) => {
    await register(page, "Project Tester");
    await page.goto("/app/projects");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Project name").fill("Launch plan");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[a-f0-9]{24}$/);
    await page.getByLabel("Project instructions").fill("We sell bicycles.");
    await page.getByRole("button", { name: "Save instructions" }).click();
    await expect(page.getByRole("status")).toContainText("Saved", { timeout: 10_000 });

    await page.getByRole("main").getByRole("link", { name: "New chat" }).click();
    await expect(page).toHaveURL(/\/app\?project=/);
    await expect(page.getByText("New chat in")).toBeVisible();
    await sendMessage(page, "Draft a slogan");
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\/chat\/[a-f0-9]{24}$/);
    // The project chip in the chat header is hidden on phones, but present.
    await expect(page.locator("main a[href^='/app/projects/']", { hasText: "Launch plan" })).toBeAttached();

    await page.goto("/app/projects");
    const row = page.getByRole("list", { name: "Projects" }).getByRole("link", { name: /Launch plan/ });
    await expect(row).toContainText("1");
    await row.click();
    await expect(page.getByRole("list", { name: "Project chats" }).getByText("Draft a slogan")).toBeVisible();
  });
});

test.describe("scheduled prompts", () => {
  test("a schedule can be created, run now, paused and deleted", async ({ page }) => {
    await register(page, "Schedule Tester");
    await page.goto("/app/scheduled");
    await page.getByRole("button", { name: "Use template: Plan my morning" }).click();
    await expect(page.getByLabel("Schedule name")).toHaveValue("Plan my morning");
    await page.getByRole("button", { name: "Create schedule" }).click();
    await expect(page.getByRole("status")).toContainText("Scheduled", { timeout: 10_000 });
    const card = page.locator("[data-schedule-active]").filter({ hasText: "Plan my morning" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("every weekday at 08:00");

    await card.getByRole("button", { name: "Run now" }).click();
    await expect(page.getByRole("status")).toContainText("ran", { timeout: 30_000 });
    await expect(card).toContainText("1 run");
    await card.getByRole("link", { name: /Open last answer/ }).click();
    await expect(page).toHaveURL(/\/app\/chat\/[a-f0-9]{24}$/);
    await expect(assistantMessages(page).first()).toContainText("Mock reply to: Ask me three short questions");

    await page.goto("/app/scheduled");
    await page.locator("[data-schedule-active]").getByRole("button", { name: /Pause/ }).click();
    // The Active filter hides a paused schedule; the Paused filter shows it.
    await expect(page.locator("[data-schedule-active]")).toHaveCount(0, { timeout: 10_000 });
    await page.getByRole("tab", { name: "Paused" }).click();
    await expect(page.locator("[data-schedule-active='false']")).toHaveCount(1);
    await page.locator("[data-schedule-active]").getByRole("button", { name: /Delete/ }).click();
    // The app's own confirmation window, not the browser's.
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Nothing scheduled yet")).toBeVisible({ timeout: 10_000 });

    // The cron endpoint is closed without a secret.
    expect((await page.request.post("/api/cron")).status()).toBe(404);
  });
});

test.describe("settings window", () => {
  test("opens from the account menu, switches sections and closes with Escape", async ({ page }) => {
    await register(page, "Settings Tester");
    await openSettings(page, "Settings");
    await expect(page.getByRole("dialog").getByRole("heading", { name: "General" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Profile" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Email and password")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Data controls" }).click();
    await expect(page.getByRole("link", { name: "Download export" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("generation inside the chat", () => {
  test("an image request makes a picture in the chat and opens it in the viewer", async ({ page }) => {
    await register(page, "Image Chat Tester");
    await sendMessage(page, "Generate an image of a red fox in snow");
    const reply = assistantMessages(page).first();
    // The loader is shown for the real wait, and never less than a moment, before the picture appears.
    const loader = reply.locator("[data-generating='image']");
    await expect(loader).toBeVisible({ timeout: 15_000 });
    await expect(reply.getByRole("button", { name: /Open image/ })).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(loader).toBeVisible();
    await expect(reply).toHaveAttribute("data-message-status", "complete", { timeout: 30_000 });
    await expect(reply).toContainText('Here is the image for "a red fox in snow"', { timeout: 15_000 });
    await expect(loader).toHaveCount(0, { timeout: 15_000 });
    // The first turn of a new chat ends with a refresh that mounts the conversation page; wait for it.
    await expect(page.locator("[data-chat-header]")).toBeVisible({ timeout: 15_000 });
    const open = reply.getByRole("button", { name: /Open image: a red fox in snow/ });
    await expect(open).toBeVisible();
    await open.click();
    const viewer = page.getByRole("dialog", { name: "Image viewer" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/api\/images\/[a-f0-9]{24}\?download=1/);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);

    // Ordinary text never makes a picture.
    await sendMessage(page, "What is a PNG file?");
    await expect(assistantMessages(page).nth(1)).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await expect(assistantMessages(page).nth(1).getByRole("button", { name: /Open image/ })).toHaveCount(0);
  });

  test("a document request produces a downloadable file with a preview panel", async ({ page }) => {
    await register(page, "Doc Chat Tester");
    await sendMessage(page, "Create a PDF about solar panels for homeowners");
    const reply = assistantMessages(page).first();
    await expect(reply).toHaveAttribute("data-message-status", "complete", { timeout: 30_000 });
    await expect(page.locator("[data-chat-header]")).toBeVisible({ timeout: 15_000 });
    // One line, the download link, the card: the document's body lives in the file.
    await expect(reply).toContainText("Your PDF is ready.");
    await expect(reply).not.toContainText("Mock reply to");
    await expect(reply.getByRole("link", { name: "Download Solar Panels For Homeowners PDF" })).toBeVisible();
    const card = reply.getByRole("button", { name: /Open file: solar-panels-for-homeowners\.pdf/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Open file");
    const href = (await reply.getByRole("link", { name: /Download solar-panels-for-homeowners\.pdf/ }).getAttribute("href")) ?? "";
    const download = await page.request.get(href);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("application/pdf");
    expect(download.headers()["content-disposition"]).toContain("attachment");

    await card.click();
    const panel = page.getByRole("dialog", { name: /Preview of solar-panels-for-homeowners\.pdf/ });
    await expect(panel).toBeVisible();
    // The PDF is drawn as it really looks, page by page.
    const pageCanvas = panel.getByRole("img", { name: "Page 1 of 1" });
    await expect(pageCanvas).toBeVisible({ timeout: 15_000 });
    await expect(pageCanvas).toHaveAttribute("data-rendering", "false", { timeout: 15_000 });
    // Zoom lives in the chrome on wide screens only.
    if (await panel.getByLabel("Zoom").isVisible()) {
      const before = (await pageCanvas.boundingBox())?.width ?? 0;
      await panel.getByLabel("Zoom").selectOption("150");
      await expect.poll(async () => (await pageCanvas.boundingBox())?.width ?? 0).toBeGreaterThan(before * 1.3);
    }
    await panel.getByRole("button", { name: "Close preview" }).click();
    await expect(panel).toHaveCount(0);

    await sendMessage(page, "Make an Excel spreadsheet of three fruits and their colours");
    const second = assistantMessages(page).nth(1);
    await expect(second).toHaveAttribute("data-message-status", "complete", { timeout: 30_000 });
    const sheetCard = second.getByRole("button", { name: /Open file: .*\.xlsx/ });
    await expect(sheetCard).toContainText("Spreadsheet");
    await sheetCard.click();
    const sheetPanel = page.getByRole("dialog", { name: /Preview of .*\.xlsx/ });
    await expect(sheetPanel.locator("[data-sheet-grid]")).toBeVisible({ timeout: 15_000 });
    await expect(sheetPanel.locator("[data-sheet-grid] th").nth(1)).toHaveText("A");
    await expect(sheetPanel.getByLabel("Selected cell")).toHaveText("A1");
    await sheetPanel.locator("[data-sheet-grid] td").nth(2).click();
    await expect(sheetPanel.getByLabel("Selected cell")).toHaveText("B1");
    await expect(sheetPanel.getByRole("tab", { name: "Three Fruits And Their Colours" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(sheetPanel).toHaveCount(0);

    // The preview endpoint is owner-only.
    const fileId = href.match(/\/api\/files\/([a-f0-9]{24})/)?.[1];
    expect(fileId).toBeTruthy();
    const other = await (await page.context().browser()!.newContext({ baseURL: page.url().replace(/\/app.*$/, "") })).newPage();
    expect((await other.request.get(`/api/files/${fileId}/preview`)).status()).toBe(401);
    await other.context().close();
  });

  test("the new chat screen is only the greeting and the composer", async ({ page }) => {
    await register(page, "Clean Tester");
    await expect(page.getByRole("heading", { name: "Hey, Clean. Ready to dive in?" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Booster off" })).toBeVisible();
    await page.getByRole("button", { name: "Booster off" }).click();
    await expect(page.locator("form[aria-label='Message'] svg.lucide-sparkle")).toHaveCount(0);
    await sendMessage(page, "create a robot image");
    await expect(assistantMessages(page).first().locator("[data-generating='image']")).toBeVisible({ timeout: 15_000 });
    await expect(assistantMessages(page).first()).toContainText('Here is the image for "robot"', { timeout: 40_000 });
  });

  test("no provider name is shown anywhere in the chat", async ({ page }) => {
    await register(page, "Brand Tester");
    await sendMessage(page, "Say hello");
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/groq|gemini|hugging face|whisper|flux/i);
  });
});
