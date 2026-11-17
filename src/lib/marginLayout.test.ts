import { describe, expect, it } from "vitest";
import { packMargin } from "./marginLayout";

const pane = 1000;

describe("packMargin", () => {
  it("keeps a linked card level with the passage that opened it", () => {
    const packed = packMargin([
      { id: "wiki", y: 340, height: 512, anchored: true },
      { id: "clip", y: 273, height: 867, anchored: false },
    ], pane);
    expect(packed.wiki).toEqual({ top: 340, height: 512 });
    // The unlinked card takes the gap above the passage and scrolls inside that room.
    expect(packed.clip.top).toBe(0);
    expect(packed.clip.height).toBe(340 - 12);
    expect(packed.clip.top + packed.clip.height).toBeLessThanOrEqual(packed.wiki.top);
  });

  it("shortens a card to the screen instead of growing the page", () => {
    const packed = packMargin([{ id: "wiki", y: 80, height: 2400, anchored: true }], pane);
    expect(packed.wiki.top).toBe(80);
    expect(packed.wiki.height).toBe(pane - 80);
    expect(packed.wiki.top + packed.wiki.height).toBeLessThanOrEqual(pane);
  });

  it("leaves two loose cards where they were dropped when they don't overlap", () => {
    const packed = packMargin([
      { id: "a", y: 40, height: 120, anchored: false },
      { id: "b", y: 400, height: 150, anchored: false },
    ], pane);
    expect(packed.a).toEqual({ top: 40, height: 120 });
    expect(packed.b).toEqual({ top: 400, height: 150 });
  });

  it("keeps a size the reader set by hand", () => {
    const packed = packMargin([{ id: "note", y: 40, height: 1400, anchored: true, fixed: true }], pane);
    expect(packed.note).toEqual({ top: 40, height: 1400 });
  });
});
