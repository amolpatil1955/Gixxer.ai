import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { withDb } from "./helpers/db";

/*
 * The admin area and signing in as another account. The owner is granted the
 * role the way a deployment does it, by email, and everyone else must be shut
 * out of the whole thing.
 */

const PASSWORD = "Sup3r-secure-pass";

function uniqueEmail(tag: string): string {
  return `ad-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`;
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

async function logout(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.locator("aside [aria-haspopup='menu']").filter({ visible: true }).last().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Grants the role the way the bootstrap list does, without restarting the server. */
async function makeAdmin(email: string) {
  await withDb(async (client) => {
    const result = await client.db().collection("users").updateOne({ email: email.toLowerCase() }, { $set: { role: "admin" } });
    if (result.matchedCount !== 1) throw new Error(`No account for ${email}`);
  });
}

test.describe("admin", () => {
  test("an ordinary account cannot reach the admin area at all", async ({ page }) => {
    await register(page, "Plain Person");
    await expect(page.locator("aside").filter({ visible: true }).first().getByRole("link", { name: "Admin" })).toHaveCount(0);
    // The page itself refuses, not only the missing link.
    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("an admin sees every account, opens one, and the whole sitting is signposted and recorded", async ({ page }) => {
    const member = await register(page, "Member Person");
    // Something of theirs to be found later.
    await page.getByRole("textbox", { name: "Message" }).fill("My private plans");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("[data-message-role='assistant']").first()).toHaveAttribute("data-message-status", "complete", { timeout: 20_000 });
    await logout(page);

    const owner = await register(page, "Owner Person");
    await makeAdmin(owner);
    // The role is read from the database on every request, so a reload is enough.
    await page.goto("/app/admin");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.locator(`[data-user-row='${member}']`)).toBeVisible();

    // The row carries its own button, so an account is one click and one confirmation away.
    const row = page.locator(`[data-user-row='${member}']`);
    await expect(row.getByRole("button", { name: "Log in to this account" })).toBeVisible();

    // Their activity is visible as counts and titles on the detail page.
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/app\/admin\/[a-f0-9]{24}$/);
    await expect(page.getByText("My private plans")).toBeVisible();

    await page.getByLabel(/Why/).fill("Reproducing their reported bug");
    await page.getByRole("button", { name: "Log in to this account" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Log in to this account" }).click();

    // Now inside their account, said plainly and permanently.
    await expect(page.locator(`[data-impersonation-banner='${member}']`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-impersonation-banner]")).toContainText(owner);
    await expect(page.locator('a[href^="/app/chat/"]', { hasText: "My private plans" }).first()).toBeAttached({ timeout: 15_000 });

    // While acting as someone else there are no admin powers: no link, and the page refuses.
    await expect(page.locator("aside").filter({ visible: true }).first().getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/app/admin");
    await expect(page.locator("[data-impersonation-banner]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accounts" })).toHaveCount(0);

    // Leaving returns the admin to their own account.
    await page.locator("[data-impersonation-banner]").getByRole("button", { name: "Leave this account" }).click();
    await expect(page).toHaveURL(/\/app\/admin$/, { timeout: 20_000 });
    await expect(page.locator("[data-impersonation-banner]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    // The sitting is in the record, with who, why and that it ended.
    await page.locator(`[data-user-row='${member}']`).getByRole("link").first().click();
    const history = page.getByRole("list", { name: "Impersonation history" });
    await expect(history).toContainText(owner);
    await expect(history).toContainText("Reproducing their reported bug");
    await expect(history).toContainText("ended admin");
  });

  test("the button on the list logs straight into the account", async ({ page }) => {
    const member = await register(page, "Listed Person");
    await logout(page);
    const owner = await register(page, "Owner Three");
    await makeAdmin(owner);

    await page.goto("/app/admin");
    await page.locator(`[data-user-row='${member}']`).getByRole("button", { name: "Log in to this account" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Log in to this account" }).click();
    await expect(page.locator(`[data-impersonation-banner='${member}']`)).toBeVisible({ timeout: 20_000 });
    // Inside their account, with the full workspace rather than a read-only view.
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await page.locator("[data-impersonation-banner]").getByRole("button", { name: "Leave this account" }).click();
    await expect(page).toHaveURL(/\/app\/admin$/, { timeout: 20_000 });
  });

  test("an admin cannot open another admin's account", async ({ page }) => {
    const other = await register(page, "Other Admin");
    await makeAdmin(other);
    await logout(page);
    const owner = await register(page, "Owner Two");
    await makeAdmin(owner);
    await page.goto("/app/admin");
    // The list offers no way in for an administrator's account.
    const adminRow = page.locator(`[data-user-row='${other}']`);
    await expect(adminRow.getByRole("button", { name: "Log in to this account" })).toHaveCount(0);
    await expect(adminRow).toContainText("Administrator");

    await adminRow.getByRole("link").first().click();
    await expect(page.getByText(/An administrator.s account cannot be opened this way/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in to this account" })).toHaveCount(0);
  });
});
