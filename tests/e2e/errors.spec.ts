// A failure while drawing shows what went wrong and a way back, never a blank page.
import { expect, test } from "@playwright/test";

test("a card that fails to draw shows an error screen, and the rest of the app keeps working", async ({ page }) => {
  // Make the reading card fail as it lays out its margin.
  await page.addInitScript(() => {
    window.ResizeObserver = class { constructor() { throw new Error("Simulated layout failure"); } } as unknown as typeof ResizeObserver;
  });
  await page.goto("/tree/tr-telos");
  const screen = page.getByTestId("error-screen").first();
  await expect(screen).toBeVisible();
  await expect(screen).toContainText("aren't affected");
  await expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  await screen.getByText("What went wrong").click();
  await expect(screen).toContainText("Simulated layout failure");
  // Only the card failed: the sidebar and the tree's header are still there.
  await expect(page.getByTestId("error-screen")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Tree title" })).toBeVisible();
});
