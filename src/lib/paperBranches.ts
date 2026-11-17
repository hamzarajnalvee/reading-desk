// Where a paper's own branches sit beside the card you are reading it in.
// "follow": a branch shows only while its passage is in the card, level with that passage.
// "spread": every branch is on screen at once, spaced evenly, still naming the passage it came from.

export type PaperLayout = "follow" | "spread";

export interface PaperItem {
  id: string;
  /** Distance from the top of the visible article to the passage. Null when the passage can't be found. */
  passageY: number | null;
  /** Reading order, so a spread stays in the order of the paper. */
  order: number;
  quote: string;
  page?: number;
}

export interface PaperPlace {
  id: string;
  top: number;
  /** Drawn beside the article. Follow mode hides a branch whose passage is scrolled away. */
  visible: boolean;
  /** Where a thread meets the article, when that passage is on screen. */
  passageY: number | null;
  quote: string;
  page?: number;
}

const ROW = 76;

export function placePaperBranches(items: PaperItem[], viewH: number, mode: PaperLayout): PaperPlace[] {
  const ordered = [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const height = Math.max(viewH, ROW);
  if (mode === "spread") {
    const n = ordered.length;
    const span = Math.max(0, height - ROW);
    return ordered.map((it, i) => ({
      id: it.id,
      top: n <= 1 ? Math.max(0, (height - ROW) / 2) : (span * i) / (n - 1),
      visible: true,
      passageY: onScreen(it.passageY, height) ? it.passageY : null,
      quote: it.quote,
      page: it.page,
    }));
  }
  return ordered.map((it) => {
    const on = onScreen(it.passageY, height);
    const y = it.passageY ?? 0;
    return {
      id: it.id,
      top: Math.min(Math.max(0, y - 8), Math.max(0, height - ROW)),
      visible: on,
      passageY: on ? it.passageY : null,
      quote: it.quote,
      page: it.page,
    };
  });
}

function onScreen(y: number | null, viewH: number): y is number {
  return y != null && y >= -8 && y <= viewH + 8;
}
