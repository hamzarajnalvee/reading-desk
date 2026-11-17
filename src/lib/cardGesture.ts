import { clamp } from "./util";

/** A corner of a margin card. `n`/`s` is top/bottom, `e`/`w` is the right/left edge. */
export type Corner = "nw" | "ne" | "sw" | "se";

export interface CardBox { w: number; h: number; away: number; dy: number }

const MIN_W = 160, MAX_W = 900, MIN_H = 64, MAX_H = 1400;

/**
 * Resize from any corner. The opposite corner stays put: pulling the top edge grows the card
 * upward, and pulling the edge nearest the page grows it toward the page.
 * `dx`/`dy` are in page units, positive to the right and down.
 */
export function resizeCard(side: "left" | "right", corner: Corner, dx: number, dy: number, start: CardBox): CardBox {
  const outer = side === "right" ? corner.endsWith("e") : corner.endsWith("w");
  const bottom = corner.startsWith("s");
  const dxAway = dx * (side === "left" ? -1 : 1);
  const w = clamp(Math.round(start.w + (outer ? dxAway : -dxAway)), MIN_W, MAX_W);
  const h = clamp(Math.round(start.h + (bottom ? dy : -dy)), MIN_H, MAX_H);
  // The outer edge is the one the width is anchored to. Moving the inner edge shifts the card
  // by the same amount the width changed, so that outer edge doesn't follow the pointer.
  const away = outer ? start.away : clamp(Math.round(start.away - (w - start.w)), -200, 4000);
  const nextDy = bottom ? start.dy : clamp(Math.round(start.dy - (h - start.h)), -2000, 4000);
  return { w, h, away, dy: nextDy };
}
