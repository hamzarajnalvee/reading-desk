import { expect, test } from "@playwright/test";
import { card, openTree } from "./helpers";

test.describe("Writing in place", () => {
  test("clicking your own writing lets you type straight away, and it saves as you type", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start a new tree" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a tree" });
    await dialog.getByRole("textbox", { name: "Title" }).fill("Habits");
    await dialog.getByRole("textbox", { name: "Your idea" }).fill("Small habits compound over time.");
    await dialog.getByRole("button", { name: "Start tree" }).click();

    const c = page.getByTestId("card");
    await c.locator("[data-block]").first().click();
    const writer = c.getByRole("textbox", { name: "Your writing" });
    await expect(writer).toBeFocused();
    await writer.press("ControlOrMeta+End");
    await page.keyboard.type("\n\nThey start too small to notice.");
    await writer.press("Escape");
    await expect(writer).toHaveCount(0);
    await expect(c.locator("[data-block]")).toHaveCount(2);
    await expect(c).toContainText("They start too small to notice.");

    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId("card")).toContainText("They start too small to notice.");
  });

  test("a margin note saves as you type, with no save button", async ({ page }) => {
    await openTree(page);
    const note = card(page, "n-stripe").locator('[data-branch="n-token"]');
    await note.hover();
    await note.getByRole("button", { name: "Edit" }).click();
    const box = note.getByRole("textbox", { name: "Note" });
    await expect(box).toBeFocused();
    await page.keyboard.type(" Edited.");
    await expect(note.getByRole("button", { name: "Save" })).toHaveCount(0);
    await box.press("Escape");
    await expect(note).toContainText("Edited.");
  });

  test("clicking a margin note's words edits it in place, without opening a new card", async ({ page }) => {
    await openTree(page);
    const note = card(page, "n-stripe").locator('[data-branch="n-token"]');
    await note.locator(".bcard-note").click();
    await expect(note.getByRole("textbox", { name: "Note" })).toBeFocused();
    await expect(page.getByTestId("card")).toHaveCount(1);
  });

  test("a note opened as a card can be typed into directly", async ({ page }) => {
    await openTree(page, "tr-payments", ["n-stripe", "n-token"]);
    const c = card(page, "n-token");
    await c.locator("[data-block]").first().click();
    await expect(c.getByRole("textbox", { name: "Your writing" })).toBeFocused();
  });
});

test.describe("Lock and delete", () => {
  test("a locked tree can be read but not changed or deleted", async ({ page }) => {
    await openTree(page);
    await page.getByRole("button", { name: "Tree options" }).click();
    await page.getByRole("menuitem", { name: "Lock tree" }).click();

    await expect(page.getByRole("textbox", { name: "Tree title" })).not.toBeEditable();
    const c = card(page, "n-stripe");
    await expect(c).toContainText("Locked");
    await expect(c.getByTestId("branch-card").first().getByTitle("Delete")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Topic" })).toHaveCount(0);

    await page.getByRole("button", { name: "Tree options" }).click();
    await expect(page.getByText("Unlock this tree to delete it.")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Delete tree/ })).toHaveCount(0);

    await page.getByRole("menuitem", { name: "Unlock tree" }).click();
    await expect(page.getByRole("textbox", { name: "Tree title" })).toBeEditable();
  });

  test("the locked state survives a reload", async ({ page }) => {
    await openTree(page);
    await page.getByRole("button", { name: "Tree options" }).click();
    await page.getByRole("menuitem", { name: "Lock tree" }).click();
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Tree title" })).not.toBeEditable();
  });

  test("deleting a tree from its menu asks first, then returns to your trees", async ({ page }) => {
    await openTree(page);
    await page.getByRole("button", { name: "Tree options" }).click();
    await page.getByRole("menuitem", { name: /Delete tree/ }).click();
    await page.getByRole("button", { name: "Delete tree" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("tree-card")).toHaveCount(1);
  });
});

test.describe("Stretching the margin", () => {
  test("dragging the margin's edge widens the cards, and the width is remembered", async ({ page }) => {
    await openTree(page);
    const margin = card(page, "n-stripe").getByTestId("margin");
    const before = (await margin.boundingBox())!.width;
    const grip = margin.getByRole("separator", { name: "Stretch the margin" });
    await margin.hover();
    const g = (await grip.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + 200);
    await page.mouse.down();
    await page.mouse.move(g.x - 60, g.y + 200, { steps: 5 });
    await page.mouse.move(g.x - 120, g.y + 200, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await margin.boundingBox())!.width).toBeGreaterThan(before + 80);
    const wide = (await margin.boundingBox())!.width;

    await page.waitForTimeout(400);
    await page.reload();
    await expect.poll(async () => Math.round((await card(page, "n-stripe").getByTestId("margin").boundingBox())!.width)).toBe(Math.round(wide));
  });
});
