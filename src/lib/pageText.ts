// Text on a page image: turning recognised lines into paragraphs, and placing a page's positioned text
// (pdf.js text items, or recognised lines) onto the blocks it belongs to, so the original page can be
// selected, highlighted and branched from exactly like the text view.
import type { Block, OcrLine } from "../data/types";

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Recognised lines into paragraphs and headings. A paragraph ends at a wider gap, a change of size or a jump
 * sideways (a new column). Chart labels and axis numbers (short, small or mostly digits) are left out of the
 * text; they stay visible on the original page.
 */
export function ocrParas(lines: OcrLine[]): { kind: "h" | "p"; text: string }[] {
  if (!lines.length) return [];
  const mh = median(lines.map((l) => l.h));
  const out: { kind: "h" | "p"; text: string }[] = [];
  let buf: OcrLine[] = [];
  const flush = () => {
    if (!buf.length) return;
    let text = "";
    for (const l of buf) text = !text ? l.t : /[a-z]-$/.test(text) && /^[a-z]/.test(l.t) ? text.slice(0, -1) + l.t : `${text} ${l.t}`;
    const h = median(buf.map((l) => l.h)), n = words(text);
    const digits = (text.match(/[\d%$.,\-–]/g) || []).length / text.length;
    const heading = buf.length <= 2 && h > mh * 1.3 && n <= 14;
    const label = !heading && ((digits > 0.4 && n < 8) || (n < 5 && !/[.?!:,;"”]$/.test(text) && h < mh * 0.95));
    if (!label) out.push({ kind: heading ? "h" : "p", text });
    buf = [];
  };
  for (const l of lines) {
    const prev = buf[buf.length - 1];
    if (prev) {
      const gap = l.y - (prev.y + prev.h);
      const resized = Math.abs(l.h - prev.h) > Math.max(prev.h, l.h) * 0.3;
      if (gap > mh * 0.75 || gap < -mh * 2 || resized || Math.abs(l.x - prev.x) > 0.2) flush();
    }
    buf.push(l);
  }
  flush();
  return out;
}

/** A run of text at a place on the page (fractions of the page), as pdf.js or recognition gives it. */
export interface PageText { t: string; x: number; y: number; w: number; h: number }
/** The same run, placed in a block: characters [start, end) of that block's text. Unplaced runs have no block. */
export interface Piece extends PageText { blockId?: string; start?: number; end?: number }

/**
 * Walk the page's runs in order and find each one in the page's blocks, moving forward as they're found.
 * Spacing and line-end hyphens may differ between the two, so a run is matched without them; a run that
 * can't be found nearby (a chart label left out of the text) stays unplaced and is still shown.
 */
export function alignPieces(blocks: Block[], runs: PageText[]): Piece[] {
  let bi = 0, off = 0;
  const WINDOW = 400;
  return runs.map((r) => {
    const t = r.t.replace(/\s+/g, " ").trim();
    if (!t) return { ...r };
    const tries = [t, t.replace(/-$/, "")].filter((x, i, a) => x && a.indexOf(x) === i);
    for (let k = bi; k < Math.min(blocks.length, bi + 4); k++) {
      const text = blocks[k].text, from = k === bi ? off : 0;
      for (const q of tries) {
        const at = text.indexOf(q, from);
        if (at >= 0 && at - from <= WINDOW) {
          bi = k; off = at + q.length;
          return { ...r, blockId: blocks[k].id, start: at, end: at + q.length };
        }
      }
    }
    return { ...r };
  });
}
