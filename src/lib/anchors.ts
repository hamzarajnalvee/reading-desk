// Turning DOM selections and pointer positions into text anchors, and back.
import type { Anchor, Block } from "../data/types";

/** Anything with an id and blocks: a Doc or a card's Content. */
type Readable = { id: string; blocks: Block[] };
import { sentenceAt } from "./util";

export function blockElOf(node: Node | null): HTMLElement | null {
  const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
  return (el?.closest("[data-block]") as HTMLElement) || null;
}

function offsetIn(blockEl: HTMLElement, node: Node, off: number): number {
  const r = document.createRange();
  r.setStart(blockEl, 0);
  r.setEnd(node, off);
  return r.toString().length;
}

export interface SelectionInfo { anchor: Anchor; rect: DOMRect; endRect: DOMRect; }

/** Read the current text selection inside a document sheet. Multi-block selections are clamped to the first block. */
export function selectionAnchor(doc: Readable, root?: Element): SelectionInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  const sb = blockElOf(r.startContainer);
  if (!sb || (root && !root.contains(sb))) return null;
  const eb = blockElOf(r.endContainer);
  const full = sb.textContent || "";
  let start = offsetIn(sb, r.startContainer, r.startOffset);
  let end = eb === sb ? offsetIn(sb, r.endContainer, r.endOffset) : full.length;
  while (start < end && /\s/.test(full[start])) start++;
  while (end > start && /\s/.test(full[end - 1])) end--;
  if (end <= start) return null;
  const block = doc.blocks.find((b) => b.id === sb.dataset.block);
  if (!block) return null;
  const rects = r.getClientRects();
  const endRect = rects[rects.length - 1] || r.getBoundingClientRect();
  return { anchor: { docId: doc.id, blockId: block.id, start, end, quote: full.slice(start, end), page: block.page }, rect: r.getBoundingClientRect(), endRect };
}

/** The sentence under a screen point, for dropping a thread onto text. */
export function sentenceAnchorAt(doc: Readable, x: number, y: number, root?: Element): Anchor | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  let node: Node | null = null, off = 0;
  if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
  else if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
  const be = blockElOf(node);
  if (!be || !node || (root && !root.contains(be))) return null;
  const block = doc.blocks.find((b) => b.id === be.dataset.block);
  if (!block) return null;
  const at = offsetIn(be, node, off);
  const [s, e] = sentenceAt(block.text, at);
  return { docId: doc.id, blockId: block.id, start: s, end: e, quote: block.text.slice(s, e), page: block.page };
}

/** First rendered mark for an annotation (marks carry space-separated ids in data-ann). */
export function markFor(root: ParentNode, annId: string, blockId?: string): HTMLElement | null {
  const sel = blockId ? `[data-block="${blockId}"] [data-ann~="${annId}"]` : `[data-ann~="${annId}"]`;
  return root.querySelector(sel);
}

/**
 * Where an anchor sits in a block today. Offsets are trusted when the text still matches the quote;
 * otherwise the quote is searched for (notes can be edited after branching), and null means it's gone.
 */
export function resolveRange(block: Block, a: Anchor): [number, number] | null {
  if (a.blockId !== block.id) return null;
  if (block.text.slice(a.start, a.end) === a.quote) return [a.start, a.end];
  const i = block.text.indexOf(a.quote);
  return i >= 0 ? [i, i + a.quote.length] : null;
}

/**
 * Re-attach an anchor after its card's text was edited. Keeps it when the quote is still where it was,
 * follows it when it moved (even into another paragraph), and leaves it untouched when the words are gone
 * so nothing is lost if they're typed back. Returns the same object when nothing changed.
 */
export function reanchor(blocks: Block[], a: Anchor): Anchor {
  const own = blocks.find((b) => b.id === a.blockId);
  const here = own && resolveRange(own, a);
  if (here) return here[0] === a.start && here[1] === a.end ? a : { ...a, start: here[0], end: here[1] };
  for (const b of blocks) {
    const i = b.text.indexOf(a.quote);
    if (i >= 0) return { ...a, blockId: b.id, start: i, end: i + a.quote.length, page: b.page };
  }
  return a;
}
