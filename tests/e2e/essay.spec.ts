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
    // It stands in its own column beyond the margin, clear of the page and as tall as the window.
    const sheetBox = (await card(page, "n-telos").locator(".sheet").first().boundingBox())!;
    const colBox = (await branch.boundingBox())!;
    expect(colBox.x + colBox.width < sheetBox.x || colBox.x > sheetBox.x + sheetBox.width).toBe(true);
    expect(colBox.height).toBeGreaterThan(400);
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
    // The quote lands at the end of the root (the essay itself): the words, then where they came from in italics.
    const quote = card(page, "n-telos").locator(".blk-quote").last();
    await expect(quote).toContainText("“Painting a wall”");
    await expect(quote.locator("mark.k-attrib").first()).toContainText("— from");
    await expect(quote).toContainText("The case for the trivial, p. 1");
    // Its title opens the source at the quoted passage.
    await quote.locator('mark[data-ann*="link|"]').click();
    await expect(page.getByTestId("card")).toHaveCount(2);
    await page.locator(".trail-bar button").first().click();
    await expect(page.getByTestId("card")).toHaveCount(1);
    await branch.getByRole("button", { name: "Close article" }).focus();
    await page.keyboard.press("Enter");
    await expect(branch.getByTestId("article")).toHaveCount(0);
    // The grabbed words stay marked in the source, filed with the essay.
    await page.getByRole("radio", { name: "Notebook" }).click();
    const essay = page.getByTestId("notebook").locator(".nb-group.t-essay");
    await expect(essay.locator('[data-testid="notebook-entry"][data-kind="highlight"]')).toContainText("Painting a wall");
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

  test("Quote puts a passage in your writing with its source, and the link opens it", async ({ page }) => {
    await openTree(page, "tr-payments");
    await showBranches(page);
    await card(page, "n-stripe").locator('[data-branch="n-primer"]').click();
    const primer = card(page, "n-primer");
    await selectPhrase(primer, "interchange fee");
    await primer.getByTestId("selection-toolbar").getByRole("button", { name: "Quote" }).click();
    const writing = page.getByTestId("understanding");
    // The passage arrives as a quotation, with its source in italics, linked back to it.
    await expect(writing.getByRole("textbox", { name: "Your writing" })).toHaveValue(/> interchange fee\n> — \*from \[[^\]]+\]\(#cite:n-primer\/[^)]+\), p\. \d+\*/);
    await expect(primer.locator("mark", { hasText: "interchange fee" }).first()).toBeVisible();
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

  test("Search finds papers without leaving the app, and Add puts one on the seed", async ({ page }) => {
    // Tests run offline: answer the search the way the server would.
    await page.route("**/api/search?*", (route) => route.fulfill({ json: { hits: [
      { title: "Deskilling dilemma: brain over automation", url: "https://example.org/deskilling.pdf", snippet: "Deskilling refers to the reduction of the skill level required.", meta: "El Tarhouny · 2026 · Frontiers in Medicine", free: true },
    ] } }));
    await openTree(page, "tr-telos");
    await page.getByTestId("add-to-tree").click();
    const dialog = page.getByRole("dialog", { name: "Add to this tree" });
    await expect(dialog.getByRole("tab", { name: "Search" })).toHaveAttribute("aria-selected", "true");
    await dialog.getByRole("searchbox", { name: "Search for" }).fill("deskilling automation");
    await dialog.getByRole("button", { name: "Search", exact: true }).click();
    const hit = dialog.getByTestId("search-hit");
    await expect(hit).toContainText("Deskilling dilemma");
    await hit.getByRole("button", { name: /^Add / }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card(page, "n-telos").locator('[data-testid="branch-card"][data-kind="source"]')).toContainText("Deskilling dilemma");
  });

  test("margin cards can be dragged further from the page and along it, and the page can be moved and resized", async ({ page }) => {
    await openTree(page, "tr-telos");
    await showBranches(page);
    const c = card(page, "n-telos");
    const def = c.locator('[data-branch="n-telos-def"]');
    // Let the margin finish laying out before measuring.
    let last = "";
    await expect.poll(async () => { const b = JSON.stringify(await def.boundingBox()); const settled = b === last; last = b; return settled; }, { intervals: [150] }).toBe(true);
    const before = (await def.boundingBox())!;
    const head = (await def.locator(".bcard-head").boundingBox())!;
    await page.mouse.move(head.x + 20, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(head.x + 80, head.y + head.height / 2 + 60, { steps: 6 });
    await page.mouse.up();
    // It stays where it was dropped (it doesn't open), further out and lower down.
    await expect(page.getByTestId("card")).toHaveCount(1);
    await expect.poll(async () => (await def.boundingBox())!.x).toBeGreaterThan(before.x + 40);
    await expect.poll(async () => (await def.boundingBox())!.y).toBeGreaterThan(before.y + 30);

    const sheet = c.locator(".sheet-wrap");
    const w0 = (await sheet.boundingBox())!.width;
    await sheet.hover();
    const edge = (await c.getByTestId("page-edge").boundingBox())!;
    await page.mouse.move(edge.x + 4, edge.y + 40);
    await page.mouse.down();
    await page.mouse.move(edge.x - 120, edge.y + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await sheet.boundingBox())!.width).toBeLessThan(w0 - 80);
    const x0 = (await sheet.boundingBox())!.x;
    await sheet.hover();
    const grip = (await c.getByTestId("page-grip").boundingBox())!;
    await page.mouse.move(grip.x + 10, grip.y + 8);
    await page.mouse.down();
    await page.mouse.move(grip.x - 90, grip.y + 8, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await sheet.boundingBox())!.x).toBeLessThan(x0 - 60);
  });
  test("a page slid far to the left can still be scrolled to", async ({ page }) => {
    await openTree(page, "tr-telos");
    await showBranches(page);
    const c = card(page, "n-telos");
    const sheet = c.locator(".sheet-wrap");
    await sheet.hover();
    const grip = (await c.getByTestId("page-grip").boundingBox())!;
    await page.mouse.move(grip.x + 10, grip.y + 8);
    await page.mouse.down();
    await page.mouse.move(grip.x - 1400, grip.y + 8, { steps: 10 });
    await page.mouse.up();
    const scroller = c.locator(".card-scroll");
    await scroller.evaluate((el) => { el.scrollLeft = 0; });
    const box = (await scroller.boundingBox())!;
    await expect.poll(async () => { await scroller.evaluate((el) => { el.scrollLeft = 0; }); return (await sheet.boundingBox())!.x; }).toBeGreaterThanOrEqual(box.x - 1);
  });

  test("a link can be moved to another sentence or removed, and each kind of branch looks its own", async ({ page }) => {
    await openTree(page, "tr-telos");
    await showBranches(page);
    const c = card(page, "n-telos");
    const def = c.locator('[data-branch="n-telos-def"]');
    await expect(def).toHaveClass(/kind-(definition|wiki)/);
    const end = c.locator('[data-branch-link="n-telos-def"] [data-testid="link-end"]').first();
    await expect(end).toBeAttached();
    // Drag the link's end onto another paragraph: it moves there.
    const from = (await end.boundingBox())!;
    const target = (await c.locator('.sheet [data-block]:not([data-block="n-telos-p2"])').last().boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 40, target.y + 8, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText("Moved the link")).toBeVisible();
    // Click it to unlink: the branch stays in the margin, unlinked.
    await end.click({ force: true });
    const menu = c.getByTestId("link-menu");
    await menu.getByRole("button", { name: "Unlink from this passage" }).click();
    await expect(def).toContainText("Not linked");
  });
});
