import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/*
 * The voice assistant, end to end against the deterministic stand-in (AI_MOCK=1).
 * The microphone is a silent oscillator whose gain the test controls, so the
 * suite decides when the user is talking: gain up is speech, gain down is a
 * pause. That drives the real turn detection in the stand-in rather than
 * simulating it.
 */

const PASSWORD = "Sup3r-secure-pass";

async function register(page: Page, name: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(`vo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** A microphone the test can speak through, installed before the page scripts run. */
async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as { __micGain?: GainNode; __setMicGain?: (value: number) => void };
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 220;
      const gain = context.createGain();
      gain.gain.value = 0;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      await context.resume();
      scope.__micGain = gain;
      return destination.stream;
    };
    scope.__setMicGain = (value: number) => {
      if (scope.__micGain) scope.__micGain.gain.value = value;
    };
  });
}

const say = (page: Page, value: number) => page.evaluate((level) => (window as unknown as { __setMicGain: (v: number) => void }).__setMicGain(level), value);
const orb = (page: Page) => page.locator("[data-voice-assistant]");

/** Speaks for `ms`, then falls silent so the stand-in sees the end of the turn. */
async function speak(page: Page, ms: number) {
  await say(page, 0.6);
  await page.waitForTimeout(ms);
  await say(page, 0);
}

/**
 * Speaks until Gixxer starts answering. The audio thread shares a machine with
 * the other workers, so a first attempt can be starved of samples; a person
 * would simply say it again, and so does this.
 */
async function speakUntilAnswered(page: Page, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await speak(page, 1400);
    try {
      await expect(orb(page)).toHaveAttribute("data-voice-state", "speaking", { timeout: 12_000 });
      return;
    } catch {
      // Not heard yet; say it again.
    }
  }
  await expect(orb(page)).toHaveAttribute("data-voice-state", "speaking", { timeout: 20_000 });
}

test.describe("voice assistant", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "fake audio input is a Chromium feature");
  // Real audio clocks: one conversation at a time, with room for several spoken turns.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("holds a spoken conversation, can be interrupted, and writes it into the chat", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    await fakeMicrophone(page);
    await register(page, "Voice Chat");

    await page.getByRole("button", { name: "Talk to Gixxer" }).click();
    const window_ = page.getByRole("dialog", { name: /Talk to Gixxer|Listening|Connecting/ });
    await expect(window_).toBeVisible();
    // Gixxer opens the call itself, then settles into listening.
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 45_000 });
    // Exactly one conversation holds the microphone.
    await expect(orb(page)).toHaveAttribute("data-voice-sessions", "1");

    // A turn: speak, pause, and the assistant answers out loud.
    await speakUntilAnswered(page);
    await expect(page.locator("[data-transcript-role='user']").last()).toContainText("Something said", { timeout: 30_000 });
    await expect(page.locator("[data-transcript-role='assistant']").last()).toContainText("Mock voice reply", { timeout: 30_000 });

    // Talking over it stops the answer at once and returns to listening.
    await say(page, 0.6);
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 30_000 });
    await say(page, 0);

    // A second turn works, so turn-taking is not a one-shot.
    await speakUntilAnswered(page);

    // Muting is honoured, then the call ends and the microphone is released.
    await page.getByRole("button", { name: "Mute microphone" }).click();
    await expect(page.getByRole("button", { name: "Unmute microphone" })).toBeVisible();
    await page.getByRole("button", { name: "End conversation" }).click();
    await expect(orb(page)).toHaveAttribute("data-voice-state", "ended", { timeout: 30_000 });
    await expect(orb(page)).toHaveAttribute("data-voice-sessions", "0");
    await page.getByRole("button", { name: "Close", exact: true }).click();

    // What was said is an ordinary part of the chat: visible in the thread and in the sidebar.
    await expect(page).toHaveURL(/\/app\/chat\/[a-f0-9]{24}$/, { timeout: 45_000 });
    await expect(page.locator("[data-message-role='user']").first()).toContainText("Something said", { timeout: 45_000 });
    await expect(page.locator("[data-message-role='assistant']").first()).toContainText("Mock voice reply");
    await page.reload();
    await expect(page.locator("[data-message-role='assistant']").first()).toContainText("Mock voice reply");

    // Text chat still works in the same conversation.
    await page.getByRole("textbox", { name: "Message" }).fill("And in writing?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("[data-message-role='assistant']").last()).toContainText("Mock reply to: And in writing?", { timeout: 45_000 });
  });

  test("opens the call by speaking first, once, and yields if the person talks over it", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    await fakeMicrophone(page);
    await register(page, "Voice Greeting");

    await page.getByRole("button", { name: "Talk to Gixxer" }).click();
    // The greeting is spoken only once the session is ready, so it begins in Speaking.
    await expect(orb(page)).toHaveAttribute("data-voice-state", "speaking", { timeout: 45_000 });
    const greeting = page.locator("[data-transcript-role='assistant']").first();
    await expect(greeting).toContainText("How can I help you", { timeout: 30_000 });
    // Then it settles into listening on its own.
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 45_000 });

    // Talking over the greeting is honoured, and the greeting never comes a second time.
    await speakUntilAnswered(page);
    await say(page, 0.6);
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 30_000 });
    await say(page, 0);
    await expect(page.locator("[data-transcript-role='assistant']").filter({ hasText: "How can I help you" })).toHaveCount(1);

    await page.getByRole("button", { name: "End conversation" }).click();
    await expect(orb(page)).toHaveAttribute("data-voice-state", "ended", { timeout: 30_000 });
  });

  test("recovers on its own when the connection drops mid-conversation", async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    await fakeMicrophone(page);
    await register(page, "Voice Drop");
    // The stand-in drops the connection once, right after its first reply.
    await page.evaluate(() => localStorage.setItem("gixxer-voice-mock-drop", "1"));

    await page.getByRole("button", { name: "Talk to Gixxer" }).click();
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 45_000 });
    await speakUntilAnswered(page);
    // It comes back to listening by itself, without the window closing.
    await expect(orb(page)).toHaveAttribute("data-voice-state", "listening", { timeout: 30_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "End conversation" }).click();
    await expect(orb(page)).toHaveAttribute("data-voice-state", "ended", { timeout: 30_000 });
  });

  test("explains a refused microphone and offers to try again", async ({ page }) => {
    await register(page, "Voice Denied");
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    });
    await page.reload();

    await page.getByRole("button", { name: "Talk to Gixxer" }).click();
    await expect(orb(page)).toHaveAttribute("data-voice-state", "denied", { timeout: 45_000 });
    await expect(page.getByText(/Allow the microphone for this site/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // Nothing holds the microphone, and the chat is untouched underneath.
    await expect(orb(page)).toHaveAttribute("data-voice-sessions", "0");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Message" }).fill("Typing still works");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("[data-message-role='assistant']").first()).toContainText("Mock reply to: Typing still works", { timeout: 45_000 });
  });

  test("the session endpoints belong to the signed-in owner", async ({ page }) => {
    expect((await page.request.post("/api/voice/session", { data: {} })).status()).toBe(401);
    expect((await page.request.post("/api/voice/turn", { data: { userText: "hi" } })).status()).toBe(401);
    await register(page, "Voice Guard");
    // A conversation that is not theirs is not found, and nonsense is refused.
    expect((await page.request.post("/api/voice/session", { data: { conversationId: "a".repeat(24) } })).status()).toBe(404);
    expect((await page.request.post("/api/voice/turn", { data: { userText: "" } })).status()).toBe(400);
    const opened = await page.request.post("/api/voice/session", { data: {} });
    expect(opened.status()).toBe(200);
    const body = await opened.json();
    // Under the stand-in no token exists at all; in production only a short-lived one is ever sent.
    expect(body.session.mock).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/AIza|api[_-]?key/i);
  });
});
