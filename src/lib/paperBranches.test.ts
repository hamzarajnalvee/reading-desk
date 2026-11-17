import { describe, expect, it } from "vitest";
import { placePaperBranches } from "./paperBranches";

const items = [
  { id: "early", passageY: 40, order: 0, quote: "the parties", page: 1 },
  { id: "mid", passageY: 420, order: 1, quote: "interchange fee", page: 3 },
  { id: "late", passageY: 1400, order: 2, quote: "PCI DSS", page: 4 },
];

describe("placePaperBranches", () => {
  it("shows a branch only while its passage is inside the card", () => {
    const placed = placePaperBranches(items, 480, "follow");
    expect(placed.find((p) => p.id === "early")!.visible).toBe(true);
    expect(placed.find((p) => p.id === "mid")!.visible).toBe(true);
    expect(placed.find((p) => p.id === "late")!.visible).toBe(false);
    expect(placed.find((p) => p.id === "early")!.top).toBe(32);
  });

  it("spreads every branch down the card and keeps the passage it is linked to", () => {
    const placed = placePaperBranches(items, 480, "spread");
    expect(placed.map((p) => p.id)).toEqual(["early", "mid", "late"]);
    expect(placed.every((p) => p.visible)).toBe(true);
    expect(placed[0].top).toBe(0);
    expect(placed[2].top).toBe(480 - 76);
    expect(placed[1].top).toBeGreaterThan(placed[0].top);
    expect(placed[1].top).toBeLessThan(placed[2].top);
    expect(placed[0].passageY).toBe(40);
    expect(placed[2].passageY).toBeNull();
    expect(placed[2].quote).toBe("PCI DSS");
  });
});
