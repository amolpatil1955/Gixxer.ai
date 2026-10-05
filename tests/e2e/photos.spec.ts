import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/* Reference photos from Unsplash on the Images page, against the mock results (AI_MOCK=1). */

const PASSWORD = "Sup3r-secure-pass";

async function register(page: Page, name: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(`ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gixxer.test`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("reference photos", () => {
  test("Styles searches reference photos with attribution, shows an empty state, and the API is signed-in only", async ({ page }) => {
    expect((await page.request.get("/api/unsplash/search?q=fox")).status()).toBe(401);
    expect((await page.request.post("/api/unsplash/download", { data: { photoId: "mock-sketch" } })).status()).toBe(401);
    await register(page, "Photo Tester");
    await page.goto("/app/images");
    await expect(page.getByRole("tab", { name: "Photos" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Styles" }).click();
    await expect(page.getByRole("list", { name: "Styles" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search photos" }).fill("fox");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const grid = page.getByRole("list", { name: "Photos" });
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const first = grid.getByRole("listitem").first();
    await expect(first.getByRole("link", { name: "Mock Photographer" })).toHaveAttribute("href", /utm_source=gixxer_ai/);
    await expect(first.getByRole("link", { name: "Unsplash" })).toHaveAttribute("href", /unsplash\.com\/photos\/.*utm_medium=referral/);
    await expect(page.getByRole("status")).toContainText("photos for");

    await page.getByRole("searchbox", { name: "Search photos" }).fill("nothing at all");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/No photos for/)).toBeVisible({ timeout: 15_000 });

    // Download tracking goes through the server, which answers with the file and the attribution.
    const tracked = await page.request.post("/api/unsplash/download", { data: { photoId: "mock-sketch" } });
    expect(tracked.status()).toBe(200);
    expect((await tracked.json()).attribution.photographer.name).toBe("Mock Photographer");
    expect((await page.request.post("/api/unsplash/download", { data: { photoId: "../x" } })).status()).toBe(400);
  });
});
