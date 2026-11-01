import { beforeEach, describe, expect, it } from "vitest";
import { markFor, selectionAnchor } from "./anchors";
import type { Doc } from "../data/types";

const TEXT = "Temporal difference learning updates a value estimate using an observed reward.";
const doc: Doc = {
  id: "d1", title: "Test", type: "paper", format: "pdf", pages: 2, addedAt: 0,
  blocks: [
    { id: "b1", kind: "p", page: 1, text: TEXT },
    { id: "b2", kind: "p", page: 2, text: "Second paragraph here." },
  ],
};

/** Render blocks the way DocumentSheet does, optionally splitting b1 with a <mark>. */
function render(withMark: boolean) {
  document.body.innerHTML = withMark
    ? `<p data-block="b1">Temporal <mark data-ann="a1 a2">difference learning</mark> updates a value estimate using an observed reward.</p><p data-block="b2">Second paragraph here.</p>`
    : `<p data-block="b1">${TEXT}</p><p data-block="b2">Second paragraph here.</p>`;
}

function select(startNode: Node, startOff: number, endNode: Node, endOff: number) {
  const r = document.createRange();
  r.setStart(startNode, startOff);
  r.setEnd(endNode, endOff);
  const s = window.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
}

describe("selectionAnchor", () => {
  beforeEach(() => window.getSelection()?.removeAllRanges());

  it("returns block offsets for a plain selection", () => {
    render(false);
    const t = document.querySelector('[data-block="b1"]')!.firstChild!;
    const i = TEXT.indexOf("value estimate");
    select(t, i, t, i + "value estimate".length);
    const a = selectionAnchor(doc)!.anchor;
    expect(a).toMatchObject({ docId: "d1", blockId: "b1", start: i, end: i + 14, quote: "value estimate", page: 1 });
  });

  it("measures offsets on textContent when the block already contains marks", () => {
    render(true);
    const block = document.querySelector('[data-block="b1"]')!;
    const after = block.lastChild!; // " updates a value estimate…"
    const i = after.textContent!.indexOf("value");
    select(after, i, after, i + 5);
    const a = selectionAnchor(doc)!.anchor;
    expect(a.start).toBe(TEXT.indexOf("value"));
    expect(a.quote).toBe("value");
  });

  it("trims surrounding whitespace from the selection", () => {
    render(false);
    const t = document.querySelector('[data-block="b1"]')!.firstChild!;
    const i = TEXT.indexOf(" value ");
    select(t, i, t, i + 7);
    expect(selectionAnchor(doc)!.anchor.quote).toBe("value");
  });

  it("clamps a selection across paragraphs to the first paragraph", () => {
    render(false);
    const t1 = document.querySelector('[data-block="b1"]')!.firstChild!;
    const t2 = document.querySelector('[data-block="b2"]')!.firstChild!;
    select(t1, TEXT.indexOf("observed"), t2, 6);
    const a = selectionAnchor(doc)!.anchor;
    expect(a.blockId).toBe("b1");
    expect(a.quote).toBe("observed reward.");
  });

  it("returns null for an empty or outside selection", () => {
    render(false);
    expect(selectionAnchor(doc)).toBeNull();
    document.body.insertAdjacentHTML("beforeend", "<div id='x'>outside</div>");
    const t = document.getElementById("x")!.firstChild!;
    select(t, 0, t, 7);
    expect(selectionAnchor(doc)).toBeNull();
  });
});

describe("markFor", () => {
  it("finds marks by any of their space-separated annotation ids", () => {
    render(true);
    expect(markFor(document, "a2")?.textContent).toBe("difference learning");
    expect(markFor(document, "a1", "b1")).not.toBeNull();
    expect(markFor(document, "a1", "b2")).toBeNull();
  });
});
