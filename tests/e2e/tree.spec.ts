import { expect, test } from "@playwright/test";
import { card, dragThreadTo, emptyMarginPoint, expectPath, openTree, paste, selectPhrase, showBranches } from "./helpers";

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
    await showBranches(page);
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
    await showBranches(page);
    await page.getByRole("button", { name: /Go to card 1/ }).click();
    await expect.poll(() => page.getByTestId("card-stack").evaluate((el) => el.scrollLeft)).toBe(0);
    const token = card(page, "n-stripe").locator('[data-branch="n-token"]');
    await token.hover();
    // A note opens over the workspace to read and write; "Open as card" puts it in the trail.
    await token.getByRole("button", { name: "Open" }).focus();
    await page.keyboard.press("Enter");
    const popup = page.getByTestId("branch-popup");
    await expect(popup.getByRole("textbox", { name: "Your writing" })).toHaveValue(/Tokenisation/);
    await popup.getByRole("button", { name: "Open as card" }).click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    await expectPath(page, ["n-stripe", "n-token"]);
  });

  test("selecting text and choosing Note writes a branch in the margin", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "two-person company");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Note/ }).click();
    const editor = c.locator('[data-testid="margin"]').getByRole("textbox", { name: "Note" });
    await editor.fill("Small teams can sell globally from day one.");
    await editor.press("Control+Enter");
    await expect(c.getByTestId("branch-card").filter({ hasText: "Small teams can sell globally" })).toBeVisible();
    await expect(c.locator("mark.k-note", { hasText: "two-person company" })).toBeVisible();
  });

  test("dragging the thread into the margin writes a linked note", async ({ page }) => {
    await openTree(page);
    await showBranches(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "security, compliance and fraud checks");
    const p = await emptyMarginPoint(c);
    await dragThreadTo(page, c, p.x, p.y);
    const editor = c.locator('[data-testid="margin"]').getByRole("textbox", { name: "Note" });
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
    await showBranches(page);
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
    await showBranches(page);
    const b = card(page, "n-stripe").locator('[data-branch="n-primer"]');
    // The actions show on hover or keyboard focus; use the keyboard so scrolling can't hide them.
    await b.getByRole("button", { name: "Delete" }).focus();
    await page.keyboard.press("Enter");
    await expect(b.getByRole("button", { name: /Delete with 3 branches\?/ })).toBeFocused();
    await page.keyboard.press("Enter");
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

  test("your writing saves as you type", async ({ page }) => {
    await openTree(page, "tr-telos");
    await page.getByRole("button", { name: "Writing", exact: true }).click();
    const note = page.getByRole("textbox", { name: "Your writing" });
    await note.fill("Telos: what a thing is for. Useful for asking what my work is for.");
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByRole("button", { name: "Writing", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Your writing" })).toHaveValue(/what my work is for/);
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
    await expect(page.locator('[data-testid="margin"]').first()).toBeHidden();
    await page.getByRole("button", { name: /branches/ }).click();
    const sheet = page.getByRole("dialog", { name: "Branches" });
    await sheet.getByTestId("branch-card").filter({ hasText: "How Card Payments Work" }).click();
    await expect(card(page, "n-primer")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});

test.describe("A quiet page", () => {
  test("the page sits alone until you ask for its branches", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await expect(c.locator('[data-testid="margin"][data-side="right"]')).toBeHidden();
    await expect(c.locator("mark.k-source").first()).toBeVisible();
    const toggle = c.getByTestId("branches-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(c.getByTestId("branch-card").filter({ hasText: "How Card Payments Work" })).toBeVisible();
    // The choice is remembered.
    await page.waitForTimeout(400);
    await page.reload();
    await expect(card(page, "n-stripe").locator('[data-testid="margin"][data-side="right"]')).toBeVisible();
    await card(page, "n-stripe").getByTestId("branches-toggle").click();
    await expect(card(page, "n-stripe").locator('[data-testid="margin"][data-side="right"]')).toBeHidden();
  });

  test("making a branch opens the margin to show it", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await expect(c.locator('[data-testid="margin"][data-side="right"]')).toBeHidden();
    await selectPhrase(c, "two-person company");
    await page.keyboard.press("n");
    await expect(c.locator('[data-testid="margin"]').getByRole("textbox", { name: "Note" })).toBeFocused();
  });

  test("the contents list jumps to a part of the source", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await c.getByRole("button", { name: "Contents", exact: true }).click();
    const contents = c.getByTestId("contents");
    await expect(contents.locator(".contents-item")).toHaveText(["What happens when you press Pay", "Why it matters"]);
    await contents.getByRole("button", { name: "Why it matters", exact: true }).click();
    await expect(c.locator("h2.blk", { hasText: "Why it matters" })).toBeInViewport();
    await expect(contents.getByRole("button", { name: "Why it matters", exact: true })).toHaveAttribute("aria-current", "true");
    await expect(c.getByTestId("chapter-bar")).toContainText("Why it matters");
    await page.keyboard.press("Escape");
    await expect(contents).toBeHidden();
  });
});

test.describe("Moving between cards", () => {
  test("a sideways trackpad swipe over a card slides between cards", async ({ page }) => {
    await openTree(page, "tr-payments", ["n-stripe", "n-primer", "n-pci"]);
    const stack = page.getByTestId("card-stack");
    await expect.poll(() => stack.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    const start = await stack.evaluate((el) => el.scrollLeft);
    const text = card(page, "n-pci").locator("[data-block]").first();
    const box = (await text.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 10);
    await page.mouse.wheel(-600, 0);
    await expect.poll(() => stack.evaluate((el) => el.scrollLeft)).toBeLessThan(start);
  });
});

test.describe("Reading around the source", () => {
  test("Wikipedia's summary opens as a card in the margin, and the full article in the reader", async ({ page }) => {
    await page.route("**/api/define?*", (route) => route.fulfill({ json: { term: "Payment card", text: "A payment card is a card that can be used to pay for goods and services.", source: { site: "Wikipedia", title: "Payment card", url: "https://en.wikipedia.org/wiki/Payment_card" } } }));
    await page.route("**/api/fetch?*", (route) => route.fulfill({ json: { title: "Payment card", url: "https://en.wikipedia.org/wiki/Payment_card", site: "Wikipedia", html: "<p>A payment card is a card that can be used to pay for goods and services, in full.</p>" } }));
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "dozens of countries");
    await page.keyboard.press("w");
    const wiki = c.locator('[data-testid="branch-card"]', { hasText: "A payment card is a card" });
    await expect(wiki).toContainText("Wikipedia");
    await expect(page.getByTestId("card")).toHaveCount(1);
    await wiki.getByRole("link", { name: "Wikipedia" }).click();
    const reader = page.getByTestId("reader");
    await expect(reader).toContainText("in full");
    await reader.getByRole("button", { name: "Keep as branch" }).click();
    await expect(page.getByTestId("card")).toHaveCount(2);
  });

  test("Ask on a passage opens a card in the margin and Claude answers there", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "dozens of countries");
    await page.keyboard.press("a");
    const box = c.getByRole("textbox", { name: "Ask Claude about this passage" });
    await expect(box).toBeFocused();
    await box.fill("Which countries?");
    await page.keyboard.press("Enter");
    const answer = c.locator('[data-testid="branch-card"]', { hasText: "Which countries?" });
    await expect(answer).toContainText("Claude · Ask");
    await expect(answer).toContainText("Demo mode");
  });

  test("a branch goes to the margin nearest its passage, can move sides, and can be resized", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 900 });
    await openTree(page);
    const c = card(page, "n-stripe");
    await selectPhrase(c, "When you pay");
    await page.keyboard.press("n");
    const left = c.locator('[data-testid="margin"][data-side="left"]');
    const editor = left.getByRole("textbox", { name: "Note" });
    await expect(editor).toBeFocused();
    await editor.fill("Starts on the left.");
    await editor.press("Escape");
    const note = left.locator('[data-testid="branch-card"]', { hasText: "Starts on the left." });
    await expect(note).toBeVisible();
    const before = (await note.boundingBox())!;
    const corner = (await note.locator(".bcard-resize").boundingBox())!;
    await note.hover();
    await page.mouse.move(corner.x + 4, corner.y + 4);
    await page.mouse.down();
    await page.mouse.move(corner.x - 76, corner.y + 64, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await note.boundingBox())!.width).toBeGreaterThan(before.width + 50);
    await note.getByRole("button", { name: "Move" }).focus();
    await page.keyboard.press("Enter");
    await expect(c.locator('[data-testid="margin"][data-side="right"] [data-testid="branch-card"]', { hasText: "Starts on the left." })).toBeVisible();
  });

  test("a section summary is written in a popup and listed with the contents", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await c.getByRole("button", { name: "Contents", exact: true }).click();
    await c.getByTestId("contents").getByRole("button", { name: "Summarise Why it matters" }).click();
    const box = page.getByTestId("branch-popup").getByRole("textbox", { name: "Summary" });
    await box.fill("Stripe takes on the hard, regulated parts so small teams can sell widely.");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("branch-popup")).toBeHidden();
    // The contents stay open, now with the summary under its section.
    await expect(c.getByTestId("contents")).toContainText("Stripe takes on the hard, regulated parts");
    await showBranches(page);
    await expect(c.locator('[data-testid="branch-card"]', { hasText: "Stripe takes on the hard" })).toContainText("Summary");
  });

  test("an empty summary isn't kept", async ({ page }) => {
    await openTree(page);
    const c = card(page, "n-stripe");
    await c.getByTestId("chapter-bar").getByRole("button", { name: /Summarise/ }).click();
    await expect(page.getByTestId("branch-popup")).toBeVisible();
    await page.keyboard.press("Escape");
    await c.getByRole("button", { name: "Contents", exact: true }).click();
    await expect(c.getByTestId("contents")).not.toContainText("Empty summary");
  });
});
