// A source's table of contents, and links that make its printed contents page clickable.
// Nothing here changes the source's text: links are character ranges over the words already there.
import type { Block, Doc, TocEntry } from "../data/types";
import { norm } from "./util";

const key = (s: string) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The contents to show for a source: its own (PDF outline, EPUB navigation) when it has one,
 * otherwise its headings. A heading that appears more than once (a printed contents line, a running
 * header) counts once, at the copy that starts real text.
 */
export function contentsOf(doc: Pick<Doc, "toc" | "blocks"> | undefined): TocEntry[] {
  if (!doc) return [];
  if (doc.toc && doc.toc.length > 1) return doc.toc;
  const groups = new Map<string, number[]>();
  doc.blocks.forEach((b, i) => {
    if (b.kind !== "h" || b.text.length > 140) return;
    const k = key(b.text);
    if (k.length < 2) return;
    groups.set(k, [...(groups.get(k) || []), i]);
  });
  const starts = [...groups.values()].map((at) => at.find((i) => {
    const next = doc.blocks[i + 1];
    return next && next.kind === "p" && next.text.length > 150;
  }) ?? at[at.length - 1]);
  const toc = starts.sort((a, b) => a - b).map((i) => ({ title: doc.blocks[i].text, blockId: doc.blocks[i].id, level: 1 }));
  return toc.length > 1 ? toc : [];
}

export type ContentsLink = { blockId: string; start: number; end: number; target: string };

/**
 * Links from the printed contents page to the parts it lists. Only text before the first part is
 * searched, which is where a printed contents page sits, and each title is matched in the reader's
 * own words, so "Chapter 3 The Market .......... 41" links "The Market" to chapter 3.
 */
export function contentsLinks(blocks: Block[], toc: TocEntry[]): ContentsLink[] {
  if (toc.length < 2) return [];
  const index = new Map(blocks.map((b, i) => [b.id, i]));
  const first = Math.min(...toc.map((t) => index.get(t.blockId) ?? Infinity));
  if (!Number.isFinite(first) || first === 0) return [];
  const out: ContentsLink[] = [];
  for (let i = 0; i < first; i++) {
    const b = blocks[i];
    const lower = b.text.toLowerCase();
    const taken: [number, number][] = (b.links || []).map((l) => [l.start, l.end]);
    let from = 0;
    for (const t of toc) {
      const title = norm(t.title).toLowerCase();
      if (title.length < 3 || t.blockId === b.id) continue;
      // Search from the last match onwards, so repeated words in later titles find the later line.
      let at = lower.indexOf(title, from);
      if (at < 0) at = lower.indexOf(title);
      if (at < 0) continue;
      const end = at + title.length;
      // Only whole words: "Art" must not link the middle of "Start".
      if (/[\p{L}\p{N}]/u.test(lower[at - 1] || "") || /[\p{L}\p{N}]/u.test(lower[end] || "")) continue;
      if (taken.some(([s, e]) => at < e && end > s)) continue;
      taken.push([at, end]);
      out.push({ blockId: b.id, start: at, end, target: t.blockId });
      from = end;
    }
  }
  return out;
}

/** The contents entry the reader is in: the last one that starts at or before the given block. */
export function currentEntry(blocks: Block[], toc: TocEntry[], blockId: string | null): string | null {
  if (!blockId || !toc.length) return null;
  const index = new Map(blocks.map((b, i) => [b.id, i]));
  const here = index.get(blockId) ?? -1;
  let best: string | null = null, bestAt = -1;
  for (const t of toc) {
    const at = index.get(t.blockId) ?? -1;
    if (at <= here && at >= bestAt) { best = t.blockId; bestAt = at; }
  }
  return best;
}
