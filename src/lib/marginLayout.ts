// Places branch cards in one margin. A card that grew from a passage stays level with that
// passage. Anything taller than the room on screen keeps the rest of its text in its own scroll,
// so a long article doesn't push its siblings away or make the page scroll.

export interface MarginItem {
  id: string;
  /** Where it wants to sit: the passage it came from, or where it was dropped. */
  y: number;
  /** How tall its content is, before fitting. */
  height: number;
  /** Tied to a passage on this page (or the card you're working on). */
  anchored: boolean;
  /** The reader dragged it to this size; leave that size alone. */
  fixed?: boolean;
}

export interface PackedCard {
  top: number;
  /** The height it actually gets. Shorter than its content means it scrolls inside. */
  height: number;
}

const GAP = 12;
const MIN = 132;

/** The most a card may be while its top is `top` and the screen is `pane` tall. */
function roomBelow(top: number, pane: number, content: number, fixed?: boolean): number {
  if (fixed) return content;
  const onScreen = top < pane ? Math.max(MIN, pane - top) : pane;
  return Math.min(content, pane, onScreen);
}

export function packMargin(items: MarginItem[], pane: number): Record<string, PackedCard> {
  const out: Record<string, PackedCard> = {};
  const anchored = items.filter((i) => i.anchored).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  let floor = 0;
  for (const it of anchored) {
    const top = Math.max(it.y, floor);
    const height = roomBelow(top, pane, it.height, it.fixed);
    out[it.id] = { top, height };
    floor = top + height + GAP;
  }

  const loose = items.filter((i) => !i.anchored).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  for (const it of loose) {
    const occupied = Object.values(out).sort((a, b) => a.top - b.top);
    const gaps: { top: number; room: number }[] = [];
    let cursor = 0;
    for (const b of occupied) {
      const room = b.top - GAP - cursor;
      if (room >= MIN) gaps.push({ top: cursor, room });
      cursor = Math.max(cursor, b.top + b.height + GAP);
    }
    gaps.push({ top: cursor, room: Number.POSITIVE_INFINITY });

    let best = { top: cursor, height: roomBelow(cursor, pane, it.height, it.fixed) };
    let bestDist = Infinity;
    for (const g of gaps) {
      const span = g.room === Number.POSITIVE_INFINITY ? pane : g.room;
      // Sitting on the asked-for line is right when the card still gets its text.
      // If that would leave only a sliver, fill the gap from the top so the card can scroll.
      const wantRoom = it.y >= g.top && it.y < g.top + span ? Math.min(it.height, g.top + span - it.y) : 0;
      const startRoom = Math.min(it.height, span);
      const useWant = wantRoom >= Math.min(it.height, 220) || wantRoom >= startRoom - 24;
      const top = useWant ? it.y : g.top;
      const fitted = it.fixed ? it.height : Math.min(useWant ? wantRoom : startRoom, roomBelow(top, pane, it.height));
      if (!it.fixed && g.room !== Number.POSITIVE_INFINITY && fitted < MIN) continue;
      const dist = Math.abs(top - it.y);
      if (dist < bestDist) { best = { top, height: fitted }; bestDist = dist; }
    }
    out[it.id] = best;
  }
  return out;
}
