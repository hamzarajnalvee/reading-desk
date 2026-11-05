import { expect, test } from "@playwright/test";
import { card, dragThreadTo, emptyMarginPoint, expectPath, openTree, paste, selectPhrase } from "./helpers";

test.describe("Home", () => {
  test("lists trees and starts a new one from an idea", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tree-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Start a new tree" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a tree" });
    await dialog.getByRole("textbox", { name: "Title" }).fill("Syllogistic method");
    await dialog.getByRole("textbox", { name: "Your idea" }).fill("All men are mortal. Socrates is a man. So Socrates is mortal.");
    await dialog.getByRole("button", { name: "Start tree" }).click();
    await expect(page).toHaveURL(/\/tree\//);
    await expect(page.getByRole("textbox", { name: "Tree title" })).toHaveValue("Syllogistic method");
    await expect(page.getByTestId("card")).toContainText("Socrates is a man.");
  });
});

test.describe("Cards", () => {
  test("opening a tree starts at the seed and offers to resume the last trail", async ({ page }) => {
    await openTree(page);
    await expect(page.getByTestId("card")).toHaveCount(1);
    await page.getByTestId("resume").click();
    await expect(page.getByTestId("card")).toHaveCount(4);
    await expect(page.locator(".trail-bar")).toContainText("3D Secure Explained");
  });

  test("clicking a source branch opens it as the next card, and closing it goes back", async ({ page }) => {
    await openTree(page);
    await card(page, "n-stripe").locator('[data-branch="n-primer"]').click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    await expect(card(page, "n-primer")).toContainText("Every card payment involves five parties");
    await expectPath(page, ["n-stripe", "n-primer"]);
    await card(page, "n-primer").getByRole("button", { name: /Close this card/ }).click();
    await expect(page.getByTestId("card")).toHaveCount(1);
  });

  test("clicking a source passage in the text opens it too", async ({ page }) => {
    await openTree(page);
    await card(page, "n-stripe").locator("mark.k-source", { hasText: "card networks" }).click();
    await expect(card(page, "n-primer")).toBeVisible();
  });

  test("opening a branch from an earlier card replaces the cards after it", async ({ page }) => {
    await openTree(page, "tr-payments", ["n-stripe", "n-primer", "n-pci"]);
    await page.getByRole("button", { name: /Go to card 1/ }).click();
    await expect.poll(() => page.getByTestId("card-stack").evaluate((el) => el.scrollLeft)).toBe(0);
    const token = card(page, "n-stripe").locator('[data-branch="n-token"]');
    await token.hover();
    await token.getByRole("button", { name: "Open" }).click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    await expectPath(page, ["n-stripe", "n-token"]);
  });

  test("selecting text and choosing Note writes a branch in the margin", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "two-person company");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Note/ }).click();
    const editor = c.getByTestId("margin").getByRole("textbox", { name: "Note" });
    await editor.fill("Small teams can sell globally from day one.");
    await editor.press("Control+Enter");
    await expect(c.getByTestId("branch-card").filter({ hasText: "Small teams can sell globally" })).toBeVisible();
    await expect(c.locator("mark.k-note", { hasText: "two-person company" })).toBeVisible();
  });

  test("dragging the thread into the margin writes a linked note", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "security, compliance and fraud checks");
    const p = await emptyMarginPoint(c);
    await dragThreadTo(page, c, p.x, p.y);
    const editor = c.getByTestId("margin").getByRole("textbox", { name: "Note" });
    await expect(editor).toBeFocused();
    await editor.fill("The specialist work Stripe absorbs.");
    await editor.press("Control+Enter");
    await expect(c.getByTestId("branch-card").filter({ hasText: "The specialist work Stripe absorbs." })).toHaveAttribute("data-kind", "note");
  });

  test("Define falls back to writing your own when no dictionary entry is found", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "developer");
    await page.keyboard.press("d");
    const missing = c.getByTestId("branch-card").filter({ hasText: "No dictionary entry was found" });
    await expect(missing).toBeVisible();
    const def = c.locator(`[data-branch="${await missing.getAttribute("data-branch")}"]`);
    await def.getByRole("button", { name: "Write your own" }).click();
    await def.getByRole("textbox", { name: "Note" }).fill("Someone who writes software.");
    await def.getByRole("textbox", { name: "Note" }).press("Escape");
    await expect(def).toContainText("Someone who writes software.");
    await expect(def).toContainText("Your definition");
  });

  test("Explain asks Claude only when chosen, and labels the answer", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "replaced with a token");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Explain/ }).click();
    const ex = c.locator('[data-testid="branch-card"][data-kind="explanation"]').first();
    await expect(ex).toContainText("Demo mode");
    await expect(ex).toContainText("Claude");
  });

  test("Branch → Paste text opens a new source as the next card", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "Visa and Mastercard");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Branch/ }).click();
    const dialog = page.getByRole("dialog", { name: "Branch from this passage" });
    await dialog.getByRole("tab", { name: "Paste text" }).click();
    await dialog.getByRole("textbox", { name: "Title" }).fill("Card networks");
    await dialog.getByRole("textbox", { name: "Text" }).fill("A card network routes messages between acquirers and issuers.\n\nIt also sets interchange rates.");
    await dialog.getByRole("button", { name: "Add branch" }).click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    await expect(page.getByTestId("card").nth(1)).toContainText("routes messages between acquirers and issuers");
    await expect(page.locator(".trail-bar")).toContainText("Card networks");
  });

  test("Branch → Web address opens a card that explains when the page can't be fetched", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "a few lines of code");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Branch/ }).click();
    const dialog = page.getByRole("dialog", { name: "Branch from this passage" });
    await dialog.getByRole("tab", { name: "Web address" }).click();
    await dialog.getByRole("textbox", { name: "Web address" }).fill("example.com/3ds");
    await dialog.getByRole("button", { name: "Open as branch" }).click();
    const next = page.getByTestId("card").nth(1);
    await expect(next.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(next.getByRole("link", { name: "Open in browser" })).toHaveAttribute("href", "https://example.com/3ds");
  });

  test("pasting into the margin creates a clipping with its source", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    const p = await emptyMarginPoint(c);
    await page.mouse.click(p.x, p.y);
    await paste(page, { "text/plain": "Stripe was founded in 2010.", "text/x-moz-url": "https://en.wikipedia.org/wiki/Stripe,_Inc." });
    const clip = c.locator('[data-testid="branch-card"][data-kind="clipping"]');
    await expect(clip).toContainText("Stripe was founded in 2010.");
    await expect(clip).toContainText("Wikipedia");
  });

  test("deleting a branch asks first and removes what grew from it", async ({ page }) => {
    await openTree(page);
    const b = card(page, "n-stripe").locator('[data-branch="n-primer"]');
    await b.hover();
    await b.getByRole("button", { name: "Delete" }).click();
    await b.getByRole("button", { name: /Delete with 3 branches\?/ }).click();
    await expect(card(page, "n-stripe").locator('[data-branch="n-primer"]')).toHaveCount(0);
    await page.getByRole("radio", { name: "Map" }).click();
    await expect(page.getByTestId("map-node").first()).toBeVisible();
    await expect(page.locator('[data-testid="map-node"][data-node="n-primer"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="map-node"][data-node="n-pci"]')).toHaveCount(0);
  });

  test("branches persist after a reload", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "dozens of countries");
    await page.keyboard.press("h");
    await expect(c.locator("mark.k-highlight", { hasText: "dozens of countries" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.reload();
    await expect(card(page, "n-stripe").locator("mark.k-highlight", { hasText: "dozens of countries" })).toBeVisible();
  });
});

test.describe("Map, understanding, topics", () => {
  test("the map shows every branch and opens a node's trail as cards", async ({ page }) => {
    await page.goto("/tree/tr-payments?view=map");
    // Margin notes stay off the map until something grows from them; the toggle shows them.
    const shown = await page.getByTestId("map-node").count();
    expect(shown).toBeLessThan(11);
    await page.getByRole("button", { name: /Show margin notes/ }).click();
    await expect(page.getByTestId("map-node")).toHaveCount(11);
    await page.locator('[data-testid="map-node"][data-node="n-frictionless"]').click();
    await expectPath(page, ["n-stripe", "n-primer", "n-pci", "n-3ds", "n-frictionless"]);
    await expect(page.getByTestId("card")).toHaveCount(5);
  });

  test("the understanding note saves as you type", async ({ page }) => {
    await openTree(page, "tr-telos");
    await page.getByRole("button", { name: "Understanding" }).click();
    const note = page.getByRole("textbox", { name: "Understanding note" });
    await note.fill("Telos: what a thing is for. Useful for asking what my work is for.");
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByRole("button", { name: "Understanding" }).click();
    await expect(page.getByRole("textbox", { name: "Understanding note" })).toHaveValue(/what my work is for/);
  });

  test("a topic can sit under two bigger topics", async ({ page }) => {
    await page.goto("/topics");
    const logicRows = page.getByTestId("topic-row").filter({ hasText: "Logic" });
    await expect(logicRows).toHaveCount(2);
    await expect(logicRows.first()).toContainText(/also under/);
    await logicRows.first().click();
    const detail = page.getByTestId("topic-detail");
    await expect(detail).toContainText("Philosophy");
    await expect(detail).toContainText("Computer Science");
  });

  test("adding a topic to a tree from its header", async ({ page }) => {
    await openTree(page, "tr-telos");
    await page.getByRole("button", { name: "Topic" }).click();
    await page.getByRole("textbox", { name: "Add topic" }).fill("Ethics");
    await page.keyboard.press("Enter");
    await expect(page.locator(".topic-chips")).toContainText("Ethics");
  });

  test("Ask Claude answers about the trail", async ({ page }) => {
    await openTree(page);
    await page.getByTitle("Ask Claude about this trail").click();
    const ask = page.getByTestId("ask");
    await ask.getByRole("textbox", { name: "Ask Claude" }).fill("What does Stripe do?");
    await ask.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(ask.locator(".turn-assistant")).toContainText("Demo mode");
  });

  test("command palette jumps straight to a branch", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tree-card").first()).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Command palette" }).getByRole("textbox").fill("PCI DSS");
    await page.keyboard.press("Enter");
    await expectPath(page, ["n-stripe", "n-primer", "n-pci"]);
  });
});

test.describe("Phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("cards are full width and branches open in a sheet", async ({ page }) => {
    await openTree(page);
    await expect(page.getByTestId("margin").first()).toBeHidden();
    await page.getByRole("button", { name: /branches/ }).click();
    const sheet = page.getByRole("dialog", { name: "Branches" });
    await sheet.getByTestId("branch-card").filter({ hasText: "How Card Payments Work" }).click();
    await expect(card(page, "n-primer")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
