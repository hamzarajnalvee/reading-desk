import { describe, expect, it } from "vitest";
import { resizeCard } from "./cardGesture";

const start = { w: 240, h: 180, away: 0, dy: 0 };

describe("resizeCard", () => {
  it("grows a right-hand card from its outer bottom corner", () => {
    expect(resizeCard("right", "se", 80, 40, start)).toEqual({ w: 320, h: 220, away: 0, dy: 0 });
  });

  it("grows a left-hand card when its outer bottom corner is pulled away from the page", () => {
    expect(resizeCard("left", "sw", -70, 30, start)).toMatchObject({ w: 310, h: 210, away: 0 });
  });

  it("keeps the outer edge still when the edge nearest the page is pulled", () => {
    const next = resizeCard("right", "sw", -50, 0, start);
    expect(next.w).toBe(290);
    expect(next.away).toBe(-50);
  });

  it("grows upward from a top corner and lifts the card so the bottom stays", () => {
    const next = resizeCard("right", "ne", 0, -60, { ...start, dy: 20 });
    expect(next.h).toBe(240);
    expect(next.dy).toBe(-40);
  });
});