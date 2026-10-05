import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * The workspace, end to end, against mock AI providers (AI_MOCK=1 on the
 * test server). The mock echoes the last user message, so replies are
 * predictable without spending a token.
 */

const PASSWORD = "Sup3r-secure-pass";

function uniqueEmail(tag: string): string {
  return `ws-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`;
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

/** Log out lives in the account menu at the foot of the sidebar; on phones the sidebar is a drawer. */
async function logout(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("aside [aria-haspopup='menu']").filter({ visible: true }).last().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function sendMessage(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

const assistantMessages = (page: Page) => page.locator("[data-message-role='assistant']");

test.describe("chat", () => {
  test("streams a reply, keeps history, regenerates into a branch and edits a message", async ({ page }) => {
    await register(page, "Chat Tester");
    await expect(page.getByRole("heading", { name: "Hey, Chat. Ready to dive in?" })).toBeVisible();

    await sendMessage(page, "Tell me about the moon");
    await expect(assistantMessages(page).first()).toContainText("Mock reply to: Tell me about the moon", { timeout: 20_000 });
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\/chat\/[a-f0-9]{24}$/);

    // The conversation is listed and reloading keeps the thread.
    // Role queries skip the sidebar while it is hidden on phones, so match the link itself.
    await expect(page.locator('a[href^="/app/chat/"]', { hasText: "Tell me about the moon" }).first()).toBeAttached({ timeout: 15_000 });
    await page.reload();
    await expect(assistantMessages(page).first()).toContainText("Mock reply to: Tell me about the moon");

    // A second turn continues the same conversation.
    await sendMessage(page, "And the sun?");
    await expect(assistantMessages(page).nth(1)).toContainText("Mock reply to: And the sun?", { timeout: 20_000 });
    await expect(assistantMessages(page).nth(1)).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });

    // Regenerating creates a sibling reply and shows the branch switcher.
    await assistantMessages(page).nth(1).hover();
    await assistantMessages(page).nth(1).getByRole("button", { name: "Regenerate" }).click();
    await expect(assistantMessages(page).nth(1)).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await expect(assistantMessages(page).nth(1).getByText("2/2")).toBeVisible({ timeout: 15_000 });

    // Editing the first message forks the thread from that point.
    const firstUser = page.locator("[data-message-role='user']").first();
    await firstUser.hover();
    await firstUser.getByRole("button", { name: "Edit message" }).click();
    await page.getByRole("textbox", { name: "Edit message" }).fill("Tell me about Mars");
    await page.getByRole("button", { name: "Save and send" }).click();
    await expect(assistantMessages(page).first()).toContainText("Mock reply to: Tell me about Mars", { timeout: 20_000 });
    await expect(assistantMessages(page)).toHaveCount(1);
    await expect(page.locator("[data-message-role='user']").first().getByText("2/2")).toBeVisible({ timeout: 15_000 });
  });

  test("search finds conversations by their words", async ({ page }) => {
    await register(page, "Search Tester");
    await sendMessage(page, "Remember the word pomegranate");
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await page.goto("/app/search?q=pomegranate");
    await expect(page.getByRole("main").getByRole("link", { name: /pomegranate/ })).toBeVisible();
    await page.goto("/app/search?q=zzzz-nothing");
    await expect(page.getByText("Nothing matched")).toBeVisible();
  });
});

test.describe("library and file intelligence", () => {
  test("uploads a document, indexes it and answers from it with a citation", async ({ page }) => {
    await register(page, "Files Tester");
    await page.goto("/app/library");
    await page.locator("input[type=file]").setInputFiles({
      name: "handbook.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Employees get 25 days of paid leave each year. The office is closed on public holidays."),
    });
    const row = page.locator("[data-file-status]").filter({ hasText: "handbook.txt" });
    await expect(row).toHaveAttribute("data-file-status", "indexed", { timeout: 20_000 });
    await expect(row).toContainText("25 days of paid leave");

    await row.getByRole("link", { name: "Chat" }).click();
    await expect(page).toHaveURL(/\/app\?attach=/);
    await expect(page.getByText("handbook.txt")).toBeVisible();
    await sendMessage(page, "How many days of leave do I get?");
    await expect(assistantMessages(page).first()).toContainText("using 1 source", { timeout: 20_000 });
    await expect(assistantMessages(page).first().getByRole("link", { name: /handbook\.txt/ })).toBeVisible({ timeout: 15_000 });
  });

  test("refuses files that are not what they claim to be", async ({ page }) => {
    await register(page, "Sniff Tester");
    await page.goto("/app/library");
    await page.locator("input[type=file]").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") });
    await expect(page.getByRole("alert").filter({ hasText: "does not look like" })).toBeVisible();
  });
});

test.describe("images", () => {
  test("generates an image and offers a download", async ({ page }) => {
    await register(page, "Image Tester");
    await page.goto("/app/images");
    await page.getByRole("textbox", { name: "Image prompt" }).fill("A red circle on white");
    await page.getByRole("button", { name: "Image options" }).click();
    await page.getByRole("radio", { name: "1024 × 1024" }).click();
    await page.getByRole("button", { name: "Generate" }).click();
    const image = page.getByRole("img", { name: "A red circle on white" });
    await expect(image).toBeVisible({ timeout: 30_000 });
    const src = await image.getAttribute("src");
    expect(src).toMatch(/^\/api\/images\/[a-f0-9]{24}$/);
    const response = await page.request.get(`${src}?download=1`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(response.headers()["content-disposition"]).toContain("attachment");
  });
});

test.describe("chatbot pro and the widget", () => {
  test("builds a bot, goes live, and a visitor chats and leaves a lead", async ({ page, browser, baseURL }) => {
    await register(page, "Bot Owner");
    // The wizard: name, use case, knowledge, training, theme, publish.
    await page.goto("/app/chatbots/new");
    await page.getByLabel("What should the chatbot be called?").fill("Aria");
    await page.getByLabel("Your business name").fill("Northwind Cycles");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: /Customer support/ })).toBeVisible();
    await page.getByRole("button", { name: /Customer support/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Knowledge: details typed by hand are read at once.
    await expect(page.getByRole("tab", { name: "Add details manually" })).toBeVisible();
    await page.getByRole("tab", { name: "Add details manually" }).click();
    await page.getByLabel("Name").fill("Hours");
    await page.getByLabel("Details").fill("We are open 9am to 6pm Monday to Saturday. Sunday we are closed.");
    await page.getByRole("button", { name: "Add to knowledge" }).click();
    await expect(page.locator("[data-source-status='indexed']").filter({ hasText: "Hours" })).toBeVisible({ timeout: 15_000 });

    // A private address is refused before any crawl starts.
    await page.getByRole("tab", { name: "Website URL" }).click();
    await page.getByLabel("Website address").fill("http://127.0.0.1:9/secret");
    await page.getByRole("button", { name: "Start crawling" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not reachable from here" }).first()).toBeVisible();

    // A public site is crawled, then its pages are indexed.
    await page.getByLabel("Website address").fill("https://northwind.example");
    await page.getByRole("button", { name: "Start crawling" }).click();
    await expect(page.locator("[data-source-status='indexed']").filter({ hasText: "northwind.example" })).toBeVisible({ timeout: 30_000 });

    // Training reports what was learned, then the theme step previews the widget.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Training complete")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: /Midnight/ })).toBeVisible();
    await page.getByRole("button", { name: /Midnight/ }).click();
    await expect(page.locator("[data-widget-preview]").first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Publish: the key exists but the public widget stays hidden until it goes live.
    await expect(page.getByText("Ready to go live")).toBeVisible({ timeout: 15_000 });
    const publicKey = (await page.locator("code", { hasText: /^<script/ }).first().textContent())?.match(/gx_[A-Za-z0-9_-]+/)?.[0] ?? "";
    expect(publicKey).toMatch(/^gx_/);
    expect((await page.request.get(`/api/widget/${publicKey}/config`)).status()).toBe(404);

    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("Live and answering")).toBeVisible({ timeout: 15_000 });
    const config = await page.request.get(`/api/widget/${publicKey}/config`);
    expect(config.status()).toBe(200);
    expect(config.headers()["access-control-allow-origin"]).toBe("*");
    expect((await config.json()).name).toBe("Aria");

    // The loader script is public and the embed page may be framed.
    const script = await page.request.get("/widget.js");
    expect(script.status()).toBe(200);
    expect(script.headers()["content-type"]).toContain("javascript");
    expect(await script.text()).toContain("GixxerWidget");
    const embed = await page.request.get(`/embed/${publicKey}`);
    expect(embed.status()).toBe(200);
    expect(embed.headers()["content-security-policy"]).toContain("frame-ancestors *");
    expect(embed.headers()["x-frame-options"]).toBeUndefined();

    // A visitor, in a fresh browser context with no account.
    const visitorContext = await browser.newContext({ baseURL });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/embed/${publicKey}?host=${encodeURIComponent("https://shop.example")}`);
    await expect(visitor.getByText(/If you need any assistance/)).toBeVisible();
    await visitor.getByRole("button", { name: "What are your hours?" }).click();
    await expect(visitor.getByText("Mock reply to: What are your hours?")).toBeVisible({ timeout: 20_000 });
    await visitor.getByRole("textbox", { name: "Your message" }).fill("When are you open on Sunday?");
    await visitor.getByRole("button", { name: "Send" }).click();
    // The bot knows the typed hours and the crawled site, so it may cite either; the hours must be among them.
    const answer = visitor.getByText(/Mock reply to: When are you open on Sunday\?/);
    await expect(answer).toBeVisible({ timeout: 20_000 });
    await expect(answer).toContainText("[source: Hours · part 1]");

    await visitor.getByRole("button", { name: "Contact" }).click();
    await visitor.getByLabel("Your name").fill("Sam Visitor");
    await visitor.getByLabel("Your email").fill("sam@example.com");
    await visitor.getByLabel("Message", { exact: true }).fill("Please call me about a fleet order.");
    await visitor.getByRole("button", { name: "Send", exact: true }).nth(0).click();
    await expect(visitor.getByRole("status")).toContainText("Thanks, Sam Visitor");
    await visitorContext.close();

    // The owner sees the conversation, the lead and the analytics.
    await page.getByRole("link", { name: "Go to the dashboard" }).click();
    await expect(page).toHaveURL(/\/app\/chatbots\/[a-f0-9]{24}\/overview$/);
    await page.getByRole("link", { name: "Conversations" }).click();
    await expect(page.getByText("What are your hours?", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Leads" }).click();
    await expect(page.getByRole("cell", { name: "Sam Visitor" })).toBeVisible();
    await expect(page.getByRole("link", { name: "sam@example.com" })).toBeVisible();
    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page.getByText("across 1 conversations")).toBeVisible();

    // Restricting origins locks other sites out.
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByLabel("Allowed websites").fill("https://shop.example");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.", { timeout: 10_000 });
    const session = "a".repeat(32);
    const blocked = await page.request.post(`/api/widget/${publicKey}/chat?host=${encodeURIComponent("https://evil.example")}`, { data: { sessionId: session, message: "hi" } });
    expect(blocked.status()).toBe(403);
    const allowed = await page.request.post(`/api/widget/${publicKey}/chat?host=${encodeURIComponent("https://shop.example")}`, { data: { sessionId: session, message: "hi" } });
    expect(allowed.status()).toBe(200);
  });
});

test.describe("tenant isolation over HTTP", () => {
  test("one account cannot read another account's chat, file or bot", async ({ page }) => {
    await register(page, "Owner Person");
    await sendMessage(page, "Owner's private note");
    await expect(assistantMessages(page).first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    const chatUrl = page.url();
    await page.goto("/app/library");
    await page.locator("input[type=file]").setInputFiles({ name: "private.txt", mimeType: "text/plain", buffer: Buffer.from("owner only content") });
    await expect(page.locator("[data-file-status='indexed']").filter({ hasText: "private.txt" })).toBeVisible({ timeout: 20_000 });
    const fileHref = await page.getByRole("link", { name: "private.txt" }).getAttribute("href");
    await page.goto("/app/chatbots/new");
    await page.getByLabel("What should the chatbot be called?").fill("Private bot");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: /Customer support/ })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("tab", { name: "Website URL" })).toBeVisible({ timeout: 15_000 });
    await page.goto("/app/chatbots");
    // The bot's own card, not the "New chatbot" link in the header.
    const botUrl = (await page.getByRole("list", { name: "Your chatbots" }).getByRole("link").first().getAttribute("href")) ?? "";
    expect(botUrl).toMatch(/\/app\/chatbots\/[a-f0-9]{24}/);
    await logout(page);

    await register(page, "Other Person");
    await page.goto(chatUrl);
    await expect(page.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
    expect((await page.request.get(fileHref!)).status()).toBe(404);
    await page.goto(botUrl);
    await expect(page.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
    await expect(page.locator('a[href^="/app/chat/"]', { hasText: "Owner's private note" })).toHaveCount(0);
  });

  test("the APIs refuse anonymous callers", async ({ request }) => {
    expect((await request.post("/api/chat", { data: { kind: "send", content: "hi", attachmentIds: [] } })).status()).toBe(401);
    expect((await request.get("/api/files")).status()).toBe(401);
    expect((await request.post("/api/images", { data: { prompt: "a cat" } })).status()).toBe(401);
  });
});
