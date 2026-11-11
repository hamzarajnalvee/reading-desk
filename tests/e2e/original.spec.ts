// PDFs as their original pages (figures, tables, layout), and PDFs whose words are only pictures.
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { selectPhrase } from "./helpers";

const fixture = (f: string) => join(process.cwd(), "tests", "fixtures", f);

async function startFromFile(page: Page, file: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a new tree" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a tree" });
  await dialog.getByRole("tab", { name: "File" }).click();
  await dialog.locator('input[type="file"]').setInputFiles(fixture(file));
  await expect(page).toHaveURL(/\/tree\//, { timeout: 60_000 });
  const skip = page.getByRole("dialog", { name: "Tip" }).getByRole("button", { name: "Skip" });
  if (await skip.waitFor({ timeout: 1500 }).then(() => true, () => false)) await skip.click();
  return page.getByTestId("card").first();
}

/** True once the page's canvas has drawn something other than white. */
const drawn = (page: Page) => page.locator(".ol-canvas").first().evaluate((c: HTMLCanvasElement) => {
  if (!c.width) return false;
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 200 || d[i + 1] < 200) return true;
  return false;
});

test.describe("Original pages", () => {
  test("a PDF can be shown as its real pages, and passages highlighted there show in the text too", async ({ page }) => {
    const c = await startFromFile(page, "text-and-figure.pdf");
    await expect(c).toContainText("Painting a wall teaches patience");
    await c.getByTestId("view-original").getByRole("radio", { name: "Original" }).click();
    await expect(c.getByTestId("original")).toBeVisible();
    await expect.poll(() => drawn(page), { timeout: 15_000 }).toBe(true);
    // The words sit over the image, on the source's own blocks, so they can be selected and marked.
    await expect(c.locator(".ol-block[data-block] .ol-run").first()).toBeAttached();
    await selectPhrase(c, "Painting a wall");
    await c.getByTestId("selection-toolbar").getByRole("button", { name: /Highlight/ }).click();
    await expect(c.locator(".ol-text mark.mk.k-highlight")).toHaveCount(1);
    // Back to text: the same highlight is there.
    await c.getByTestId("view-original").getByRole("radio", { name: "Text" }).click();
    await expect(c.locator(".sheet mark.mk.k-highlight")).toContainText("Painting a wall");
  });

  test("a PDF whose words are only a picture is read on this device, and lines up with its page", async ({ page }) => {
    test.setTimeout(120_000);
    const c = await startFromFile(page, "picture-of-words.pdf");
    await expect(c).toContainText(/Painting a wall teaches patience/, { timeout: 90_000 });
    await expect(c).toContainText("recognised from the page images");
    await c.getByTestId("view-original").getByRole("radio", { name: "Original" }).click();
    await expect.poll(() => drawn(page), { timeout: 15_000 }).toBe(true);
    await expect(c.locator(".ol-block[data-block] .ol-run").first()).toBeAttached();
  });
});
