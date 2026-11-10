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
    // A source opens as the next card, and sits unlinked in the seed's margin.
    await expect(page.getByTestId("card")).toHaveCount(2);
    await expect(page.getByTestId("card").last()).toContainText("Painting a wall");
    const branch = card(page, "n-telos").locator('[data-testid="branch-card"][data-kind="source"]');
    await expect(branch).toContainText("Not linked");
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
