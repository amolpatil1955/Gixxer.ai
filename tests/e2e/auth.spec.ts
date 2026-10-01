import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { bumpSessionVersionByEmail, deleteUserByEmail } from "./helpers/db";

const PASSWORD = "Sup3r-secure-pass";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`;
}

async function registerViaUi(page: Page, { name, email, password = PASSWORD }: { name: string; email: string; password?: string }) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function loginViaUi(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Next.js renders a global role="alert" route announcer, so scope feedback to the form. */
function formAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}

function formNotice(page: Page) {
  return page.locator("form").getByRole("status");
}

/** Log out lives in the account menu at the foot of the sidebar; on phones the sidebar is a drawer. */
async function logoutViaUi(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("aside [aria-haspopup='menu']").filter({ visible: true }).last().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe("registration", () => {
  test("creates an account, starts a session and enters the workspace", async ({ page }) => {
    const email = uniqueEmail("register");
    await registerViaUi(page, { name: "Ada Lovelace", email });

    await expect(page.getByRole("heading", { name: "Hey, Ada. Ready to dive in?" })).toBeVisible();
    await expect(page.getByText(email).first()).toBeAttached();
    // On phones the account controls live in the drawer; Log out sits in the account menu.
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    await page.locator("aside [aria-haspopup='menu']").filter({ visible: true }).last().click();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
  });

  test("rejects a duplicate email, even with different casing", async ({ page }) => {
    const email = uniqueEmail("dupe");
    await registerViaUi(page, { name: "First Person", email });
    await logoutViaUi(page);

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Second Person");
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(formAlert(page).filter({ hasText: "already exists" })).toBeVisible();
    await expect(page.getByText("This email is already registered")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("validates in the browser before anything is submitted", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();

    await page.getByLabel("Full name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("lettersonly");
    await page.getByLabel("Confirm password").fill("different1");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Include at least one number")).toBeVisible();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("shows password strength feedback and the Google button is disabled", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Password", { exact: true }).fill("weak1234");
    await expect(page.getByText(/Password strength:/)).toContainText("Weak");
    await page.getByLabel("Password", { exact: true }).fill("Correct-Horse-Battery-42");
    await expect(page.getByText(/Password strength:/)).toContainText("Strong");

    const google = page.getByRole("button", { name: /Sign up with Google/ });
    await expect(google).toBeVisible();
    await expect(google).toBeDisabled();
  });
});

test.describe("login", () => {
  test("signs in with valid credentials", async ({ page }) => {
    const email = uniqueEmail("login");
    await registerViaUi(page, { name: "Grace Hopper", email });
    await logoutViaUi(page);

    await loginViaUi(page, email.toUpperCase());
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Hey, Grace. Ready to dive in?" })).toBeVisible();
  });

  test("shows one generic error for a wrong password and for an unknown email", async ({ page }) => {
    const email = uniqueEmail("wrong");
    await registerViaUi(page, { name: "Grace Hopper", email });
    await logoutViaUi(page);

    await loginViaUi(page, email, "not-the-password-1");
    await expect(formAlert(page)).toHaveText("Invalid email or password.");
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUi(page, uniqueEmail("nobody"), PASSWORD);
    await expect(formAlert(page)).toHaveText("Invalid email or password.");
  });

  test("validates required fields without a round trip", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("toggles password visibility and keeps the Google button disabled", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret-1");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");

    const google = page.getByRole("button", { name: /Continue with Google/ });
    await expect(google).toBeVisible();
    await expect(google).toBeDisabled();
  });

  test("locks an email after repeated failed attempts", async ({ page }) => {
    const email = uniqueEmail("lockout");
    await registerViaUi(page, { name: "Locked Out", email });
    await logoutViaUi(page);

    await page.goto("/login");
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(`wrong-password-${attempt}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(formAlert(page)).toHaveText("Invalid email or password.");
    }

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("Too many attempts");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the Auth.js credentials endpoint is throttled, not just the form", async ({ playwright, page, baseURL }) => {
    const email = uniqueEmail("api-brute");
    await registerViaUi(page, { name: "Api Target", email });
    await logoutViaUi(page);

    // A direct HTTP client: this bypasses the sign-in form entirely.
    const api = await playwright.request.newContext({ baseURL });
    const { csrfToken } = await (await api.get("/api/auth/csrf")).json();
    const attempt = (password: string) =>
      api.post("/api/auth/callback/credentials", {
        form: { csrfToken, email, password, callbackUrl: baseURL ?? "" },
        maxRedirects: 0,
      });

    for (let i = 0; i < 5; i++) {
      const response = await attempt(`api-wrong-${i}`);
      expect(response.headers()["location"], `attempt ${i + 1}`).toContain("error=CredentialsSignin");
    }

    // The correct password is now refused because the budget is spent.
    const blocked = await attempt(PASSWORD);
    expect(blocked.headers()["location"]).toContain("code=rate_limited");

    const { cookies } = await api.storageState();
    expect(cookies.find((cookie) => cookie.name.includes("authjs.session-token"))).toBeUndefined();
    await api.dispose();
  });
});

test.describe("sessions and protected routes", () => {
  test("anonymous visitors are redirected to login and back after signing in", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/app/future-area");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ffuture-area$/);

    const email = uniqueEmail("next");
    await registerViaUi(page, { name: "Next Path", email });
    await logoutViaUi(page);

    await page.goto("/app/future-area");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/future-area$/);
  });

  test("the session persists across reloads and logout ends it", async ({ page }) => {
    const email = uniqueEmail("persist");
    await registerViaUi(page, { name: "Persist Me", email });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Hey, Persist. Ready to dive in?" })).toBeVisible();

    const cookies = await page.context().cookies();
    const session = cookies.find((cookie) => cookie.name.includes("authjs.session-token"));
    expect(session, "session cookie present").toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");

    await logoutViaUi(page);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
    const after = await page.context().cookies();
    expect(after.find((cookie) => cookie.name.includes("authjs.session-token"))).toBeUndefined();
  });

  test("signed-in users are kept away from the auth pages and see workspace links on the landing page", async ({ page }) => {
    await registerViaUi(page, { name: "Already In", email: uniqueEmail("authed") });
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("main").getByRole("link", { name: "Open workspace" }).first()).toBeVisible();
  });

  test("a revoked session is cleared and the user is asked to sign in again", async ({ page }) => {
    const email = uniqueEmail("revoke");
    await registerViaUi(page, { name: "Revoked User", email });

    await bumpSessionVersionByEmail(email);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?reason=expired$/);
    await expect(formNotice(page)).toContainText("Your session has expired");
    expect((await page.context().cookies()).find((cookie) => cookie.name.includes("authjs.session-token"))).toBeUndefined();

    await loginViaUi(page, email);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("a deleted account cannot keep using its session", async ({ page }) => {
    const email = uniqueEmail("deleted");
    await registerViaUi(page, { name: "Gone Soon", email });
    await deleteUserByEmail(email);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?reason=expired$/);
  });
});

test.describe("hardening and layout", () => {
  test("responses carry a nonce-based CSP and baseline security headers", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("auth pages never overflow horizontally", async ({ page }) => {
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });

  test("unknown routes render the branded 404", async ({ page }) => {
    const response = await page.goto("/this-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
  });
});
