import { expect, test } from "@playwright/test";

// The test server runs without Supabase settings, so sync stays off and everything is saved locally.
test.describe("accounts and sync", () => {
  test("without sync set up, the sidebar says saved on this device and the sync page explains backups", async ({ page }) => {
    await page.goto("/");
    const status = page.getByTestId("sync-status");
    await expect(status).toContainText("Saved on this device");
    await status.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByTestId("sign-in")).toContainText("Sync isn't set up");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
  });
});
