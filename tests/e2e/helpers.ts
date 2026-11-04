import { expect, type Locator, type Page } from "@playwright/test";

/** Open a tree (optionally at a trail) with first-run tips dismissed. */
export async function openTree(page: Page, treeId = "tr-payments", path?: string[]) {
  await page.goto(`/tree/${treeId}${path ? `?path=${path.join(",")}` : ""}`);
  await expect(page.getByTestId("card").first()).toBeVisible();
  // First-run tips appear shortly after the first card; skip them so they don't cover anything.
  const skip = page.getByRole("dialog", { name: "Tip" }).getByRole("button", { name: "Skip" });
  if (await skip.waitFor({ timeout: 1500 }).then(() => true, () => false)) await skip.click();
}

export const card = (page: Page, nodeId: string) => page.locator(`[data-testid="card"][data-node="${nodeId}"]`);

/** Select an exact phrase inside a card, the way a user's drag would, and show the toolbar. */
export async function selectPhrase(cardEl: Locator, phrase: string) {
  const block = cardEl.locator("[data-block]", { hasText: phrase }).first();
  await block.scrollIntoViewIfNeeded();
  await block.evaluate((el, text) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const i = n.textContent!.indexOf(text);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + text.length);
        const s = window.getSelection()!;
        s.removeAllRanges(); s.addRange(r);
        return;
      }
    }
    throw new Error(`Phrase not found in a single text node: ${text}`);
  }, phrase);
  await cardEl.locator(".sheet-wrap").dispatchEvent("mousedown");
  await cardEl.locator(".sheet-wrap").dispatchEvent("mouseup");
  await expect(cardEl.getByTestId("selection-toolbar")).toBeVisible();
}

/** A point in a card's margin, in view, that no branch covers. */
export async function emptyMarginPoint(cardEl: Locator) {
  return cardEl.getByTestId("margin").evaluate((margin) => {
    const mr = margin.getBoundingClientRect();
    const cards = [...margin.querySelectorAll("[data-branch]")].map((c) => c.getBoundingClientRect());
    for (let y = Math.max(160, mr.top + 20); y < window.innerHeight - 40; y += 16) {
      if (!cards.some((r) => y > r.top - 16 && y < r.bottom + 16)) return { x: mr.left + mr.width / 2, y };
    }
    throw new Error("No empty margin space in view");
  });
}

export async function dragThreadTo(page: Page, cardEl: Locator, x: number, y: number) {
  const h = await cardEl.getByTestId("thread-handle").boundingBox();
  if (!h) throw new Error("Thread handle not visible");
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move((h.x + x) / 2, (h.y + y) / 2, { steps: 6 });
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
}

export async function paste(page: Page, data: Record<string, string>) {
  await page.evaluate((d) => {
    const dt = new DataTransfer();
    Object.entries(d).forEach(([k, v]) => dt.setData(k, v));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, data);
}

/** The trail in the address bar, decoded (the app writes ?path=a,b,c). */
export async function expectPath(page: Page, ids: string[]) {
  await expect.poll(() => new URL(page.url()).searchParams.get("path")).toBe(ids.join(","));
}
