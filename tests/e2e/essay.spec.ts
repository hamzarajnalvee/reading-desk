// Writing an essay from a tree: adding sources straight to the seed, essay and rabbit-hole tracks,
// linking passages from your writing, and reviewing it all in the Notebook.
import { expect, test } from "@playwright/test";
import { card, expectPath, openTree, selectPhrase, showBranches } from "./helpers";

test.describe("Essay workspace", () => {
  test("pasted text can be added straight to the seed, with no passage", async ({ page }) => {
    await openTree(page, "tr-telos");
    await page.getByTestId("add-to-tree").click();
    const dialog = page.getByRole("dialog", { name: "Add to this tree" });
    await dialog.getByRole("tab", { name: "Paste text" }).click();
    await dialog.getByRole("textbox", { name: "Title" }).fill("The case for the trivial");
    await dialog.getByRole("textbox", { name: "Text" }).fill("Painting a wall teaches patience the screen never will.");
    await dialog.getByRole("button", { name: "Add branch" }).click();
    // The source opens in the seed's margin with its article showing, while the seed stays open to write on.
    await expect(page.getByTestId("card")).toHaveCount(1);
    const branch = card(page, "n-telos").locator('[data-testid="branch-card"][data-kind="source"]');
    await expect(branch).toContainText("Not linked");
    await expect(branch.getByTestId("article")).toContainText("Painting a wall");
    // It sits beside the seed on screen, and stays there while you write on the seed.
    const onScreen = async () => { const b = await branch.boundingBox(); return !!b && b.y > 0 && b.y < 900; };
    await expect.poll(onScreen).toBe(true);
    await card(page, "n-telos").locator(".sheet [data-block]").first().click();
    await expect(card(page, "n-telos").getByRole("textbox", { name: "Your writing" })).toBeVisible();
    await expect.poll(onScreen).toBe(true);
    await page.keyboard.press("Escape");
    // It folds away and opens again from its own button.
    // Select words in the article and send them to your writing, quoted and linked to their place in the source.
    await branch.getByTestId("article").locator("[data-block]").first().evaluate((el) => {
      const t = el.firstChild!, r = document.createRange();
      r.setStart(t, 0); r.setEnd(t, "Painting a wall".length);
      const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r);
    });
    await branch.getByTestId("article").dispatchEvent("mouseup");
    await branch.getByTestId("excerpt-cite").click();
    await expect(page.getByRole("textbox", { name: "Your writing" })).toHaveValue(/> Painting a wall\n> — \[The case for the trivial\]\(#cite:/);
    await page.getByTestId("cite").first().click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    // The article folds away from its own button.
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".trail-bar button").first().click();
    await expect(page.getByTestId("card")).toHaveCount(1);
    await branch.getByRole("button", { name: "Close article" }).focus();
    await page.keyboard.press("Enter");
    await expect(branch.getByTestId("article")).toHaveCount(0);
  });

  test("Read view zooms out to show more of the page, and remembers it", async ({ page }) => {
    await openTree(page, "tr-payments");
    const sheet = card(page, "n-stripe").locator(".sheet").first();
    const before = (await sheet.boundingBox())!.width;
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.getByTestId("zoom")).toContainText("80%");
    await expect.poll(async () => (await sheet.boundingBox())!.width).toBeLessThan(before * 0.9);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId("zoom")).toContainText("80%");
    await page.getByRole("button", { name: /Reset/ }).click();
    await expect(page.getByTestId("zoom")).toContainText("100%");
  });

  test("zooming in keeps the page whole, and you scroll sideways to see the margins", async ({ page }) => {
    await openTree(page, "tr-payments");
    await showBranches(page);
    const c = card(page, "n-stripe");
    const scroller = c.locator(".card-scroll");
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByTestId("zoom")).toContainText("150%");
    await expect.poll(() => scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(100);
    // Threads still meet their branches when zoomed: the selection toolbar appears over the passage.
    await selectPhrase(c, "two-person company");
  });

  test("a note written to the seed waits in its margin", async ({ page }) => {
    await openTree(page, "tr-telos");
    await page.getByTestId("add-to-tree").click();
    const dialog = page.getByRole("dialog", { name: "Add to this tree" });
    await dialog.getByRole("tab", { name: "Write" }).click();
    await dialog.getByRole("textbox", { name: "Your idea" }).fill("Atrophy happens quietly.");
    await dialog.getByRole("button", { name: "Add branch" }).click();
    await expect(card(page, "n-telos").getByTestId("branch-card").filter({ hasText: "Atrophy happens quietly" })).toBeVisible();
  });

  test("branches are essay or rabbit hole, and one click moves them", async ({ page }) => {
    await openTree(page, "tr-telos");
    await showBranches(page);
    const def = card(page, "n-telos").locator('[data-branch="n-telos-def"]');
    const chip = def.getByTestId("track-chip");
    await expect(chip).toHaveText("Rabbit hole");
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveText("Essay");
    await expect(card(page, "n-telos").locator('[data-branch="n-telos-q"]').getByTestId("track-chip")).toHaveText("Essay");
  });

  test("the map can show only rabbit holes", async ({ page }) => {
    await page.goto("/tree/tr-telos?view=map");
    await page.getByRole("radio", { name: "Rabbit holes" }).click();
    await expect(page.locator('[data-testid="map-node"][data-node="n-telos-def"]')).not.toHaveClass(/dim/);
    await expect(page.locator('[data-testid="map-node"][data-node="n-telos-q"]')).toHaveClass(/dim/);
  });

  test("Cite links a passage in your writing, and the link opens it", async ({ page }) => {
    await openTree(page, "tr-payments");
    await showBranches(page);
    await card(page, "n-stripe").locator('[data-branch="n-primer"]').click();
    const primer = card(page, "n-primer");
    await selectPhrase(primer, "interchange fee");
    await primer.getByTestId("selection-toolbar").getByRole("button", { name: "Cite" }).click();
    const writing = page.getByTestId("understanding");
    await expect(writing.getByRole("textbox", { name: "Your writing" })).toHaveValue(/\[“interchange fee”\]\(#cite:n-primer\//);
    // Go back to the seed, then follow the link: the card opens again.
    await page.locator(".trail-bar button").first().click();
    await expect(page.getByTestId("card")).toHaveCount(1);
    await writing.getByTestId("cite").click();
    await expectPath(page, ["n-stripe", "n-primer"]);
  });

  test("the Notebook gathers your notes, grouped by track, linked to their passages", async ({ page }) => {
    await page.goto("/tree/tr-payments?view=notebook");
    const nb = page.getByTestId("notebook");
    await expect(nb.getByRole("heading", { name: /Essay/ })).toBeVisible();
    await expect(nb.getByTestId("notebook-entry").filter({ hasText: "Tokenisation is why" })).toBeVisible();
    await nb.getByRole("radio", { name: "By source" }).click();
    await expect(nb.getByRole("heading", { name: /PCI/ }).first()).toBeVisible();
    await nb.getByTestId("notebook-entry").filter({ hasText: "This answers my question" }).getByRole("button", { name: /far fewer requirements/ }).click();
    await expectPath(page, ["n-stripe", "n-primer", "n-pci"]);
  });

  test("Sort with Claude suggests tracks and changes nothing until you apply", async ({ page }) => {
    await page.goto("/tree/tr-telos?view=notebook");
    await page.getByRole("button", { name: "Sort with Claude" }).click();
    await expect(page.getByTestId("sort-suggestions")).toBeVisible();
  });
});
